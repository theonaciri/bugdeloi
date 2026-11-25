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

export const FINDING_ID_RE = /^F-\d{4}-\d{4,}$/
export const GITHUB_HANDLE_RE = /^[a-z\d]+(?:-[a-z\d]+)*$/i
export const GIT_SHA_RE = /^[a-f\d]{40}$/

export const QUALIFIED_VERDICTS = ['bug_texte', 'lacune'] as const
export const REJECTED_VERDICTS = ['choix_assumé', 'erreur_nôtre', 'non_pertinent'] as const
export const QUALIFICATION_VERDICTS = [...QUALIFIED_VERDICTS, ...REJECTED_VERDICTS] as const
export type QualificationVerdict = (typeof QUALIFICATION_VERDICTS)[number]

export const VERDICT_LABEL: Record<QualificationVerdict, string> = {
  bug_texte: 'Défaut du texte',
  lacune: 'Lacune',
  choix_assumé: 'Choix assumé',
  erreur_nôtre: 'Erreur de notre part',
  non_pertinent: 'Non pertinent',
}

export interface VerdictEntry {
  id: string
  verdict: QualificationVerdict
  note: string
  reviewer: string
}

export interface FindingQualification extends Omit<VerdictEntry, 'id'> {
  file: string
  commit: string
  qualified_at: string
}

export const QUALIFICATION_FILE_RE = /^qualifications\/verdicts\/\d{4}-\d{2}-\d{2}-([A-Za-z\d-]+)\.yaml$/

export function isReviewer(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 39 && GITHUB_HANDLE_RE.test(value)
}

export function isQualificationVerdict(value: unknown): value is QualificationVerdict {
  return QUALIFICATION_VERDICTS.some((v) => v === value)
}

export function qualifiedStatus(verdict: QualificationVerdict): 'qualified' | 'rejected' {
  return QUALIFIED_VERDICTS.some((v) => v === verdict) ? 'qualified' : 'rejected'
}

export function findingQualification(certificate: Record<string, unknown>): FindingQualification | null {
  const value = certificate.qualification
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const { verdict, reviewer, note, file, commit, qualified_at } = value as Record<string, unknown>
  if (
    !isQualificationVerdict(verdict) ||
    !isReviewer(reviewer) ||
    typeof note !== 'string' ||
    !note.trim() ||
    typeof file !== 'string' ||
    QUALIFICATION_FILE_RE.exec(file)?.[1]?.toLowerCase() !== reviewer.toLowerCase() ||
    typeof commit !== 'string' ||
    !GIT_SHA_RE.test(commit) ||
    typeof qualified_at !== 'string' ||
    !Number.isFinite(Date.parse(qualified_at))
  )
    return null
  return { verdict, reviewer, note, file, commit, qualified_at }
}
