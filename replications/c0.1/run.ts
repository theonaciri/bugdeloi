#!/usr/bin/env bun
import { mkdir, mkdtemp } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { createDb, event, replicationRun } from '@bugdeloi/db'
import { readImageLock, runInSandbox } from '@bugdeloi/runner'
import { buildErrors, firstDiagnostic, parseClerkReport } from './report.ts'
import { source, sourceCommit, sourceUrl, withSource, writeJson } from './source.ts'

const kind = 'C0.1-inria-replay'
const folders = [
  'allocations_familiales',
  'aides_logement',
  'impot_revenu',
  'prestations_familiales',
  'smic',
  'base_mensuelle_allocations_familiales',
  'droit_successions',
  'asp/aide_fibre',
  'asp/bcae7',
  'asp/fonpeps',
]
const limits = { timeoutMs: 300_000, memoryMb: 1536, cpus: 2, network: false } as const

async function replay(workdir: string, folder: string, raw: string) {
  const command = [
    'clerk',
    'test',
    '--json',
    '--color=never',
    '--backend=interpret',
    '--makeflags=-j2',
    '--build-dir=/build',
    '--target-dir=/build/targets',
    folder,
  ]
  const startedAt = new Date()
  let run: Awaited<ReturnType<typeof runInSandbox>>
  try {
    run = await runInSandbox({ workdir, command, ...limits })
  } catch (error) {
    run = { exitCode: -1, stdout: '', stderr: String(error), durationMs: 0, timedOut: false }
  }
  const finishedAt = new Date()
  const log = (stream: 'stdout' | 'stderr') => join(raw, `${folder.replaceAll('/', '-')}.${stream}.log`)
  await Promise.all([Bun.write(log('stdout'), run.stdout), Bun.write(log('stderr'), run.stderr)])
  const output = `${run.stdout}\n${run.stderr}`
  let files: ReturnType<typeof parseClerkReport>
  let hasReport = false
  let diagnostic: string | undefined
  let status: 'passed' | 'failed' | 'error'
  try {
    files = parseClerkReport(run.stdout)
    hasReport = true
    const hasFailures = files.some((file) => file.failed > 0)
    status = hasFailures ? 'failed' : 'passed'
    if (run.timedOut || run.exitCode !== Number(hasFailures)) {
      status = 'error'
      diagnostic = firstDiagnostic(output) ?? 'Le code de sortie diverge du résultat Clerk.'
    } else if (hasFailures) {
      const first = files.find((file) => file.failed > 0)
      diagnostic = first?.errors[0] ?? `Premier échec signalé par Clerk dans ${first?.file}.`
    }
  } catch {
    status = 'error'
    files = buildErrors(output)
    diagnostic =
      firstDiagnostic(output) ?? (run.stderr.split('\n')[0] || 'Rapport JSON Clerk absent ou invalide.')
  }
  if (run.timedOut) diagnostic = `Délai de ${limits.timeoutMs / 1000} s dépassé.`
  const counts = files.reduce(
    (sum, file) => ({
      tests: sum.tests + file.tests,
      passed: sum.passed + file.passed,
      failed: sum.failed + file.failed,
    }),
    { tests: 0, passed: 0, failed: 0 },
  )
  const { exitCode, durationMs, timedOut } = run
  const totals = hasReport ? counts : { tests: null, passed: null, failed: null }
  const outcome = hasReport ? `${counts.passed}/${counts.tests} tests réussis` : 'aucun rapport Clerk'
  console.log(`${folder} — ${status}, ${outcome}`)
  return {
    folder,
    command,
    startedAt,
    finishedAt,
    durationMs,
    status,
    exitCode,
    timedOut,
    ...totals,
    files,
    diagnostic,
  }
}

const image = await readImageLock()
const rawRoot = join(import.meta.dir, 'raw')
await mkdir(rawRoot, { recursive: true })
const raw = await mkdtemp(join(rawRoot, 'run-'))
const results = await withSource(async (workdir) => {
  const results = []
  for (const folder of folders) results.push(await replay(workdir, folder, raw))
  return results
})
const artifacts = {
  source,
  sourceCommit,
  catalaVersion: image.catala,
  imageDigest: image.digest,
  arch: image.arch,
  rawDirectory: `raw/${basename(raw)}`,
  limits,
  results,
}

