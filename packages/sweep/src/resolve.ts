/**
 * Résolution commune aux détecteurs : état d'un article (lignée) à la date de projection.
 */

import { normalizeNum } from './citations.ts'
import type { Lineage, SweepContext } from './types.ts'

const SUBTYPE_BY_ETAT: Record<string, string> = {
  ABROGE: 'abrogé',
  TRANSFERE: 'transféré',
  PERIME: 'périmé',
  DISJOINT: 'disjoint',
  ANNULE: 'annulé',
  DEPLACE: 'déplacé',
}

export function deadSubtype(l: Lineage): string {
  return SUBTYPE_BY_ETAT[l.last.etat ?? ''] ?? `autre:${l.last.etat ?? 'sans_état'}`
}

export function statusOf(lineages: Lineage[]): {
  cls: 'vivante' | 'a_venir' | 'morte'
  lineage: Lineage
  alternates: Lineage[]
} {
  const alive = lineages.find((l) => l.inForce.length > 0)
  if (alive) return { cls: 'vivante', lineage: alive, alternates: lineages.filter((l) => l !== alive) }
  const upcoming = lineages.find((l) => l.upcoming)
  if (upcoming)
    return { cls: 'a_venir', lineage: upcoming, alternates: lineages.filter((l) => l !== upcoming) }
  const sorted = [...lineages].sort(
    (a, b) => (b.last.dateDebut ?? '').localeCompare(a.last.dateDebut ?? '') || a.id.localeCompare(b.id),
  )
  const [first, ...rest] = sorted as [Lineage, ...Lineage[]]
  return { cls: 'morte', lineage: first, alternates: rest }
}

/** Lignées d'un code portant ce numéro (normalisé). Vide si le numéro est inconnu de la base. */
export function lineagesWithNum(ctx: SweepContext, textId: string, num: string): Lineage[] {
  return ctx.lineagesByNum.get(`${textId}|${normalizeNum(num)}`) ?? []
}
