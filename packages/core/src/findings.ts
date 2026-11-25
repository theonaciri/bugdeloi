/**
 * Types d'anomalies et cycle de vie — définitions normatives : AGENTS.md §4.4.
 */

export const FINDING_TYPES = [
  'REF_MORTE',
  'NUMEROTATION',
  'SYNTAXE',
  'CONFLIT',
  'VIDE',
  'FALAISE',
  'ARRONDI',
  'DIVERGENCE_DOCTRINE',
  'DIVERGENCE_SIMULATEUR',
  'AMBIGUITE',
] as const
export type FindingType = (typeof FINDING_TYPES)[number]

/**
 * `withdrawn` : retiré **par une machine** (détecteur corrigé, reproduction indépendante qui infirme) —
 * jamais montré au cimetière public, qui ne contient que des rejets **humains** (`rejected`).
 */
export const FINDING_STATUSES = [
  'candidate',
  'reproduced',
  'qualified',
  'published',
  'rejected',
  'withdrawn',
] as const
export type FindingStatus = (typeof FINDING_STATUSES)[number]

/** Seuls ces statuts peuvent alimenter un compteur public ou un texte publié. */
export const PUBLIC_FINDING_STATUSES: readonly FindingStatus[] = ['qualified', 'published']

export const FINDING_TYPE_LABEL: Record<FindingType, string> = {
  REF_MORTE: 'Renvoi vers un article abrogé',
  NUMEROTATION: 'Numérotation incohérente',
  SYNTAXE: 'Défaut typographique (parenthèse, guillemet)',
  CONFLIT: 'Exceptions en conflit',
  VIDE: 'Cas non couvert par le texte',
  FALAISE: 'Effet de falaise',
  ARRONDI: 'Arrondi non spécifié',
  DIVERGENCE_DOCTRINE: 'Écart loi / doctrine administrative',
  DIVERGENCE_SIMULATEUR: 'Écart loi / simulateur',
  AMBIGUITE: 'Ambiguïté (deux lectures divergent)',
}
