#!/usr/bin/env bun
/**
 * C0.2 — balayage mécanique du CGI, du CSS et du CCH (détecteurs déterministes, sans LLM).
 *
 *   bun replications/c0.2/run.ts
 *
 * Lance le balayage (idempotent : une anomalie déjà connue garde son identifiant), puis écrit
 * `candidates.json`, `ecarts-lien-texte.json`, `results.json` et `REPORT.md`. L'échantillon de triage
 * (`triage.json`) est un tri par LLM, non probant : `bun replications/c0.2/triage-input.ts` le retire.
 */
import { createDb, finding } from '@bugdeloi/db'
import { collectCandidates, loadContext, runSweep, selectDetectors } from '@bugdeloi/sweep'
import { inArray } from 'drizzle-orm'
import { renderReport, type TriageEntry } from './report.ts'
import { buildResults, summarizeFinding } from './results.ts'

const here = new URL('.', import.meta.url).pathname
const { db, sql } = createDb()
try {
  const detectors = selectDetectors()
  const ctx = await loadContext(db)
  const { results: scans } = collectCandidates(ctx, detectors)
  const summary = await runSweep(db, {})

  const rows = await db
    .select()
    .from(finding)
    .where(
      inArray(
        finding.detector,
        detectors.map((d) => `${d.name}@${d.version}`),
      ),
    )
  const candidates = rows
    .filter((r) => r.status === 'candidate')
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(summarizeFinding)
  const ecarts =
    scans.find((s) => s.detector.name === 'ref-morte-liens')?.result.notes?.ecarts_lien_texte ?? []
  const triage = JSON.parse(await Bun.file(`${here}triage.json`).text()) as TriageEntry[]
  const ids = new Map(candidates.map((c) => [c.fingerprint, c.id]))

  const results = buildResults({ summary, ctx, candidates, ecartsCount: ecarts.length, triage })
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
