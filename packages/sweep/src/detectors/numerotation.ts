/**
 * `numerotation` — NUMEROTATION.
 *
 * 1. `article_numero_duplique` : deux versions en vigueur de **lignées différentes** portent le même
 *    numéro (normalisé : minuscules, sans points ni astérisque) dans le même code. Deux versions de la
 *    même lignée n'en font pas partie (anomalie de dates DILA, comptée à part). Pas de recherche de
 *    « trous » : une numérotation discontinue est normale.
 * 2. `subdivision_dupliquee` : deux marqueurs identiques et consécutifs de même niveau dans un même
 *    article (« 3° » puis « 3° »), sans marqueur de niveau supérieur entre eux. Marqueurs lus seulement
 *    en début d'alinéa, hiérarchie : I. › A. › 1. › 1° › a).
 */
import { legifranceArticleUrl } from '@bugdeloi/core/legi'
import { hintsAround, legalUnit, versionRef } from '../certificate.ts'
import { normalizeNum } from '../citations.ts'
import type { Candidate, Detector, ScanOptions, ScanResult, SweepContext, Version } from '../types.ts'

export const NAME = 'numerotation'
export const VERSION = '1.0.0'

const ADV = '(?:bis|ter|quater|quinquies|sexies|septies|octies|nonies|novies|decies)'

interface Level {
  id: 'romain' | 'majuscule' | 'chiffre' | 'degre' | 'lettre'
  re: RegExp
  /** Rang du marqueur dans sa suite (1, 2, 3…), ou null si le marqueur n'est pas simple. */
  ordinal: (value: string) => number | null
}

const ROMAN: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
  XI: 11,
  XII: 12,
}
const letterOrd = (v: string) =>
  /^[a-z]$/.test(v) ? v.charCodeAt(0) - 96 : /^[A-Z]$/.test(v) ? v.charCodeAt(0) - 64 : null
const intOrd = (v: string) => (/^\d{1,2}$/.test(v) ? Number(v) : null)

/** Du plus haut au plus bas niveau. Le marqueur doit être suivi d'une espace puis d'un mot. */
const LEVELS: Level[] = [
  {
    id: 'romain',
    re: new RegExp(`^([IVX]{1,5})\\.(?=[ -]+\\S)(?![ -]*(?:${ADV})\\b)`),
    ordinal: (v) => ROMAN[v] ?? null,
  },
  {
    id: 'majuscule',
    re: new RegExp(`^([A-Z])\\.(?=[ -]+\\S)(?!\\s?\\d{1,4}-\\d)(?![ -]*(?:${ADV})\\b)`),
    ordinal: letterOrd,
  },
  { id: 'chiffre', re: new RegExp(`^(\\d{1,2})\\.(?=[ -]+[^\\d -])(?![ -]*(?:${ADV})\\b)`), ordinal: intOrd },
  { id: 'degre', re: new RegExp(`^(\\d{1,2})°(?= (?!${ADV}\\b)[^\\d-])`), ordinal: intOrd },
  { id: 'lettre', re: /^([a-z])\)(?= \S)/, ordinal: letterOrd },
]

export interface Marker {
  level: number
  levelId: Level['id']
  value: string
  ordinal: number | null
  paragraph: number
}

/**
 * Marqueurs de début d'alinéa, éventuellement composés (« B. 1° Le taux… » porte « B. » puis « 1° »),
 * du plus haut niveau au plus bas. Un tiret initial est ignoré.
 */
export function markersOf(paragraph: string, index: number): Marker[] {
  const out: Marker[] = []
  let rest = paragraph.replace(/^[-–—]\s*/, '')
  let guard = 0
  while (rest && guard++ < 4) {
    let hit: Marker | null = null
    let consumed = 0
    for (const [level, l] of LEVELS.entries()) {
      const m = l.re.exec(rest)
      if (m?.[1]) {
        const suffix = l.id === 'degre' ? '°' : l.id === 'lettre' ? ')' : '.'
        hit = { level, levelId: l.id, value: `${m[1]}${suffix}`, ordinal: l.ordinal(m[1]), paragraph: index }
        consumed = m[0].length
        break
      }
    }
    if (!hit) break
    // Un marqueur composé descend d'un niveau à chaque fois.
    const previous = out[out.length - 1]
    if (previous && hit.level <= previous.level) break
    out.push(hit)
    rest = rest.slice(consumed).replace(/^[\s.-]+/, '')
  }
  return out
}

export interface Duplicate {
  marker: Marker
  previous: Marker
}

/**
 * Suites « …, n-1, n, n » : le même marqueur répété juste après lui-même au milieu d'une suite
 * croissante, sans marqueur de niveau supérieur intercalé. Une répétition en début de suite (« 1., 1. »)
 * ou dans un tableau est ignorée : elle marque presque toujours une nouvelle liste.
 */
