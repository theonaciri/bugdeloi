import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createDb, DEFAULT_DATABASE_URL } from '@bugdeloi/db'
import { event, finding } from '@bugdeloi/db/schema'
import { and, eq, inArray, or, sql } from 'drizzle-orm'
import { check, date, object, type Result, types, verdicts } from './checks.ts'
import { codes, loadCorpus, sources } from './tricoteuses.ts'

const checker = 'c0.2-independent@1.0.0'
const agent = 'codex/gpt-6.2-sol'
const source = 'tricoteuses/la-loi-sous-git'
const reportPath = fileURLToPath(new URL('results.json', import.meta.url))
const reportFile = Bun.file(reportPath)
const commit = Object.fromEntries(codes.map((code) => [code, sources[code].commit]))

function digest(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

async function run(args: string[]) {
  const apply = args[0] === '--apply'
  if (args.length > Number(apply))
    throw new Error('Usage : bun replications/c0.2-independent/run.ts [--apply]')
  const corpus = loadCorpus()
  const { db, sql: connection } = createDb(DEFAULT_DATABASE_URL)
  const readBatch = async () =>
    db.transaction(
      (tx) =>
        tx
          .select({
            id: finding.id,
            type: finding.type,
            certificate: sql<Record<string, unknown>>`${finding.certificate} - 'independent_reproduction'`,
          })
          .from(finding)
          .where(
            and(
              inArray(finding.type, types),
              sql`${finding.certificate}->>'schema' = 'bugdeloi/finding-certificate@1'`,
              or(
                eq(finding.status, 'candidate'),
                sql`${finding.certificate}#>>'{independent_reproduction,checker}' = ${checker}`,
              ),
            ),
          )
          .orderBy(finding.id),
      { accessMode: 'read only' },
    )

  try {
    const input = await readBatch()
    if (!input.length) throw new Error('Aucun candidat C0.2 en base.')
    const results = input.map(({ id, type, certificate }) => {
      const supported = types.find((item) => item === type)
      if (!supported) throw new Error(`Type inattendu : ${type}`)
      return check(id, supported, certificate, corpus)
    })
    const counts = (items: Result[]) =>
      Object.fromEntries(
        verdicts.map((verdict) => [verdict, items.filter((result) => result.verdict === verdict).length]),
      )
    const totals = counts(results)
    const report = {
      date,
      checker,
      agent,
      sources,
      input_sha256: digest(input),
      totaux: totals,
      par_type: Object.fromEntries(
        types.map((type) => [type, counts(results.filter((item) => type === item.type))]),
      ),
      resultats: results,
    }
    if (!apply) {
      const formatted = Bun.spawnSync(
        [process.execPath, 'x', '--no-install', 'biome', 'format', '--stdin-file-path', reportPath],
        {
          cwd: fileURLToPath(new URL('../../', import.meta.url)),
          stdin: Buffer.from(JSON.stringify(report)),
          stdout: 'pipe',
          stderr: 'pipe',
        },
      )
      if (formatted.exitCode !== 0) throw new Error(formatted.stderr.toString())
      await Bun.write(reportFile, formatted.stdout)
      console.log(report.par_type)
      return
    }

    if (digest(JSON.parse(await reportFile.text())) !== digest(report)) {
      throw new Error('Les résultats du rejeu diffèrent de results.json. Écriture annulée.')
    }
    const subject = `c0.2-independent:${digest(report)}`
    const checked_at = new Date().toISOString()
    const changed = await db.transaction(async (tx) => {
      // Sérialise deux applications de cette commande, y compris l’ajout au journal append-only.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('bugdeloi:c0.2-independent'))`)
      const locked = await tx
        .select({ id: finding.id, certificate: finding.certificate, status: finding.status })
        .from(finding)
        .where(
          inArray(
            finding.id,
            results.map((item) => item.id),
          ),
        )
        .orderBy(finding.id)
        .for('update')
      if (locked.length !== input.length) throw new Error('La liste des findings a changé. Écriture annulée.')
      let updated = 0
      for (const [index, item] of locked.entries()) {
        const expected = input[index]
        const result = results[index]
        const { independent_reproduction: previous, ...original } = item.certificate
        if (
          !expected ||
          !result ||
          item.id !== expected.id ||
          digest(original) !== digest(expected.certificate)
        ) {
          throw new Error(`Le certificat ${item.id} a changé. Écriture annulée.`)
        }
        const stamp = { source, commit, checked_at, verdict: result.verdict, checker, agent }
        if (Object.hasOwn(item.certificate, 'independent_reproduction')) {
          const existing = object(previous)
          if (
            existing.source !== source ||
            existing.checker !== checker ||
            existing.agent !== agent ||
            existing.verdict !== result.verdict ||
            !codes.every((code) => object(existing.commit)[code] === commit[code]) ||
            typeof existing.checked_at !== 'string' ||
            (result.verdict === 'confirmé' && item.status === 'candidate')
          ) {
            throw new Error(`Annotation concurrente pour ${item.id}. Écriture annulée.`)
          }
          continue
        }
        if (item.status !== 'candidate') throw new Error(`Statut modifié pour ${item.id}. Écriture annulée.`)
        await tx
          .update(finding)
          .set({
            certificate: { ...original, independent_reproduction: stamp },
            ...(result.verdict === 'confirmé' ? { status: 'reproduced' } : {}),
          })
          .where(eq(finding.id, item.id))
        updated++
      }
      const [recorded] = await tx
        .select({ id: event.id })
        .from(event)
        .where(and(eq(event.type, 'reproduction.finished'), eq(event.subject, subject)))
        .limit(1)
      if (!recorded) {
        await tx
          .insert(event)
          .values({ type: 'reproduction.finished', subject, actor: agent, payload: totals })
      }
      return { updated, eventAdded: !recorded }
    })
    console.log({ ...changed, totals })
  } finally {
    await connection.end()
  }
}

if (import.meta.main) await run(process.argv.slice(2))
