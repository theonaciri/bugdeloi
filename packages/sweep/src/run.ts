/**
 * Lancement d'un balayage : charge le contexte, exécute les détecteurs, insère les candidats
 * (dédoublonnés par empreinte), consigne `sweep_run` et l'événement public `sweep.finished`.
 * L'événement ne porte **aucun** nombre de candidats (rien de non qualifié dans un compteur public).
 */
import { type Db, event, finding, findingFingerprint, sweepRun } from '@bugdeloi/db'
import { and, eq, inArray, like, ne, sql } from 'drizzle-orm'
import { buildCertificate, fingerprintOf } from './certificate-builder.ts'
import { loadContext } from './context.ts'
import { DETECTORS } from './detectors/index.ts'
import { type Candidate, type Detector, detectorId, type ScanResult, type SweepContext } from './types.ts'

export interface RunOptions {
  codes?: string[]
  detectors?: string[]
  /** Calcule tout, n'écrit rien en base. */
  dryRun?: boolean
  /** Contexte déjà chargé (évite un second chargement d'environ 500 Mio) et le temps qu'il a pris. */
  context?: SweepContext
  contextMs?: number
}

export interface DetectorOutcome {
  detector: string
  candidates: number
  new: number
  alreadyKnown: number
  durationMs: number
  stats: ScanResult['stats']
  bySubtype: Record<string, number>
}

export interface RunSummary {
  runId: number | null
  asOf: Record<string, string>
  codes: string[]
  articlesChecked: Record<string, number>
  durationMs: number
  outcomes: DetectorOutcome[]
}

export function selectDetectors(names?: string[]): Detector[] {
  if (!names || names.length === 0) return [...DETECTORS]
  return names.map((n) => {
    const d = DETECTORS.find((x) => x.name === n)
    if (!d)
      throw new Error(`Détecteur inconnu : ${n} (disponibles : ${DETECTORS.map((x) => x.name).join(', ')})`)
    return d
  })
}

export interface Collected {
  detector: Detector
  candidate: Candidate
  fingerprint: string
}

/** Exécute les détecteurs en mémoire (aucune écriture) : base du balayage, de l'échantillon de triage et des tests. */
export function collectCandidates(ctx: SweepContext, detectors: Detector[], codes?: ReadonlySet<string>) {
  const out: Collected[] = []
  const results: Array<{ detector: Detector; result: ScanResult; durationMs: number }> = []
  for (const detector of detectors) {
    const t0 = performance.now()
    const result = detector.scan(ctx, { codes })
    results.push({ detector, result, durationMs: Math.round(performance.now() - t0) })
    for (const candidate of result.candidates)
      out.push({ detector, candidate, fingerprint: fingerprintOf(detector, candidate) })
  }
  return { collected: out, results }
}

