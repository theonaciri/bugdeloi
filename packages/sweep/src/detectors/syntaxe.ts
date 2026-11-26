/**
 * `syntaxe` — SYNTAXE : parenthèses, crochets et guillemets non appariés dans le texte d'un article
 * en vigueur.
 *
 * Lecture : les alinéas (un par `<p>`) d'une version sont parcourus dans l'ordre ; l'appariement se
 * fait sur l'article entier, pas alinéa par alinéa (une citation peut couvrir plusieurs alinéas).
 *
 * Règles d'exclusion (comptées dans les statistiques, jamais candidates) :
 * - `)` fermant sans `(` ouvrant et précédé d'un marqueur d'énumération (« a) », « 1) », « i) », « 1°) »,
 *   « a bis) », « a sexies-0) ») au début d'un alinéa ou après une espace, une virgule ou un point-virgule ;
 * - `l2°)` et les variantes avec un « l » initial à la place du chiffre 1, en tête d’alinéa ;
 * - `«` en début d'alinéa alors qu'une citation est déjà ouverte : usage français des citations sur
 *   plusieurs alinéas (chaque alinéa rouvre « et seul le dernier ferme) ;
 * - articles dont le numéro commence par « Annexe » (tableaux et formules).
 * Le guillemet droit `"` (issu de `"` ou de “ ”) n'a pas de sens : on suit une citation « ouverte ». Un
 * alinéa à nombre impair de `"` l'ouvre ou la ferme ; un `"` en tête d'alinéa pendant qu'une citation est
 * ouverte la poursuit (usage des citations sur plusieurs alinéas) et n'est pas compté. Une citation
 * encore ouverte à la fin de l'article est signalée (`guillemet_droit_non_apparie`).
 */
import { legifranceArticleUrl } from '@bugdeloi/core/legi'
import { legalUnit, versionRef } from '../certificate.ts'
import type { Candidate, Detector, ScanOptions, ScanResult, SweepContext, Version } from '../types.ts'

export const NAME = 'syntaxe'
export const VERSION = '1.1.0'

const ENUM_BEFORE_CLOSER =
  /(?:^|[\s;:,.-])(?:[a-zA-Z]{1,2}|\d{1,2}°?|[ivxlcIVXLC]{1,6})(?: (?:bis|ter|quater|quinquies|sexies|septies|octies|nonies|decies))?(?:-\d{1,2})?$/u

const ENUM_WITH_INITIAL_L = /^\s*l\d°$/u

export interface Location {
  paragraph: number // 1-based
  offset: number
  excerpt: string
}

export interface Imbalance {
  subtype:
    | 'parenthese_non_fermee'
    | 'parenthese_non_ouverte'
    | 'crochet_non_ferme'
    | 'crochet_non_ouvert'
    | 'guillemet_non_ferme'
    | 'guillemet_non_ouvert'
    | 'guillemet_droit_non_apparie'
  locations: Location[]
}

export interface SyntaxExclusions {
  enumeration_closers: number
  continued_quotes: number
}

function excerptIn(paragraph: string, offset: number, radius = 80) {
  const from = Math.max(0, offset - radius)
  return paragraph.slice(from, Math.min(paragraph.length, offset + radius))
}

/** Déséquilibres d'un article, à partir de ses alinéas. */
export function checkBalance(paragraphs: string[]): {
  imbalances: Imbalance[]
  exclusions: SyntaxExclusions
  /** Nombre d'alinéas qui commencent par un guillemet droit (citation sur plusieurs alinéas ?). */
  leadingStraight: number
} {
  const open = { paren: [] as Location[], bracket: [] as Location[], quote: [] as Location[] }
  const stray: Record<'paren' | 'bracket' | 'quote', Location[]> = { paren: [], bracket: [], quote: [] }
  let straightOpen: Location | null = null
  const exclusions: SyntaxExclusions = { enumeration_closers: 0, continued_quotes: 0 }
  let leadingStraight = 0

  paragraphs.forEach((p, pi) => {
    for (let i = 0; i < p.length; i++) {
      const ch = p[i] as string
      const loc = (): Location => ({ paragraph: pi + 1, offset: i, excerpt: excerptIn(p, i) })
      if (ch === '(') open.paren.push(loc())
      else if (ch === '[') open.bracket.push(loc())
      else if (ch === '«') {
        if (i === 0 && open.quote.length > 0) exclusions.continued_quotes++
        else open.quote.push(loc())
      } else if (ch === ')') {
        if (open.paren.length > 0) open.paren.pop()
        else {
          const prefix = p.slice(0, i)
          if (ENUM_BEFORE_CLOSER.test(prefix) || ENUM_WITH_INITIAL_L.test(prefix)) {
            exclusions.enumeration_closers++
          } else stray.paren.push(loc())
        }
      } else if (ch === ']') {
        if (open.bracket.length > 0) open.bracket.pop()
        else stray.bracket.push(loc())
      } else if (ch === '»') {
        if (open.quote.length > 0) open.quote.pop()
        else stray.quote.push(loc())
      }
    }
    // Guillemets droits : suivi d'une citation ouverte, alinéa par alinéa.
    const quotes: number[] = []
    for (let i = p.indexOf('"'); i !== -1; i = p.indexOf('"', i + 1)) quotes.push(i)
    if (quotes.length === 0) return
    const leading = quotes[0] === 0
    const effective = straightOpen !== null && leading ? quotes.length - 1 : quotes.length
    if (straightOpen !== null && leading) exclusions.continued_quotes++
    if (leading) leadingStraight++
    if (effective % 2 === 1) {
      const at = straightOpen !== null && leading ? (quotes[1] ?? 0) : (quotes[0] ?? 0)
      straightOpen =
        straightOpen === null ? { paragraph: pi + 1, offset: at, excerpt: excerptIn(p, at) } : null
    }
  })

  const imbalances: Imbalance[] = []
  const add = (subtype: Imbalance['subtype'], locations: Location[]) => {
    if (locations.length > 0) imbalances.push({ subtype, locations: locations.slice(0, 5) })
  }
  add('parenthese_non_fermee', open.paren)
  add('parenthese_non_ouverte', stray.paren)
  add('crochet_non_ferme', open.bracket)
  add('crochet_non_ouvert', stray.bracket)
  add('guillemet_non_ferme', open.quote)
  add('guillemet_non_ouvert', stray.quote)
  if (straightOpen !== null) add('guillemet_droit_non_apparie', [straightOpen])
  return { imbalances, exclusions, leadingStraight }
}

