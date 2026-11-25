/**
 * Lecture minimale des fichiers article de LEGI (DTD `ARTICLE` de la DILA), écrite pour ce contrôle.
 * Seuls les éléments utiles sont lus : identifiant, numéro, état, dates, texte de rattachement,
 * bloc VERSIONS, contenu et liens. Aucune dépendance XML : les fichiers DILA sont réguliers et
 * l'extraction par balise est testée sur des cas construits (`legi-xml.test.ts`).
 */

export const CODES = {
  CGI: 'LEGITEXT000006069577',
  CSS: 'LEGITEXT000006073189',
  CCH: 'LEGITEXT000006074096',
} as const

export type CodeName = keyof typeof CODES
export const CODE_BY_TEXT: Record<string, CodeName> = Object.fromEntries(
  Object.entries(CODES).map(([k, v]) => [v, k as CodeName]),
)

/** Fin « ouverte » selon la convention DILA. */
export const OPEN_END = '2999-01-01'

export interface VersionRef {
  id: string
  etat: string
  debut: string
  fin: string
  num: string
}

export interface LegiLink {
  typelien: string
  sens: string
  id: string
  cidtexte: string
  num: string
}

export interface ArticleRecord {
  id: string
  num: string
  etat: string
  debut: string
  fin: string
  /** `cid` du texte de rattachement (CONTEXTE/TEXTE). */
  textCid: string
  versions: VersionRef[]
  /** Texte normalisé ; seulement pour les versions sources des candidats. */
  text?: string
  links?: LegiLink[]
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (m, code: string) => {
    if (code.startsWith('#x')) return String.fromCodePoint(Number.parseInt(code.slice(2), 16))
    if (code.startsWith('#')) return String.fromCodePoint(Number.parseInt(code.slice(1), 10))
    return ENTITIES[code] ?? m
  })
}

function tag(xml: string, name: string): string | null {
  const open = xml.indexOf(`<${name}>`)
  if (open < 0) return null
  const start = open + name.length + 2
  const close = xml.indexOf(`</${name}>`, start)
  if (close < 0) return null
  return xml.slice(start, close)
}

