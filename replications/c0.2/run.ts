#!/usr/bin/env bun
/**
 * C0.2 — balayage mécanique du CGI, du CSS et du CCH (détecteurs déterministes, sans LLM).
 *
 *   bun replications/c0.2/run.ts
 *
 * Lance le balayage (idempotent : une anomalie déjà connue garde son identifiant), puis écrit
 * `candidates.json`, `ecarts-lien-texte.json`, `results.json` et `REPORT.md`. L'échantillon de triage
 * (`triage.json`) est un tri par LLM, non probant : `bun replications/c0.2/triage-input.ts` en retire les entrées.
 * `--report-only` régénère les fichiers depuis le dernier balayage sans en lancer un nouveau.
 */
import { createDb, finding, sweepRun } from '@bugdeloi/db'
import {
  collectCandidates,
  type DetectorOutcome,
  loadContext,
  type RunSummary,
  runSweep,
  selectDetectors,
} from '@bugdeloi/sweep'
import { and, desc, eq, inArray, or, sql as query } from 'drizzle-orm'
import { renderReport, type TriageEntry } from './report.ts'
import { buildResults, summarizeFinding } from './results.ts'

const here = new URL('.', import.meta.url).pathname
const { db, sql } = createDb()
const started = performance.now()

async function lastRun(): Promise<RunSummary> {
  const [row] = await db
    .select()
    .from(sweepRun)
    .where(eq(sweepRun.status, 'success'))
    .orderBy(desc(sweepRun.id))
    .limit(1)
  if (!row) throw new Error('Aucun balayage enregistré : lancer sans --report-only.')
  return {
    runId: row.id,
    asOf: row.asOf,
    codes: row.codes,
    articlesChecked: row.articlesChecked,
    durationMs: row.durationMs ?? 0,
    outcomes: (row.stats.detectors ?? []) as DetectorOutcome[],
  }
}

try {
  const detectors = selectDetectors()
  const t1 = performance.now()
  const ctx = await loadContext(db)
  const contextMs = Math.round(performance.now() - t1)
  const { results: scans } = collectCandidates(ctx, detectors)
  // --report-only : ne relance pas le balayage, relit le dernier (régénère seulement les fichiers).
  const summary = Bun.argv.includes('--report-only')
    ? await lastRun()
    : await runSweep(db, { context: ctx, contextMs })

  const detectorIds = summary.outcomes.map((d) => d.detector)
  const rows = await db
    .select()
    .from(finding)
    .where(
      or(
        inArray(finding.detector, detectorIds),
        and(
          eq(finding.status, 'withdrawn'),
          query`${finding.certificate}->'withdrawal'->>'reason' = 'detector_fix'`,
          inArray(query`${finding.certificate}->'withdrawal'->>'by'`, detectorIds),
        ),
      ),
    )
    .orderBy(finding.id)
  const candidates = rows.filter((r) => r.status === 'candidate').map(summarizeFinding)
  const reproduced = rows.filter((r) => r.status === 'reproduced').map((r) => r.type)
  const withdrawals = rows.flatMap((r) => {
    const withdrawal = r.certificate.withdrawal as
      | { reason: string; by: string; at: string; note: string }
      | undefined
    return r.status === 'withdrawn' &&
      withdrawal?.reason === 'detector_fix' &&
      detectorIds.includes(withdrawal.by)
      ? [{ id: r.id, type: r.type, ...withdrawal }]
      : []
  })
  const linkNotes = scans.find((s) => s.detector.name === 'ref-morte-liens')?.result.notes
  const ecarts = linkNotes?.ecarts_lien_texte ?? []
  const triage = JSON.parse(await Bun.file(`${here}triage.json`).text()) as TriageEntry[]
  const ids = new Map(
    rows.flatMap((r) =>
      typeof r.certificate.fingerprint === 'string' ? [[r.certificate.fingerprint, r.id]] : [],
    ),
  )

  const results = buildResults({
    summary,
    ctx,
    candidates,
    reproduced,
    withdrawals,
    reassignedCount: linkNotes?.numeros_reattribues?.length ?? 0,
    ecartsCount: ecarts.length,
    triage,
    contextMs,
    scanMs: Object.fromEntries(scans.map((s) => [`${s.detector.name}@${s.detector.version}`, s.durationMs])),
    totalMs: Math.round(performance.now() - started),
    peakRssMb: Math.round(process.resourceUsage().maxRSS / 1024),
  })
  await Bun.write(`${here}candidates.json`, `${JSON.stringify(candidates, null, 1)}\n`)
  await Bun.write(`${here}ecarts-lien-texte.json`, `${JSON.stringify(ecarts, null, 1)}\n`)
  await Bun.write(`${here}results.json`, `${JSON.stringify(results, null, 2)}\n`)
  await Bun.write(`${here}REPORT.md`, renderReport(results, triage, ids))
  Bun.spawnSync([
    'bunx',
    'biome',
    'format',
    '--write',
    `${here}REPORT.md`,
    `${here}results.json`,
    `${here}candidates.json`,
    `${here}ecarts-lien-texte.json`,
  ])
  console.log(
    `balayage ${summary.runId} : ${candidates.length} candidats, ${summary.durationMs} ms ; rapport écrit dans ${here}REPORT.md`,
  )
} finally {
  await sql.end({ timeout: 5 })
}