const FLAGS: Record<string, string> = {
  parenthese_non_fermee: 'une « ( » reste ouverte à la fin du texte',
  parenthese_non_ouverte: "une « ) » n'a pas de « ( » correspondante",
  crochet_non_ferme: 'un « [ » reste ouvert à la fin du texte',
  crochet_non_ouvert: "un « ] » n'a pas de « [ » correspondant",
  guillemet_non_ferme: 'un « « » reste ouvert à la fin du texte',
  guillemet_non_ouvert: "un « » » n'a pas de « « » correspondant",
  guillemet_droit_non_apparie:
    'une citation entre guillemets droits (") reste ouverte à la fin du texte, ou un guillemet droit n\'a pas de pendant',
}

export function scan(ctx: SweepContext, options: ScanOptions = {}): ScanResult {
  const candidates: Candidate[] = []
  const stats = { articles_controles: 0, articles_avec_defaut: 0, annexes_ecartees: 0 }
  const excl: SyntaxExclusions = { enumeration_closers: 0, continued_quotes: 0 }
  const subtypes: Record<string, number> = {}
  const asOfByText = new Map(ctx.codes.map((c) => [c.textId, c.asOf]))

  for (const source of ctx.inForce) {
    if (options.only && !options.only.has(source.id)) continue
    if (options.codes && !options.codes.has(source.code)) continue
    stats.articles_controles++
    if (/^annexe/i.test(source.num ?? '')) {
      stats.annexes_ecartees++
      continue
    }
    const { imbalances, exclusions, leadingStraight } = checkBalance(source.paragraphs)
    excl.enumeration_closers += exclusions.enumeration_closers
    excl.continued_quotes += exclusions.continued_quotes
    if (imbalances.length > 0) stats.articles_avec_defaut++
    for (const im of imbalances) {
      subtypes[im.subtype] = (subtypes[im.subtype] ?? 0) + 1
      candidates.push(buildCandidate(source, im, asOfByText.get(source.textId) ?? '', leadingStraight))
    }
  }
  return { candidates, stats: { ...stats, exclusions: { ...excl }, candidats_par_sous_type: subtypes } }
}

function buildCandidate(source: Version, im: Imbalance, asOf: string, leadingStraight: number): Candidate {
  const proof = {
    method: `${NAME}@${VERSION}`,
    reading: "Appariement sur l'article entier ; alinéas numérotés à partir de 1 dans l'ordre du texte LEGI.",
    projection_date: asOf,
    source: { ...versionRef(source), text_sha256: source.textSha256 },
    defect: { subtype: im.subtype, description: FLAGS[im.subtype], locations: im.locations },
    paragraph_count: source.paragraphs.length,
    hints: { source_etat: source.etat, leading_straight_quotes: leadingStraight },
    urls: { source: legifranceArticleUrl(source.id) },
  }
  const first = im.locations[0] as Location
  return {
    type: 'SYNTAXE',
    subtype: im.subtype,
    fingerprintParts: ['syntaxe', source.id, im.subtype],
    claim: `Au ${asOf}, dans le texte de l'article ${source.num ?? '(sans numéro)'} du ${source.code} (${source.id}), ${FLAGS[im.subtype]} (premier cas à l'alinéa ${first.paragraph}).`,
    legalUnits: [legalUnit(source)],
    sourceId: source.id,
    proof,
  }
}

export const detector: Detector = {
  name: NAME,
  version: VERSION,
  family: 'syntaxe',
  types: ['SYNTAXE'],
  describe: "Parenthèses, crochets et guillemets non appariés dans le texte d'un article en vigueur.",
  scan,
}