/** Contenu d'un élément qui peut aussi être vide (`<X/>`) ou porter des attributs. */
function block(xml: string, name: string): string | null {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?(/?)>`)
  const m = re.exec(xml)
  if (!m) return null
  if (m[1] === '/') return ''
  const start = m.index + m[0].length
  const close = xml.indexOf(`</${name}>`, start)
  if (close < 0) return null
  return xml.slice(start, close)
}

export function attrs(s: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of s.matchAll(/([a-zA-Z_:-]+)="([^"]*)"/g)) {
    const k = m[1]
    if (k) out[k] = decodeEntities(m[2] ?? '')
  }
  return out
}

/** Contenu HTML → texte : balises retirées (`<br/>`, `<p>` deviennent des espaces), entités décodées. */
export function htmlToText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
}

/**
 * Normalisation de comparaison (propre à ce contrôle) : espaces (y compris insécables) réduits à un
 * seul, apostrophes typographiques → `'`, guillemets (« » “ ” „) → `"`, tirets (‐ ‑ ‒ – — −) → `-`,
 * espaces collés aux guillemets supprimés des deux côtés (« x » et "x" deviennent `"x"`, `a « x » b` devient
 * `a"x"b`) : la même fonction est appliquée au texte XML et à l'extrait du certificat.
 */
export function normalizeForMatch(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[‘’‚‛ʼ′´`]/g, "'")
    .replace(/[«»“”„‟″]/g, '"')
    .replace(/[‐‑‒–—―−﹣－]/g, '-')
    .replace(/[\s     ​]+/g, ' ')
    .replace(/" /g, '"')
    .replace(/ "/g, '"')
    .trim()
}

/** Numéro d'article comparable : minuscules, sans espaces, points ni astérisques (« L. 521-1 » → `l521-1`). */
export function normalizeNum(num: string): string {
  return num
    .normalize('NFC')
    .toLowerCase()
    .replace(/[‐‑‒–—−]/g, '-')
    .replace(/[\s.* ]+/g, '')
}

/**
 * Les sous-chaînes extraites d'un gros XML peuvent garder tout le XML en mémoire (sous-chaînes
 * partagées du moteur JS). Chaque valeur conservée passe donc par ce réservoir, qui en garde une copie
 * indépendante et dédoublonne les valeurs répétées (états, dates, identifiants cités par VERSIONS).
 */
const pool = new Map<string, string>()
const enc = new TextEncoder()
const dec = new TextDecoder()
export function intern(s: string): string {
  const hit = pool.get(s)
  if (hit !== undefined) return hit
  const copy = dec.decode(enc.encode(s))
  pool.set(copy, copy)
  return copy
}

/** Blocs VERSIONS identiques (une même lignée) partagés entre fichiers : clé = empreinte du bloc. */
const versionsCache = new Map<string, VersionRef[]>()

function parseVersions(blockText: string): VersionRef[] {
  const key = `${blockText.length}:${Bun.hash(blockText).toString(36)}`
  const hit = versionsCache.get(key)
  if (hit) return hit
  const versions: VersionRef[] = []
  for (const m of blockText.matchAll(/<LIEN_ART\s[^>]*>/g)) {
    const a = attrs(m[0])
    if (!a.id) continue
    versions.push({
      id: intern(a.id),
      etat: intern(a.etat ?? ''),
      debut: intern(a.debut ?? ''),
      fin: intern(a.fin ?? ''),
      num: intern(a.num ?? ''),
    })
  }
  versionsCache.set(key, versions)
  return versions
}

/** Vide les réservoirs (tests, ou entre deux exécutions dans un même processus). */
export function resetPools(): void {
  pool.clear()
  versionsCache.clear()
}

export function parseArticle(xml: string, opts: { withText: boolean }): ArticleRecord | null {
  const rawId = tag(xml, 'ID')?.trim()
  if (!rawId?.startsWith('LEGIARTI')) return null
  const id = intern(rawId)
  const metaArticle = tag(xml, 'META_ARTICLE') ?? ''
  const num = intern(decodeEntities(tag(metaArticle, 'NUM') ?? '').trim())
  const etat = intern((tag(metaArticle, 'ETAT') ?? '').trim())
  const debut = intern((tag(metaArticle, 'DATE_DEBUT') ?? '').trim())
  const fin = intern((tag(metaArticle, 'DATE_FIN') ?? '').trim())
  const texteOpen = /<TEXTE\s[^>]*>/.exec(xml)
  const textCid = intern(texteOpen ? (attrs(texteOpen[0]).cid ?? '') : '')
  const versions = parseVersions(block(xml, 'VERSIONS') ?? '')
  const rec: ArticleRecord = { id, num, etat, debut, fin, textCid, versions }
  if (opts.withText) {
    const bloc = block(xml, 'BLOC_TEXTUEL') ?? ''
    const contenu = block(bloc, 'CONTENU') ?? ''
    rec.text = dec.decode(enc.encode(normalizeForMatch(htmlToText(contenu))))
    const links: LegiLink[] = []
    const liens = block(xml, 'LIENS') ?? ''
    for (const m of liens.matchAll(/<LIEN\s[^>]*>/g)) {
      const a = attrs(m[0])
      links.push({
        typelien: intern(a.typelien ?? ''),
        sens: intern(a.sens ?? ''),
        id: intern(a.id ?? ''),
        cidtexte: intern(a.cidtexte ?? ''),
        num: intern(a.num ?? ''),
      })
    }
    rec.links = links
  }
  return rec
}

/** États terminaux : la version n'est plus en vigueur, quelles que soient ses dates. */
export const TERMINAL_STATES = new Set([
  'ABROGE',
  'TRANSFERE',
  'PERIME',
  'ANNULE',
  'DISJOINT',
  'MODIFIE_MORT_NE',
])

export interface Dated {
  etat: string
  debut: string
  fin: string
}

/**
 * Règle de ce contrôle (écrite indépendamment) : une version est en vigueur à la date D si
 * `debut ≤ D < fin` **et** son état l'admet :
 * - `VIGUEUR`, `VIGUEUR_DIFF` (si l'entrée en vigueur est passée), `ABROGE_DIFF` (abrogation future) ;
 * - `MODIFIE` seulement si sa fin est datée (une version `MODIFIE` à fin ouverte est incohérente :
 *   elle a été remplacée sans date de fin, on ne la tient pas pour en vigueur) ;
 * - jamais un état terminal (abrogé, transféré, périmé, annulé, disjoint, mort-né).
 * Un état inconnu n'est pas tenu pour en vigueur (et il est compté à part par `run.ts`).
 */
export function inForce(v: Dated, date: string): boolean {
  if (!v.debut || !v.fin) return false
  if (!(v.debut <= date && date < v.fin)) return false
  switch (v.etat) {
    case 'VIGUEUR':
    case 'VIGUEUR_DIFF':
    case 'ABROGE_DIFF':
      return true
    case 'MODIFIE':
      return v.fin !== OPEN_END
    default:
      return false
  }
}

/** Sous-type annoncé par les détecteurs C0.2 pour un état final donné. */
export function subtypeOf(etat: string): string {
  switch (etat) {
    case 'ABROGE':
      return 'abrogé'
    case 'TRANSFERE':
      return 'transféré'
    case 'PERIME':
      return 'périmé'
    case 'ANNULE':
      return 'annulé'
    case 'DISJOINT':
      return 'disjoint'
    default:
      return `autre:${etat}`
  }
}