const { db, sql } = createDb()
try {
  await db.transaction(async (tx) => {
    const runs = await tx
      .insert(replicationRun)
      .values(
        results.map(({ startedAt, finishedAt, status, ...summary }) => ({
          kind,
          subject: `catala-examples@${sourceCommit}/${summary.folder}`,
          catalaVersion: image.catala,
          imageDigest: image.digest,
          startedAt,
          finishedAt,
          status,
          summary,
        })),
      )
      .returning({ id: replicationRun.id, status: replicationRun.status })
    await tx.insert(event).values({
      type: 'replication.finished',
      actor: 'system:replication',
      subject: `catala-examples@${sourceCommit}`,
      payload: { kind, sourceCommit, imageDigest: image.digest, runs },
    })
  })
} finally {
  await sql.end()
}

await writeJson('results.json', artifacts)
const notes = results.flatMap((result) => {
  const note = result.diagnostic?.replaceAll(/\s+/g, ' ').replaceAll('`', "'")
  if (note) return [`- \`${result.folder}\` (sortie \`${result.exitCode}\`) — ${note}`]
  if (result.tests === 0) return [`- \`${result.folder}\` — aucun test signalé par Clerk.`]
  return []
})
const header = ['Dossier', 'État', 'Tests comptés', 'Réussis', 'Échoués', 'Durée (s)']
const rows = results.map(({ folder, status, tests, passed, failed, durationMs }) => {
  const state = { passed: tests === 0 ? 'Aucun test' : 'Réussi', failed: 'Échec', error: 'Erreur' }[status]
  return [
    `\`${folder}\``,
    state,
    String(tests ?? '—'),
    String(passed ?? '—'),
    String(failed ?? '—'),
    (durationMs / 1000).toFixed(2),
  ]
})
const widths = header.map((name, column) =>
  Math.max(name.length, ...rows.map((row) => row[column]?.length ?? 0)),
)
const tableRow = (cells: string[], rightAlign = false) => {
  const padded = cells.map((cell, column) => {
    const width = widths[column] ?? 0
    return rightAlign && column >= 2 ? cell.padStart(width) : cell.padEnd(width)
  })
  return `| ${padded.join(' | ')} |`
}
const fence = '```'
const report = [
  '# C0.1 — Rejeu des tests Inria',
  '',
  `Source [catala-examples@${sourceCommit.slice(0, 12)}](${sourceUrl}/tree/${sourceCommit})`,
  '',
  `Catala ${image.catala} · ${image.arch} · \`${image.digest}\``,
  '',
  `${fence}sh`,
  'bun replications/c0.1/run.ts',
  fence,
  '',
  'Prérequis locaux et préparation de l’image dans les [notes Catala](../../docs/notes/catala.md).',
  '',
  tableRow(header),
  tableRow(widths.map((width, column) => (column < 2 ? '-'.repeat(width) : `${'-'.repeat(width - 1)}:`))),
  ...rows.map((row) => tableRow(row, true)),
  '',
  'Le rejeu exécute les dossiers français sélectionnés avec le backend interpréteur, en isolant',
  'les trois suites ASP déclarées par le projet source. Les compteurs reprennent les scopes annotés',
  'et les tests CLI énumérés dans le rapport JSON de Clerk. Si Clerk',
  's’interrompt avant d’émettre son rapport, le dossier est en erreur et le total des tests reste',
  'inconnu. Les lignes à zéro test décrivent uniquement ce que Clerk a compté.',
  '',
  ...notes,
  '',
  `Les sorties brutes sont dans \`${artifacts.rawDirectory}/\` sur la machine du rejeu. Les commandes et`,
  'les résultats par fichier figurent dans [results.json](results.json).',
  '',
].join('\n')
await Bun.write(join(import.meta.dir, 'REPORT.md'), report)
if (results.some((result) => result.status !== 'passed')) process.exitCode = 1
