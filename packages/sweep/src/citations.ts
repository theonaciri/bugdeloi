/**
 * Extraction des citations d'articles écrites dans le texte (détecteur `ref-morte-texte`).
 *
 * Objectif : **précision avant rappel**. Le motif ne retient que des formes sans ambiguïté
 * (« l'article 199 undecies B », « aux articles L. 521-1 et L. 521-2 du présent code ») et laisse de
 * côté tout ce qui peut viser une autre norme (loi, décret, directive, annexe, autre code, sigle).
 * Fonctions pures : aucune lecture de base, entièrement testables.
 */

/** Adverbes multiplicatifs des numéros du CGI (bis, ter … novodecies, vicies … quatervicies, etc.). */
const ADVERBS = [
  'bis',
  'ter',
  'quater',
  'quinquies',
  'sexies',
  'septies',
  'octies',
  'nonies',
  'novies',
  'decies',
  'undecies',
  'duodecies',
  'terdecies',
  'quaterdecies',
  'quindecies',
  'quinquedecies',
  'sexdecies',
  'septdecies',
  'octodecies',
  'novodecies',
  'vicies',
  'unvicies',
  'duovicies',
  'tervicies',
  'quatervicies',
  'quinvicies',
  'sexvicies',
  'septvicies',
  'octovicies',
  'novovicies',
  'tricies',
  'untricies',
  'duotricies',
  'tertricies',
  'quatertricies',
  'quintricies',
  'sextricies',
  'septtricies',
  'octotricies',
  'novotricies',
  'quadragies',
]
const ADVERB = `(?:${[...ADVERBS].sort((a, b) => b.length - a.length).join('|')})(?![\\p{L}\\d])(?:-\\d+)?`
/** Lettre(s) majuscule(s) de suffixe : « A », « VU », « EB ». Les chiffres romains à plusieurs lettres (II, III, IV…) sont des subdivisions. */
const LETTERS = '(?!(?:II|III|IV|VI|VII|VIII|IX|XI|XII)(?![\\p{L}\\d]))[A-Z]{1,3}(?![\\p{L}\\d])'
/** Numéro de type CGI : 199 undecies B, 150-0 A, 1649 quater B bis, 223 VU sexies, 1er. */
const CGI_NUM = `\\d+(?:er)?(?:-\\d+)*(?:[ ](?:${ADVERB}|${LETTERS}))*`
/** Numéro de type CSS/CCH : L. 521-1, R. 111-9, D. 331-53-1, R*111-9 (la lettre peut être suivie d'un point). */
const CODE_NUM = `[LRDA]\\*?\\.?[ ]?\\d+(?:-\\d+)*(?:[ ](?:${LETTERS}|${ADVERB}))?`
const ITEM = `(?:${CODE_NUM}|${CGI_NUM})`

const SEP = `(?:[ ]sauf[ ][^,;.:]{1,25})?(?:[ ]?,[ ]?|[ ]et[ ]|[ ]ou[ ]|[ ]à[ ]|[ ]ainsi[ ]que[ ])`
const ITEM_Y = new RegExp(ITEM, 'uy')
const SEP_Y = new RegExp(SEP, 'uy')
// « article(s) » puis une liste d'items séparés par « , », « et », « ou », « à ».
const LIST = `${ITEM}(?:${SEP}${ITEM})*`
const CITATION_RE = new RegExp(`(?<![\\p{L}\\d])(articles?)[ ](${LIST})(?![\\p{L}\\d-])`, 'gu')

/** Un code désigné explicitement par le texte après la liste. */
export type Designation =
  | { kind: 'self'; via: string } // « du présent code », ou nom du code du texte lui-même
  | { kind: 'code'; code: 'CGI' | 'CSS' | 'CCH'; via: string }
  | { kind: 'other'; via: string } // autre code, loi, décret, directive, annexe, sigle…
  | { kind: 'none' } // rien dans la fenêtre d'observation