export async function runSweep(db: Db, options: RunOptions = {}): Promise<RunSummary> {
  const started = performance.now()
  const detectors = selectDetectors(options.detectors)
  const ctx = options.context ?? (await loadContext(db))
  const codes = (options.codes?.length ? options.codes : ctx.codes.map((c) => c.code)).map((c) =>
    c.toUpperCase(),
  )
  for (const c of codes) if (!ctx.codes.some((k) => k.code === c)) throw new Error(`Code non ingéré : ${c}`)
  const codeSet = new Set(codes)

  let runId: number | null = null
  if (!options.dryRun) {
    const [row] = await db
      .insert(sweepRun)
      .values({
        codes,
        detectors: Object.fromEntries(detectors.map((d) => [d.name, d.version])),
        asOf: Object.fromEntries(ctx.codes.filter((c) => codeSet.has(c.code)).map((c) => [c.code, c.asOf])),
        archives: Object.fromEntries(
          ctx.codes
            .filter((c) => codeSet.has(c.code))
            .map((c) => [c.code, { archive: c.archive, sha256: c.archiveSha256 }]),
        ),
      })
      .returning({ id: sweepRun.id })
    runId = row?.id ?? null
  }

  try {
    const articlesChecked: Record<string, number> = {}
    for (const v of ctx.inForce)
      if (codeSet.has(v.code)) articlesChecked[v.code] = (articlesChecked[v.code] ?? 0) + 1

    const scans = detectors.map((detector) => {
      const t0 = performance.now()
      const result = detector.scan(ctx, { codes: codeSet })
      const durationMs = Math.round(performance.now() - t0)
      const bySubtype: Record<string, number> = {}
      for (const c of result.candidates) bySubtype[c.subtype] = (bySubtype[c.subtype] ?? 0) + 1
      const outcome: DetectorOutcome = {
        detector: detectorId(detector),
        candidates: result.candidates.length,
        new: 0,
        alreadyKnown: 0,
        durationMs,
        stats: result.stats,
        bySubtype,
      }
      return { detector, result, outcome }
    })

    const asOf = Object.fromEntries(ctx.codes.filter((c) => codeSet.has(c.code)).map((c) => [c.code, c.asOf]))
    const elapsed = () =>
      Math.round(performance.now() - started) + (options.context ? (options.contextMs ?? 0) : 0)
    const outcomes = scans.map(({ outcome }) => outcome)
    const summary: RunSummary = { runId, asOf, codes, articlesChecked, durationMs: elapsed(), outcomes }
    if (runId !== null) {
      const id = runId
      await db.transaction(async (tx) => {
        await lockFindings(tx)
        for (const { detector, result, outcome } of scans) {
          const withFp = prepareCandidates(detector, result.candidates)
          await reconcileVersion(tx, ctx, detector, new Set(withFp.map(({ fp }) => fp)), codeSet)
          const persisted = await insertCandidates(tx, ctx, detector, withFp, id)
          outcome.new = persisted.added
          outcome.alreadyKnown = persisted.known
        }
        summary.durationMs = elapsed()
        await tx
          .update(sweepRun)
          .set({
            status: 'success',
            finishedAt: new Date(),
            articlesChecked,
            durationMs: summary.durationMs,
            stats: { detectors: outcomes },
          })
          .where(eq(sweepRun.id, id))
        const total = Object.values(articlesChecked).reduce((a, b) => a + b, 0)
        await tx.insert(event).values({
          type: 'sweep.finished',
          actor: 'system:sweep',
          subject: String(runId),
          payload: {
            summary: `Balayage mécanique n° ${runId} : ${total} articles en vigueur contrôlés (${codes.join(', ')}), ${detectors.length} détecteurs.`,
            runId,
            codes,
            detectors: Object.fromEntries(detectors.map((d) => [d.name, d.version])),
            asOf,
            articlesChecked,
          },
        })
      })
    }
    return summary
  } catch (error) {
    if (runId !== null) {
      await db
        .update(sweepRun)
        .set({
          status: 'failed',
          finishedAt: new Date(),
          error: error instanceof Error ? error.message : String(error),
        })
        .where(eq(sweepRun.id, runId))
    }
    throw error
  }
}

const BATCH = 200
type SweepTransaction = Parameters<Parameters<Db['transaction']>[0]>[0]

function lockFindings(tx: SweepTransaction) {
  return tx.execute(sql`select pg_advisory_xact_lock(hashtext('bugdeloi.finding.id'))`)
}

/** Réconcilie uniquement les versions antérieures et les sources du périmètre balayé. */
async function reconcileVersion(
  tx: SweepTransaction,
  ctx: SweepContext,
  detector: Detector,
  produced: ReadonlySet<string>,
  codes: ReadonlySet<string>,
) {
  const current = detectorId(detector)
  const prefix = `${detector.name}@`
  const rows = await tx
    .select({ row: finding, fp: findingFingerprint.fingerprint })
    .from(finding)
    .innerJoin(findingFingerprint, eq(findingFingerprint.findingId, finding.id))
    .where(and(like(finding.detector, `${prefix}%`), ne(finding.detector, current)))
    .for('update', { of: finding })
  const at = new Date()
  const protectedMissing: string[] = []
  const retained: string[] = []
  for (const { row, fp } of rows) {
    const version = row.detector.slice(prefix.length)
    if (!/^\d+\.\d+\.\d+$/.test(version) || Bun.semver.order(version, detector.version) >= 0) continue
    const sourceId = row.certificate.source_id
    const source = typeof sourceId === 'string' ? ctx.versions.get(sourceId) : undefined
    // La version source peut être absente du stock courant. Le certificat en conserve le code.
    const proof = row.certificate.proof as
      | { source?: { code?: string }; versions?: { code?: string }[] }
      | undefined
    const code = source?.code ?? proof?.source?.code ?? proof?.versions?.[0]?.code
    if (!code || !codes.has(code)) continue

    const present = produced.has(fp)
    if (row.status === 'qualified' || row.status === 'published' || row.status === 'rejected') {
      if (!present) protectedMissing.push(`${row.id} (${row.status})`)
      continue
    }
    if (row.status !== 'candidate' && row.status !== 'reproduced') continue
    if (present) {
      retained.push(row.id)
      continue
    }
    await tx
      .update(finding)
      .set({
        status: 'withdrawn',
        updatedAt: at,
        certificate: {
          ...row.certificate,
          withdrawal: {
            reason: 'detector_fix',
            by: current,
            at: at.toISOString(),
            note: `Empreinte produite par ${row.detector}, absente du balayage de ${current}.`,
          },
        },
      })
      .where(eq(finding.id, row.id))
  }
  if (protectedMissing.length > 0) {
    throw new Error(
      `Balayage bloqué : ${current} ne reproduit plus les findings protégés suivants : ${protectedMissing.sort().join(', ')}.`,
    )
  }
  for (let i = 0; i < retained.length; i += 1000) {
    await tx
      .update(finding)
      .set({ detector: current, updatedAt: at })
      .where(inArray(finding.id, retained.slice(i, i + 1000)))
  }
}

