/**
 * Prépare l'échantillon de triage : tire 30 candidats (graine fixée, strates) et écrit pour chacun
 * ce qu'il faut pour le lire sans ouvrir la base. Usage : bun replications/c0.2/triage-input.ts [sortie.json]
 */
import { createDb } from '@bugdeloi/db'
import { collectCandidates, loadContext, selectDetectors } from '@bugdeloi/sweep'
import { drawSample } from './sample.ts'

export const SEED = 20261125
export const QUOTAS: Record<string, number> = {
  liens: 8,
  texte: 12,
  numerotation: 2,
  syntaxe: 8,
}

export function stratumOf(detector: string, _subtype: string): string {
  if (detector === 'ref-morte-liens') return 'liens'
  if (detector === 'ref-morte-texte') return 'texte'
  return detector
}

if (import.meta.main) {
  const { db, sql } = createDb()
  try {
    const ctx = await loadContext(db)
    const { collected } = collectCandidates(ctx, selectDetectors())
    const items = collected.map((c) => ({ ...c, stratum: stratumOf(c.detector.name, c.candidate.subtype) }))
    const sample = drawSample(items, QUOTAS, SEED)
    const out = sample.map((s) => ({
      fingerprint: s.fingerprint,
      stratum: s.stratum,
      detector: `${s.detector.name}@${s.detector.version}`,
      type: s.candidate.type,
      subtype: s.candidate.subtype,
      claim: s.candidate.claim,
      proof: s.candidate.proof,
    }))
    await Bun.write(Bun.argv[2] ?? 'triage-input.json', JSON.stringify(out, null, 1))
    console.log(`${out.length} candidats tirés (graine ${SEED})`)
  } finally {
    await sql.end()
  }
}