const NAMED_CODES: Array<{ re: RegExp; code: 'CGI' | 'CSS' | 'CCH' }> = [
  { re: /^code général des impôts/i, code: 'CGI' },
  { re: /^CGI\b/, code: 'CGI' },
  { re: /^code de la sécurité sociale/i, code: 'CSS' },
  { re: /^code de la construction et de l'habitation/i, code: 'CCH' },
]

/**
 * Désignation de la norme visée, lue juste après la liste d'articles. Ne regarde que la phrase
 * courante (jusqu'à « ; » ou « . » suivi d'une majuscule), au plus 80 caractères.
 */
export function designationAfter(text: string, end: number): Designation {
  const window = text.slice(end, end + 90)
  // Renvois à une désignation donnée plus haut : on ne sait pas de quelle norme il s'agit.
  if (/^(?:[ ]?\([^)]{0,30}\))?[ ,]*(?:précité|susvisé|susmentionné|ci-dessus|ci-après)/iu.test(window)) {
    return { kind: 'other', via: 'renvoi à une désignation antérieure' }
  }
  // Incises « (1) », « (abrogé) » sautées pour lire la suite immédiate seulement.
  const m =
    /^(?:[ ]?\([^)]{0,30}\))?(?:,?[ ](?:[\p{L}]+[ ])?alinéas?,?)?([ ,]*)(du|de la|de l'|des|dudit|de ce|de cette)[ ]?([^;]{0,70})/u.exec(
      window,
    )
  if (!m) return laterDesignation(text, end)
  const comma = (m[1] ?? '').includes(',')
  const rest = (m[3] ?? '').trim()
  const head = `${m[2]} ${rest}`.trim()
  const other = { kind: 'other' as const, via: head.slice(0, 50) }
  if (m[2] === 'du' && /^présent code\b/i.test(rest)) return { kind: 'self', via: 'présent code' }
  if (m[2] === 'du') {
    for (const c of NAMED_CODES)
      if (c.re.test(rest)) return { kind: 'code', code: c.code, via: rest.slice(0, 50) }
    if (
      /^(même|dit|code|livre|titre|chapitre|section|règlement|traité|décret|statut|tarif)(?![\p{L}])/iu.test(
        rest,
      )
    )
      return other
    if (/^[A-Z]{2,}\b/.test(rest)) return other // sigle : CGCT, LPF, CPP…
    return { kind: 'none' } // « du I », « du 2° » : subdivision de l'article, pas une désignation
  }
  if (m[2] === 'dudit' || m[2] === 'de ce' || m[2] === 'de cette') return other
  // « de la loi », « de l'instruction », « des annexes » : toute norme nommée juste après la liste.
  // Après une virgule, « de la… » est le plus souvent un complément de phrase : pas une désignation.
  return comma ? laterDesignation(text, end) : other
}

/** Norme désignée un peu plus loin dans la même proposition (avant la citation suivante) : jamais la nôtre. */
const OTHER_NORM =
  /\b(?:du|de la|de l'|des|au|aux)[ ]+(?:code|loi|ordonnance|décret|règlement|directive|traité|livre|convention)(?![\p{L}])/u
const OUR_CODES =
  /^(?:du présent code|du code général des impôts|du code de la sécurité sociale|du code de la construction et de l'habitation)/u
function laterDesignation(text: string, end: number): Designation {
  let window = text.slice(end, end + 160)
  const cut = window.search(/;|\.[ ][A-Z0-9]|\barticles?\b/u)
  if (cut >= 0) window = window.slice(0, cut)
  const m = OTHER_NORM.exec(window)
  if (!m) return { kind: 'none' }
  if (OUR_CODES.test(window.slice(m.index))) return { kind: 'none' }
  return { kind: 'other', via: window.slice(m.index, m.index + 50) }
}

/** Normalise un numéro d'article pour la comparaison : minuscules, sans points, espaces réduits. */
export function normalizeNum(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFC')
    .replace(/(^|[ ])1er\b/g, '$11')
    .replace(/^([ldra])\*?\.?\s*(?=\d)/, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export type TextCitation = {
  /** Numéro tel qu'écrit dans le texte (sans le mot « article »). */
  raw: string
  /** Numéro normalisé (clé de recherche). */
  num: string
  /** Position (UTF-16) du premier caractère du numéro dans le texte normalisé. */
  start: number
  end: number
  /** Position de début du mot « article(s) » et de fin de l'extrait de contexte. */
  matchStart: number
  /** Item appartenant à une plage « X à Y » : seules les bornes sont citées. */
  rangeRole: 'start' | 'end' | null
  /** Plusieurs articles dans la même liste (vrai si > 1). */
  listSize: number
  designation: Designation
}

/**
 * Citations d'articles d'un texte normalisé. Les bornes d'une plage « 199 decies E à 199 decies G »
 * sont toutes deux retournées (rangeRole) ; les articles intermédiaires ne sont pas cités.
 */
export function extractCitations(text: string): TextCitation[] {
  const out: TextCitation[] = []
  for (const m of text.matchAll(CITATION_RE)) {
    const list = m[2]
    if (!list || m.index === undefined) continue
    const listStart = m.index + m[0].length - list.length
    const items: Array<{ raw: string; start: number; end: number; sepBefore: string }> = []
    let pos = 0
    let sepBefore = ''
    while (pos < list.length) {
      ITEM_Y.lastIndex = pos
      const im = ITEM_Y.exec(list)
      if (!im) break
      items.push({ raw: im[0], start: listStart + pos, end: listStart + pos + im[0].length, sepBefore })
      pos += im[0].length
      SEP_Y.lastIndex = pos
      const sm = SEP_Y.exec(list)
      if (!sm) break
      sepBefore = sm[0]
      pos += sm[0].length
    }
    const designation = designationAfter(text, m.index + m[0].length)
    items.forEach((it, i) => {
      const isStart = items[i + 1]?.sepBefore.trim() === 'à'
      const isEnd = it.sepBefore.trim() === 'à'
      out.push({
        raw: it.raw,
        num: normalizeNum(it.raw),
        start: it.start,
        end: it.end,
        matchStart: m.index ?? 0,
        rangeRole: isStart ? 'start' : isEnd ? 'end' : null,
        listSize: items.length,
        designation,
      })
    })
  }
  return out
}

const memo = new WeakMap<object, TextCitation[]>()

/** `extractCitations` mémorisé par version (les deux détecteurs textuels lisent les mêmes articles). */
export function citationsOf(version: { contentText: string }): TextCitation[] {
  let r = memo.get(version)
  if (!r) {
    r = extractCitations(version.contentText)
    memo.set(version, r)
  }
  return r
}