export function duplicateMarkers(paragraphs: string[]): Duplicate[] {
  const history: Marker[][] = LEVELS.map(() => [])
  const out: Duplicate[] = []
  paragraphs.forEach((p, i) => {
    for (const marker of markersOf(p, i)) {
      const hist = history[marker.level] as Marker[]
      const prev = hist[hist.length - 1]
      const before = hist[hist.length - 2]
      if (
        prev &&
        before &&
        marker.ordinal !== null &&
        prev.ordinal === marker.ordinal &&
        before.ordinal === marker.ordinal - 1
      ) {
        out.push({ marker, previous: prev })
      }
      hist.push(marker)
      for (let k = marker.level + 1; k < LEVELS.length; k++) history[k] = []
    }
  })
  return out
}

export function scan(ctx: SweepContext, options: ScanOptions = {}): ScanResult {
  const candidates: Candidate[] = []
  const stats = {
    articles_controles: 0,
    groupes_de_numero_multiples_meme_lignee: 0,
    numeros_dupliques: 0,
    subdivisions_dupliquees: 0,
  }
  const asOfByText = new Map(ctx.codes.map((c) => [c.textId, c.asOf]))

  // 1. numéros dupliqués entre lignées différentes
  const groups = new Map<string, Version[]>()
  for (const v of ctx.inForce) {
    if (options.codes && !options.codes.has(v.code)) continue
    if (!v.num) continue
    const key = `${v.textId}|${normalizeNum(v.num)}`
    const list = groups.get(key)
    if (list) list.push(v)
    else groups.set(key, [v])
  }
  for (const [key, versions] of groups) {
    if (versions.length < 2) continue
    const lineageIds = [
      ...new Set(versions.map((v) => (ctx.lineageOf.get(v.id) as { id: string }).id)),
    ].sort()
    if (lineageIds.length < 2) {
      stats.groupes_de_numero_multiples_meme_lignee++
      continue
    }
    const sorted = [...versions].sort((a, b) => a.id.localeCompare(b.id))
    const [source] = sorted as [Version]
    if (options.only && !sorted.some((v) => options.only?.has(v.id))) continue
    stats.numeros_dupliques++
    const proof = {
      method: `${NAME}@${VERSION}`,
      projection_date: asOfByText.get(source.textId) ?? '',
      normalized_num: key.split('|')[1],
      versions: sorted.map((v) => ({
        ...versionRef(v),
        lineage: (ctx.lineageOf.get(v.id) as { id: string }).id,
        text_sha256: v.textSha256,
      })),
    }
    candidates.push({
      type: 'NUMEROTATION',
      subtype: 'article_numero_duplique',
      fingerprintParts: ['numero', key, ...lineageIds],
      claim: `Au ${proof.projection_date}, ${sorted.length} versions en vigueur d'articles distincts du ${source.code} portent le numéro « ${source.num} » : ${sorted.map((v) => v.id).join(', ')}.`,
      legalUnits: sorted.map(legalUnit),
      sourceId: source.id,
      proof,
    })
  }

  // 2. subdivisions dupliquées
  for (const source of ctx.inForce) {
    if (options.only && !options.only.has(source.id)) continue
    if (options.codes && !options.codes.has(source.code)) continue
    stats.articles_controles++
    if (/^annexe/i.test(source.num ?? '')) continue // annexes : tableaux, numérotations propres
    for (const d of duplicateMarkers(source.paragraphs)) {
      stats.subdivisions_dupliquees++
      const para = (i: number) => source.paragraphs[i] ?? ''
      const flat = source.paragraphs.join(' ')
      const pos = flat.indexOf(para(d.marker.paragraph))
      const proof = {
        method: `${NAME}@${VERSION}`,
        projection_date: asOfByText.get(source.textId) ?? '',
        source: { ...versionRef(source), text_sha256: source.textSha256 },
        marker: { level: d.marker.levelId, value: d.marker.value },
        previous: { paragraph: d.previous.paragraph, text: para(d.previous.paragraph).slice(0, 240) },
        duplicate: { paragraph: d.marker.paragraph, text: para(d.marker.paragraph).slice(0, 240) },
        paragraph_count: source.paragraphs.length,
        hints: {
          near_marker: pos >= 0 ? hintsAround(flat, pos, pos + 12) : [],
          source_etat: source.etat,
        },
        urls: { source: legifranceArticleUrl(source.id) },
      }
      candidates.push({
        type: 'NUMEROTATION',
        subtype: 'subdivision_dupliquee',
        fingerprintParts: [
          'subdivision',
          source.id,
          d.marker.levelId,
          d.marker.value,
          String(d.marker.paragraph),
        ],
        claim: `Au ${proof.projection_date}, le texte de l'article ${source.num ?? '(sans numéro)'} du ${source.code} (${source.id}) contient deux alinéas consécutifs de même niveau commençant par « ${d.marker.value} » (alinéas ${d.previous.paragraph + 1} et ${d.marker.paragraph + 1}).`,
        legalUnits: [legalUnit(source)],
        sourceId: source.id,
        proof,
      })
    }
  }
  return { candidates, stats }
}

export const detector: Detector = {
  name: NAME,
  version: VERSION,
  family: 'numerotation',
  types: ['NUMEROTATION'],
  describe:
    "Numéros d'articles portés par deux articles distincts en vigueur du même code ; subdivisions (1°, a), I.) répétées à la suite dans un même article.",
  scan,
}