function prepareCandidates(detector: Detector, candidates: Candidate[]) {
  return candidates
    .map((c) => ({ c, fp: fingerprintOf(detector, c) }))
    .sort(
      (a, b) =>
        a.c.type.localeCompare(b.c.type) ||
        a.c.subtype.localeCompare(b.c.subtype) ||
        a.c.sourceId.localeCompare(b.c.sourceId) ||
        a.fp.localeCompare(b.fp),
    )
}

/**
 * Insère les candidats absents de `finding_fingerprint`. Numérotation F-AAAA-NNNN attribuée sous
 * verrou consultatif, dans un ordre déterministe (type, sous-type, version source, empreinte).
 */
export async function persistCandidates(
  db: Db,
  ctx: SweepContext,
  detector: Detector,
  candidates: Candidate[],
  runId: number | null,
): Promise<{ added: number; known: number }> {
  return db.transaction(async (tx) => {
    await lockFindings(tx)
    return insertCandidates(tx, ctx, detector, prepareCandidates(detector, candidates), runId)
  })
}

async function insertCandidates(
  tx: SweepTransaction,
  ctx: SweepContext,
  detector: Detector,
  withFp: ReturnType<typeof prepareCandidates>,
  runId: number | null,
): Promise<{ added: number; known: number }> {
  const known = new Set<string>()
  for (let i = 0; i < withFp.length; i += 1000) {
    const slice = withFp.slice(i, i + 1000).map((x) => x.fp)
    const rows = await tx
      .select({ fingerprint: findingFingerprint.fingerprint })
      .from(findingFingerprint)
      .where(inArray(findingFingerprint.fingerprint, slice))
    for (const r of rows) known.add(r.fingerprint)
  }
  const fresh = withFp.filter((x) => !known.has(x.fp))
  if (fresh.length === 0) return { added: 0, known: known.size }

  const year = new Date().getUTCFullYear()
  const [row] = await tx.execute<{ n: number }>(
    sql`select coalesce(max(substring(id from '^F-[0-9]+-([0-9]+)$')::int), 0) as n from finding where id like ${`F-${year}-%`}`,
  )
  let next = Number(row?.n ?? 0)
  for (let i = 0; i < fresh.length; i += BATCH) {
    const slice = fresh.slice(i, i + BATCH)
    const rows = slice.map(({ c, fp }) => {
      next += 1
      const id = `F-${year}-${String(next).padStart(4, '0')}`
      return { id, fp, c, certificate: buildCertificate(detector, c, fp, ctx, runId, id) }
    })
    await tx.insert(finding).values(
      rows.map((r) => ({
        id: r.id,
        type: r.c.type,
        status: 'candidate',
        claim: r.c.claim,
        legalUnits: r.c.legalUnits,
        certificate: r.certificate as unknown as Record<string, unknown>,
        detector: detectorId(detector),
      })),
    )
    await tx.insert(findingFingerprint).values(rows.map((r) => ({ fingerprint: r.fp, findingId: r.id })))
  }
  return { added: fresh.length, known: known.size }
}
