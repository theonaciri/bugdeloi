/**
 * Rejeu d'un finding : recalcule la preuve depuis la base et la compare à celle du certificat.
 * Le détecteur appliqué est celui du dépôt courant ; si sa version diffère de celle du certificat,
 * le rejeu le dit (la comparaison reste faite).
 */
import { type Db, finding } from '@bugdeloi/db'
import { eq } from 'drizzle-orm'
import { canonicalJson, hashOf } from './certificate.ts'
import { fingerprintOf, pinnedStates } from './certificate-builder.ts'
import { loadContext } from './context.ts'
import { detectorByName } from './detectors/index.ts'
import { detectorId } from './types.ts'

export type ReplayVerdict = 'identique' | 'différente' | 'introuvable'

export interface ReplayResult {
  id: string
  verdict: ReplayVerdict
  detector: { stored: string; current: string | null; sameVersion: boolean }
  legiState: { same: boolean; stored: unknown; current: unknown }
  storedProofSha256: string | null
  recomputedProofSha256: string | null
  /** Chemins (notation pointée) où la preuve recalculée diffère de la preuve stockée. */
  differences: string[]
  note: string
}

function diffPaths(a: unknown, b: unknown, path = '', out: string[] = []): string[] {
  if (out.length >= 25) return out
  if (canonicalJson(a) === canonicalJson(b)) return out
  const isObj = (x: unknown): x is Record<string, unknown> =>
    x !== null && typeof x === 'object' && !Array.isArray(x)
  if (isObj(a) && isObj(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)]))
      diffPaths(a[k], b[k], path ? `${path}.${k}` : k, out)
  } else if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) diffPaths(a[i], b[i], `${path}[${i}]`, out)
  } else out.push(path || '(racine)')
  return out
}

export async function replayFinding(db: Db, id: string): Promise<ReplayResult> {
  const [row] = await db.select().from(finding).where(eq(finding.id, id)).limit(1)
  if (!row) throw new Error(`Finding inconnu : ${id}`)
  const cert = row.certificate as {
    schema?: string
    detector?: string
    source_id?: string
    fingerprint?: string
    proof?: Record<string, unknown>
    proof_sha256?: string
    pinned?: { legi_state?: unknown }
  }
  const stored = row.detector
  const name = stored.split('@')[0] ?? stored
  const detector = detectorByName(name)
  const base = {
    id,
    detector: {
      stored,
      current: detector ? detectorId(detector) : null,
      sameVersion: detector ? detectorId(detector) === stored : false,
    },
    storedProofSha256: cert.proof_sha256 ?? null,
  }
  if (!detector || !cert.source_id || !cert.fingerprint || !cert.proof) {
    return {
      ...base,
      verdict: 'introuvable',
      legiState: { same: false, stored: cert.pinned?.legi_state ?? null, current: null },
      recomputedProofSha256: null,
      differences: [],
      note: !detector
        ? `Détecteur « ${name} » absent de ce dépôt.`
        : 'Certificat sans source_id, empreinte ou preuve.',
    }
  }
  const ctx = await loadContext(db)
  const result = detector.scan(ctx, { only: new Set([cert.source_id]) })
  const match = result.candidates.find((c) => fingerprintOf(detector, c) === cert.fingerprint)
  const current = pinnedStates(ctx)
  const legiState = {
    same: canonicalJson(current) === canonicalJson(cert.pinned?.legi_state ?? null),
    stored: cert.pinned?.legi_state ?? null,
    current,
  }
  if (!match) {
    return {
      ...base,
      verdict: 'introuvable',
      legiState,
      recomputedProofSha256: null,
      differences: [],
      note: legiState.same
        ? 'Le détecteur ne produit plus cette anomalie sur une base pourtant identique (changement de détecteur ?).'
        : 'Le détecteur ne produit plus cette anomalie : la base a changé depuis le certificat (nouveau lot DILA : version modifiée, article abrogé ou corrigé).',
    }
  }
  const recomputed = hashOf(match.proof)
  const same = recomputed === cert.proof_sha256
  return {
    ...base,
    verdict: same ? 'identique' : 'différente',
    legiState,
    recomputedProofSha256: recomputed,
    differences: same ? [] : diffPaths(cert.proof, match.proof),
    note: same
      ? legiState.same
        ? 'La preuve recalculée depuis la base est identique, à la même date de projection et au même lot DILA.'
        : 'La preuve recalculée est identique, mais la base a avancé (date de projection ou lot DILA différent).'
      : 'La preuve recalculée diffère de celle du certificat (voir les chemins).',
  }
}
