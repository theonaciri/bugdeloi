/**
 * C0.2 — reproduction indépendante n° 2 des candidats REF_MORTE depuis les archives XML brutes de la DILA.
 *
 *   bun replications/c0.2-dila-xml/run.ts            # calcule, écrit results.json et summary.json (base en lecture seule)
 *   bun replications/c0.2-dila-xml/run.ts --apply    # recalcule, compare à results.json, écrit les verdicts en base
 *
 * Options : --dir <cache DILA> (défaut ~/.cache/bugdeloi/dila), --until <horodatage du dernier incrément>.
 * Méthode et limites : REPORT.md. Ce programme n'utilise ni l'ingestion ni le balayage du dépôt.
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createSql } from '@bugdeloi/db'
import {
  type ArchiveInfo,
  type ArchiveStats,
  applyArchive,
  type LegiState,
  verifyArchive,
} from './archive.ts'
import {
  type Candidate,
  type CheckResult,
  candidateFromCertificate,
  checkCandidate,
  LegiIndex,
  type Verdict,
} from './checks.ts'
import { TERMINAL_STATES } from './legi-xml.ts'

export const CHECKER = 'c0.2-dila-xml@1.0.0'
export const AGENT = 'claude/claude-opus-5-5'
export const REF_DATE = '2026-11-25'
const DEFAULT_UNTIL = '20261124-221545'
const HERE = import.meta.dir

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const log = (s: string) => console.error(`[c0.2-dila-xml] ${s}`)

async function listArchives(dir: string, until: string): Promise<string[]> {
  const names = [...new Bun.Glob('*.tar.gz').scanSync({ cwd: dir })].sort()
  const stocks = names.filter((n) => /^Freemium_legi_global_\d{8}-\d{6}\.tar\.gz$/.test(n))
  const stock = stocks.at(-1)
  if (!stock) throw new Error(`aucun stock Freemium_legi_global_*.tar.gz dans ${dir}`)
  const stockTs = stock.match(/(\d{8}-\d{6})/)?.[1] ?? ''
  const incs = names
    .filter((n) => /^LEGI_\d{8}-\d{6}\.tar\.gz$/.test(n))
    .filter((n) => {
      const ts = n.slice(5, 20)
      return ts > stockTs && ts <= until
    })
  return [stock, ...incs].map((n) => join(dir, n))
}

interface Row {
  id: string
  detector: string
  status: string
  certificate: Record<string, unknown>
}

async function main() {
  const apply = process.argv.includes('--apply')
  const dir = arg('--dir') ?? join(homedir(), '.cache/bugdeloi/dila')
  const until = arg('--until') ?? DEFAULT_UNTIL
  const t0 = performance.now()

  // 1. Archives et empreintes
  const paths = await listArchives(dir, until)
  log(`${paths.length} archives (1 stock + ${paths.length - 1} incréments), vérification des SHA-256…`)
  const archives: ArchiveInfo[] = []
  for (const p of paths) {
    const info = await verifyArchive(p)
    if (info.expected !== info.sha256) {
      throw new Error(`${info.name} : SHA-256 ${info.sha256} ≠ attendu ${info.expected ?? '(absent)'}`)
    }
    archives.push(info)
  }

  // 2. Candidats (lecture seule)
  const sql = createSql(undefined, { max: 2 })
  const rows = (await sql.begin('read only', async (tx) => {
    return await tx`
      select id, detector, status, certificate from finding
      where type = 'REF_MORTE'
        and (status in ('candidate', 'withdrawn') or certificate ? 'independent_reproduction_dila_xml')
      order by id`
  })) as unknown as Row[]
  const candidates: Candidate[] = []
  /** Témoins négatifs : REF_MORTE déjà retirés (numéro réattribué) ; jamais écrits en base. */
  const controls: Candidate[] = []
  const unreadable: string[] = []
  for (const r of rows) {
    const c = candidateFromCertificate(r.id, r.detector, r.certificate)
    if (!c) unreadable.push(r.id)
    else if (r.status === 'withdrawn' && !r.certificate.independent_reproduction_dila_xml) controls.push(c)
    else candidates.push(c)
  }
  log(`${candidates.length} candidats REF_MORTE lus (${unreadable.length} certificats illisibles)`)
  const sourceIds = new Set([...candidates, ...controls].map((c) => c.sourceId))

  // 3. Lecture en flux
  const state: LegiState = new Map()
  const archiveStats: ArchiveStats[] = []
  for (const p of paths) archiveStats.push(await applyArchive(p, state, sourceIds, log))

  // 4. Index (un identifiant présent sous deux chemins : on garde la dernière écriture)
  const latest = new Map<string, { seq: number; key: string }>()
  let duplicatePaths = 0
  for (const [key, s] of state) {
    const prev = latest.get(s.rec.id)
    if (prev) duplicatePaths++
    if (!prev || s.seq > prev.seq) latest.set(s.rec.id, { seq: s.seq, key })
  }
  const idx = new LegiIndex()
  const etats: Record<string, number> = {}
  const perCode: Record<string, number> = {}
  /** Versions dont l'état et les dates se contredisent à la date de référence (constat, pas un verdict). */
  const incoherent = {
    vigueur_fin_echue: 0,
    vigueur_diff_debut_passe: 0,
    modifie_fin_ouverte: 0,
    terminal_fin_future: 0,
  }
  for (const { key } of latest.values()) {
    const s = state.get(key)
    if (!s) continue
    idx.add(s.rec, s.code)
    etats[s.rec.etat] = (etats[s.rec.etat] ?? 0) + 1
    const r = s.rec
    if (r.etat === 'VIGUEUR' && r.fin <= REF_DATE) incoherent.vigueur_fin_echue++
    if (r.etat === 'VIGUEUR_DIFF' && r.debut <= REF_DATE) incoherent.vigueur_diff_debut_passe++
    if (r.etat === 'MODIFIE' && r.fin === '2999-01-01') incoherent.modifie_fin_ouverte++
    if (TERMINAL_STATES.has(r.etat) && r.etat !== 'MODIFIE_MORT_NE' && r.fin > REF_DATE)
      incoherent.terminal_fin_future++
    perCode[s.code] = (perCode[s.code] ?? 0) + 1
  }
  idx.finish()
  log(`${idx.files.size} versions d'articles indexées ; ${duplicatePaths} identifiants sous deux chemins`)

  // 5. Verdicts
  const results: CheckResult[] = candidates.map((c) => checkCandidate(c, idx, REF_DATE))
  const controlResults = controls.map((c) => checkCandidate(c, idx, REF_DATE))
  for (const r of controlResults) log(`témoin ${r.id} : ${r.verdict} — ${r.reason}`)

  // Suppressions annoncées : versions absentes du stock, mais encore citées par des blocs VERSIONS ?
  const deletedIds = [...new Set(archiveStats.flatMap((s) => s.deletedIds))].sort()
  const deletedStillReferenced = deletedIds.filter((id) => idx.knows(id) && !idx.files.has(id))
  const deletedInTargets = results.filter((r) =>
    [...(r.facts.target_in_force ?? []), ...(r.facts.target_last ? [r.facts.target_last] : [])].some((v) =>
      deletedIds.includes(v.id),
    ),
  ).length

  const dump = process.env.C02_DUMP_NUMS
  if (dump) {
    const [code, prefix] = dump.split(':') as [string, string]
    for (const n of idx.numsStartingWith(code as 'CGI', prefix)) {
      const ids = idx.idsWithNum(code as 'CGI', n)
      log(
        `n° ${code} ${n} : ${ids
          .map((id) => {
            const f = idx.facts(id)
            return `${id} ${f?.etat} ${f?.debut}→${f?.fin} (${f?.from})`
          })
          .join(' ; ')}`,
      )
    }
  }
  const elapsedMs = Math.round(performance.now() - t0)

  const verdicts: Verdict[] = ['confirmé', 'infirmé', 'indéterminé']
  const zero = () => Object.fromEntries(verdicts.map((v) => [v, 0])) as Record<Verdict, number>
  const totals = zero()
  const bySubtype: Record<string, Record<Verdict, number>> = {}
  const byDetector: Record<string, Record<Verdict, number>> = {}
  const excerptMatch: Record<string, number> = {}
  for (const r of results) {
    totals[r.verdict]++
    bySubtype[r.subtype] ??= zero()
    ;(bySubtype[r.subtype] as Record<Verdict, number>)[r.verdict]++
    byDetector[r.detector] ??= zero()
    ;(byDetector[r.detector] as Record<Verdict, number>)[r.verdict]++
    const m = r.facts.excerpt_match ?? 'non_contrôlé'
    excerptMatch[m] = (excerptMatch[m] ?? 0) + 1
  }
  const linkCheck = { present: 0, absent: 0, sans_objet: 0 }
  for (const r of results) {
    const v = r.facts.source_has_legi_link_to_target
    if (v === true) linkCheck.present++
    else if (v === false) linkCheck.absent++
    else linkCheck.sans_objet++
  }

  const summary = {
    checker: CHECKER,
    agent: AGENT,
    reference_date: REF_DATE,
    source: 'dila/legi-xml',
    archives: archives.map((a) => ({ name: a.name, sha256: a.sha256 })),
    corpus: {
      article_versions: idx.files.size,
      by_code: perCode,
      by_etat: etats,
      versions_meta_conflicts: idx.metaConflicts,
      ids_under_two_paths: duplicatePaths,
      deletions_in_codes: archiveStats.reduce((n, s) => n + s.deletionsInCodes, 0),
      deletions_applied: archiveStats.reduce((n, s) => n + s.deletionsApplied, 0),
      deleted_and_written_same_archive: archiveStats.reduce((n, s) => n + s.deletedButWrittenSameArchive, 0),
      dir_deletions_in_codes: archiveStats.reduce((n, s) => n + s.dirDeletionsInCodes, 0),
      parse_failures: archiveStats.reduce((n, s) => n + s.parseFailures, 0),
      state_date_inconsistencies: incoherent,
      deleted_ids_distinct: deletedIds.length,
      deleted_ids_still_in_versions_blocks: deletedStillReferenced.length,
      candidates_touching_deleted_ids: deletedInTargets,
    },
    negative_controls: controlResults.map((r) => ({ id: r.id, verdict: r.verdict, reason: r.reason })),
    candidates: candidates.length,
    unreadable_certificates: unreadable.length,
    totals,
    by_subtype: bySubtype,
    by_detector: byDetector,
    excerpt_match: excerptMatch,
    source_legi_link_to_target: linkCheck,
  }

  const resultsPath = join(HERE, 'results.json')
  const summaryPath = join(HERE, 'summary.json')

  if (!apply) {
    await Bun.write(
      resultsPath,
      `${JSON.stringify({ ...summary, elapsed_ms: elapsedMs, archive_stats: archiveStats, unreadable, results }, null, 2)}\n`,
    )
    await Bun.write(summaryPath, `${JSON.stringify(summary, null, 2)}\n`)
    log(`écrit ${resultsPath} et ${summaryPath} (${elapsedMs} ms)`)
    log(`totaux : ${JSON.stringify(totals)}`)
    for (const r of results.filter((x) => x.verdict === 'infirmé')) log(`infirmé ${r.id} : ${r.reason}`)
    await sql.end()
    return
  }

  // 6. --apply : le calcul doit redonner exactement les verdicts enregistrés
  const saved = (await Bun.file(resultsPath).json()) as { results: CheckResult[] }
  const savedMap = new Map(saved.results.map((r) => [r.id, `${r.verdict}|${r.reason}`]))
  const drift = results.filter((r) => savedMap.get(r.id) !== `${r.verdict}|${r.reason}`)
  if (drift.length > 0 || saved.results.length !== results.length) {
    throw new Error(`le recalcul diffère de results.json (${drift.length} écarts) : relancer sans --apply`)
  }
  const checkedAt = new Date().toISOString()
  const archiveList = archives.map((a) => ({ name: a.name, sha256: a.sha256 }))
  const applied = {
    reproduced: 0,
    withdrawn: 0,
    annotated_only: 0,
    skipped_already_done: 0,
    skipped_foreign: 0,
  }
  await sql.begin(async (tx) => {
    for (const r of results) {
      const row = rows.find((x) => x.id === r.id)
      const existing = row?.certificate.independent_reproduction_dila_xml as
        | Record<string, unknown>
        | undefined
      if (existing) {
        if (existing.checker === CHECKER) applied.skipped_already_done++
        else applied.skipped_foreign++
        continue
      }
      if (row?.status !== 'candidate') continue
      const note = {
        source: 'dila/legi-xml',
        archives: archiveList,
        reference_date: REF_DATE,
        checked_at: checkedAt,
        verdict: r.verdict,
        reason: r.reason,
        checker: CHECKER,
        agent: AGENT,
      }
      if (r.verdict === 'confirmé') {
        const n = await tx`
          update finding
             set certificate = certificate || jsonb_build_object('independent_reproduction_dila_xml', ${tx.json(note)}::jsonb),
                 status = 'reproduced'
           where id = ${r.id} and type = 'REF_MORTE' and status = 'candidate'
             and not certificate ? 'independent_reproduction_dila_xml'`
        applied.reproduced += n.count
      } else if (r.verdict === 'infirmé') {
        const withdrawal = { reason: 'independent_reproduction', by: CHECKER, at: checkedAt, note: r.reason }
        const n = await tx`
          update finding
             set certificate = certificate
                   || jsonb_build_object('independent_reproduction_dila_xml', ${tx.json(note)}::jsonb)
                   || jsonb_build_object('withdrawal', ${tx.json(withdrawal)}::jsonb),
                 status = 'withdrawn'
           where id = ${r.id} and type = 'REF_MORTE' and status = 'candidate'
             and not certificate ? 'independent_reproduction_dila_xml'`
        applied.withdrawn += n.count
      } else {
        const n = await tx`
          update finding
             set certificate = certificate || jsonb_build_object('independent_reproduction_dila_xml', ${tx.json(note)}::jsonb)
           where id = ${r.id} and type = 'REF_MORTE' and status = 'candidate'
             and not certificate ? 'independent_reproduction_dila_xml'`
        applied.annotated_only += n.count
      }
    }
    const subject = `c0.2-dila-xml:${new Bun.CryptoHasher('sha256').update(JSON.stringify(results.map((r) => [r.id, r.verdict]))).digest('hex')}`
    const already =
      await tx`select 1 from event where type = 'reproduction.finished' and subject = ${subject} limit 1`
    if (already.length === 0 && applied.reproduced + applied.withdrawn + applied.annotated_only > 0) {
      await tx`insert into event (type, actor, subject, payload)
               values ('reproduction.finished', ${AGENT}, ${subject}, ${tx.json(totals)})`
    }
  })
  log(`base : ${JSON.stringify(applied)}`)
  await sql.end()
}

if (import.meta.main) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
