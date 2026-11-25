import { hashOf } from './certificate.ts'
import type { Candidate, Detector, SweepContext } from './types.ts'
import { detectorId } from './types.ts'

export const CERTIFICATE_SCHEMA = 'bugdeloi/finding-certificate@1'

/** Empreinte stable d'une anomalie : indépendante de la version du détecteur et du lancement. */
export function fingerprintOf(detector: Pick<Detector, 'family'>, c: Candidate): string {
  return hashOf({ type: c.type, family: detector.family, parts: c.fingerprintParts })
}

export interface PinnedState {
  code: string
  text_id: string
  as_of: string
  archive: string
  archive_sha256: string
}

export const pinnedStates = (ctx: SweepContext): PinnedState[] =>
  ctx.codes.map((c) => ({
    code: c.code,
    text_id: c.textId,
    as_of: c.asOf,
    archive: c.archive,
    archive_sha256: c.archiveSha256,
  }))

export function buildCertificate(
  detector: Detector,
  c: Candidate,
  fingerprint: string,
  ctx: SweepContext,
  runId: number | null,
  findingId: string,
) {
  return {
    schema: CERTIFICATE_SCHEMA,
    detector: detectorId(detector),
    type: c.type,
    subtype: c.subtype,
    fingerprint,
    source_id: c.sourceId,
    proof: c.proof,
    proof_sha256: hashOf(c.proof),
    pinned: {
      reading:
        "Dates de projection (« en vigueur à la date ») et lots DILA de l'état de la base au premier balayage qui a vu cette anomalie.",
      legi_state: pinnedStates(ctx),
    },
    provenance: { sweep_run_id: runId, first_seen_at: new Date().toISOString() },
    replay: `bun packages/sweep/src/cli.ts replay ${findingId}`,
    status_note:
      'Candidat non qualifié, calculé sans LLM. Rien ici ne vaut qualification : seul un relecteur humain conclut (AGENTS.md §4.4).',
  }
}

export type Certificate = ReturnType<typeof buildCertificate>
