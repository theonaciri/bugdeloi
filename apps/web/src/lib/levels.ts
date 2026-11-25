/**
 * Aides d'affichage autour de l'échelle de preuve. La source unique reste `LEVEL_INFO`
 * (@bugdeloi/core) : ici on ne fait que des dérivations (ordre, classes CSS, comptes vides).
 */
import { LEVEL_INFO, LEVEL_RANK, LEVELS, type Level } from '@bugdeloi/core/levels'

export { LEVEL_INFO, LEVEL_RANK, LEVELS, type Level }

export type LevelCounts = Record<Level, number>

export function emptyLevelCounts(): LevelCounts {
  return { N0: 0, N1: 0, N2: 0, N3: 0, N4: 0, N5: 0, REF: 0 }
}

/** Niveau inconnu en base (valeur hors échelle) : traité comme N0, le plus prudent. */
export function asLevel(value: string | null | undefined): Level {
  return value && value in LEVEL_INFO ? (value as Level) : 'N0'
}

/** `--level-n3` → `n3` : suffixe des classes `lvl-fill-n3`, `lvl-bg-n3`, etc. (voir app.css). */
export function levelSlug(level: Level): string {
  return LEVEL_INFO[level].colorToken.replace(/^--level-/, '')
}

export function totalOf(counts: LevelCounts): number {
  let n = 0
  for (const l of LEVELS) n += counts[l]
  return n
}

/** Nombre d'articles au niveau `min` ou au-dessus (★ Référence compte au-dessus de N5). */
export function countAtLeast(counts: LevelCounts, min: Level): number {
  let n = 0
  for (const l of LEVELS) if (LEVEL_RANK[l] >= LEVEL_RANK[min]) n += counts[l]
  return n
}

export function addCounts(target: LevelCounts, source: LevelCounts): void {
  for (const l of LEVELS) target[l] += source[l]
}

/** Libellé complet : « N3 Testé », « ★ Référence ». */
export function levelName(level: Level): string {
  return level === 'REF' ? `★ ${LEVEL_INFO.REF.label}` : `${level} ${LEVEL_INFO[level].label}`
}

/** Motif SVG superposé à la couleur (défini une fois par page dans `PatternDefs.svelte`). */
export function patternUrl(level: Level): string | null {
  const p = LEVEL_INFO[level].pattern
  return p === 'none' || p === 'solid' ? null : `url(#bdl-pat-${p})`
}

/** Résumé texte d'une répartition : « 10 en N0, 5 en N2 » (niveaux non nuls seulement). */
export function describeCounts(counts: LevelCounts): string {
  const parts = LEVELS.filter((l) => counts[l] > 0).map((l) => `${counts[l]} en ${l === 'REF' ? '★' : l}`)
  return parts.length ? parts.join(', ') : 'aucun article en vigueur'
}

/** Niveau le plus représenté (pour choisir la couleur du texte posé sur une tuile). */
export function dominantLevel(counts: LevelCounts): Level {
  let best: Level = 'N0'
  for (const l of LEVELS) if (counts[l] > counts[best]) best = l
  return best
}
