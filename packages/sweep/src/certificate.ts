/**
 * Éléments communs des certificats : références de versions, indices (`hints`), JSON canonique.
 * Les certificats ne contiennent que des faits relisibles à la main (identifiants LEGI, dates,
 * extraits exacts) ; la qualification reste humaine (AGENTS.md §4.4).
 */
import { legifranceArticleUrl, sha256Hex } from '@bugdeloi/core/legi'
import type { Lineage, Version } from './types.ts'

/** JSON canonique : clés triées récursivement, sans espaces. Sert aux empreintes et au rejeu. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
}

export const hashOf = (value: unknown) => sha256Hex(canonicalJson(value))

export function legalUnit(v: Pick<Version, 'id' | 'dateDebut'>): string {
  return `${v.id}@${v.dateDebut ?? 'inconnue'}`
}

export function versionRef(v: Version) {
  return {
    id: v.id,
    code: v.code,
    num: v.num,
    etat: v.etat,
    date_debut: v.dateDebut,
    date_fin: v.dateFin,
    legifrance_url: legifranceArticleUrl(v.id),
  }
}

export function lineageRef(l: Lineage) {
  return {
    id: l.id,
    code: l.code,
    nums: l.nums,
    versions: l.versions.map((v) => ({
      id: v.id,
      etat: v.etat,
      date_debut: v.dateDebut,
      date_fin: v.dateFin,
    })),
    derniere_version: versionRef(l.last),
  }
}

/** Indices de légitimité : signalés, jamais utilisés pour écarter un candidat. */
const HINT_PATTERNS: Array<{ id: string; re: RegExp }> = [
  {
    id: 'redaction_anterieure',
    re: /\b(?:dans|selon|sous) (?:sa|leur|la|les|cette|ces) (?:rédaction|version)\b[^.;]{0,60}/giu,
  },
  {
    id: 'redaction_anterieure',
    re: /\brédaction (?:antérieure|issue|résultant|en vigueur|applicable|initiale)\b[^.;]{0,60}/giu,
  },
  { id: 'ancien_article', re: /\b(?:ancien|anciens|ancienne|anciennes|anciennement)\b[^.;]{0,40}/giu },
  {
    id: 'en_vigueur_avant',
    re: /\ben vigueur (?:avant|jusqu'au|antérieurement|à la date|au \d)[^.;]{0,50}/giu,
  },
  { id: 'en_vigueur_avant', re: /\b(?:avant|jusqu'à) (?:son|leur|l') ?abrogation\b[^.;]{0,40}/giu },
  { id: 'disposition_transitoire', re: /\bdispositions? transitoires?\b/giu },
  { id: 'disposition_transitoire', re: /(?<![\p{L}])à titre transitoire\b/giu },
  { id: 'disposition_transitoire', re: /\bjusqu'au \d{1,2}(?:er)? [a-zéû]+ \d{4}/giu },
  { id: 'mention_abrogation', re: /\babrogé(?:e|s|es)?(?![\p{L}])[^.;]{0,50}/giu },
  {
    id: 'devenu_ou_remplace',
    re: /\b(?:devenu|devenue|devenus|devenues|remplacé par|désormais)\b[^.;]{0,50}/giu,
  },
  {
    id: 'dans_les_conditions_anterieures',
    re: /\btelles? (?:qu'elles? )?(?:résultait|résultent|ressortaient|étaient)\b[^.;]{0,50}/giu,
  },
]

export interface Hint {
  id: string
  phrase: string
  start: number
  end: number
}

/**
 * Indices dans une fenêtre de `radius` caractères autour de [start, end[ du texte normalisé.
 * Les positions sont celles du texte normalisé de la version.
 */
export function hintsAround(text: string, start: number, end: number, radius = 220): Hint[] {
  const from = Math.max(0, start - radius)
  const to = Math.min(text.length, end + radius)
  const window = text.slice(from, to)
  const out = new Map<string, Hint>()
  for (const { id, re } of HINT_PATTERNS) {
    re.lastIndex = 0
    for (const m of window.matchAll(re)) {
      if (m.index === undefined) continue
      const s = from + m.index
      const key = `${id}@${s}`
      if (!out.has(key)) out.set(key, { id, phrase: m[0].trim(), start: s, end: s + m[0].length })
    }
  }
  return [...out.values()].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))
}
