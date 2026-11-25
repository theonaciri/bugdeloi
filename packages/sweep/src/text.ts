import { normalizeLegalText } from '@bugdeloi/core/legi'

const OPEN = ''
const CLOSE = ''

/**
 * Comme `normalizeLegalText`, mais « et » restent distincts (la normalisation canonique les
 * confond avec `"`). Les caractères privés servent de protection le temps de la normalisation.
 */
export function normalizeKeepingGuillemets(input: string): string {
  return normalizeLegalText(input.replaceAll('«', OPEN).replaceAll('»', CLOSE))
    .replaceAll(OPEN, '«')
    .replaceAll(CLOSE, '»')
}

/** Alinéas d'un bloc HTML LEGI : un par `<p>` ou segment séparé par `<br>`. Alinéas vides écartés. */
export function paragraphsOf(html: string): string[] {
  return html
    .split(/<\/p>|<br\s*\/?>/gi)
    .map((p) => normalizeKeepingGuillemets(p))
    .filter((p) => p.length > 0)
}

/** Extrait de `text` autour de [start, end[ avec `radius` caractères de chaque côté, aligné sur des mots. */
export function excerptAround(text: string, start: number, end: number, radius = 160) {
  let from = Math.max(0, start - radius)
  let to = Math.min(text.length, end + radius)
  if (from > 0) {
    const sp = text.indexOf(' ', from)
    if (sp !== -1 && sp < start) from = sp + 1
  }
  if (to < text.length) {
    const sp = text.lastIndexOf(' ', to)
    if (sp > end) to = sp
  }
  return {
    /** Texte exact (sous-chaîne du texte normalisé de la version). */
    text: text.slice(from, to),
    /** Position du premier caractère de l'extrait dans le texte normalisé (UTF-16). */
    offset: from,
    /** Position de l'élément cité dans le texte normalisé. */
    start,
    end,
    cited: text.slice(start, end),
  }
}
