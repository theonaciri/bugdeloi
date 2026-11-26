/**
 * Lecture d'amendements au format Tricoteuses, détection des articles formalisés et extraction
 * prudente de paramètres chiffrés.
 *
 * Le texte d'un amendement est une donnée externe : il n'est jamais interprété comme une instruction.
 * Seul le dispositif fixe des paramètres ; l'exposé sommaire est conservé sans être analysé.
 */

/** Articles formalisés suivis par la veille (versions LEGI lues en base le 26/11/2026). */
export const articlesSuivis = [
  { code: 'CGI', article: '193', legiarti: 'LEGIARTI000054373592', version: '2026-07-01' },
  { code: 'CGI', article: '194', legiarti: 'LEGIARTI000033817781', version: '2018-01-01' },
  { code: 'CGI', article: '197', legiarti: 'LEGIARTI000053542636', version: '2026-02-21' },
  { code: 'CGI', article: '1657', legiarti: 'LEGIARTI000051219510', version: '2025-02-16' },
  { code: 'CSS', article: 'L521-1', legiarti: 'LEGIARTI000029963006', version: '2015-07-01' },
  { code: 'CSS', article: 'D521-1', legiarti: 'LEGIARTI000030680318', version: '2015-07-01' },
  { code: 'CSS', article: 'D755-5', legiarti: 'LEGIARTI000006738575', version: '1998-12-30' },
] as const

export type ArticleSuivi = (typeof articlesSuivis)[number]

export type Correspondance = ArticleSuivi & {
  /** `article_cible` : champ de l'amendement ; `dispositif` : article cité dans le dispositif. */
  origine: 'article_cible' | 'dispositif'
}

export interface Amendement {
  uid: string
  numero: string
  dateDepot: string
  chambre: 'AN' | 'SENAT'
  texteLegislatifRef: string
  articleCible: string
  dispositif: string
  exposeSommaire: string
}

export type Parametre =
  | { type: 'indexation_bareme'; pourcentage: number }
  | { type: 'suppression_seuil_61' }
  | { type: 'suppression_decote' }
  | { type: 'decote_montant_celibataire'; euros: number }
  | { type: 'decote_montant_couple'; euros: number }
  | { type: 'decote_taux'; pourcentage: number }

export interface Extraction {
  /** Paramètres reconnus. Ils ne décrivent tout l'amendement que si `complete` est vrai. */
  parametres: Parametre[]
  /** Phrases du dispositif que la veille ne sait pas lire. */
  phrasesNonReconnues: string[]
  complete: boolean
}

export interface AmendementSuivi {
  amendement: Amendement
  correspondances: Correspondance[]
  extraction: Extraction
}

const chambres: Record<string, Amendement['chambre']> = {
  an: 'AN',
  'assemblée nationale': 'AN',
  assemblee: 'AN',
  senat: 'SENAT',
  sénat: 'SENAT',
  sn: 'SENAT',
}

function champ(objet: Record<string, unknown>, nom: string, videPermis = false): string {
  const valeur = objet[nom]
  if (typeof valeur !== 'string' || (!videPermis && valeur.trim() === '')) {
    throw new TypeError(`Amendement invalide : champ « ${nom} » absent ou non textuel.`)
  }
  return valeur
}

/** Valide un objet JSON d'amendement. Lève `TypeError` si un champ manque ou n'a pas la forme attendue. */
export function parseAmendement(json: unknown): Amendement {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new TypeError('Amendement invalide : un objet JSON est attendu.')
  }
  const objet = json as Record<string, unknown>
  const dateDepot = champ(objet, 'dateDepot')
  const jour = /^(\d{4}-\d{2}-\d{2})(?:T[\d:.]+(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(dateDepot)?.[1]
  const date = new Date(`${jour}T00:00:00Z`)
  if (!jour || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== jour) {
    throw new TypeError(`Amendement invalide : date de dépôt « ${dateDepot} ».`)
  }
  const chambreBrute = champ(objet, 'chambre')
  const cle = chambreBrute.trim().toLowerCase()
  const chambre = Object.hasOwn(chambres, cle) ? chambres[cle] : undefined
  if (!chambre) throw new TypeError(`Amendement invalide : chambre « ${chambreBrute} » inconnue.`)
  return {
    uid: champ(objet, 'uid'),
    numero: champ(objet, 'numero'),
    dateDepot: jour,
    chambre,
    texteLegislatifRef: champ(objet, 'texteLegislatifRef'),
    articleCible: champ(objet, 'articleCible', true),
    dispositif: champ(objet, 'dispositif'),
    exposeSommaire: champ(objet, 'exposeSommaire', true),
  }
}

const entites: Record<string, string> = {
  amp: '&',
  apos: "'",
  quot: '"',
  lt: '<',
  gt: '>',
  nbsp: ' ',
  thinsp: ' ',
  laquo: '«',
  raquo: '»',
  rsquo: "'",
  ndash: '–',
  mdash: '—',
  euro: '€',
  eacute: 'é',
  egrave: 'è',
  agrave: 'à',
}

/** Retire le HTML et normalise espaces et apostrophes. Les paragraphes restent séparés par `\n`. */
export function texteNormalise(html: string): string {
  return html
    .replace(/\r?\n/g, ' ')
    .replace(/<\/?(?:br|p|div|li|tr|table|ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<\/?[a-z][\w:-]*(?:\s[^>]*)?\/?>/gi, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entite, cle: string) => {
      if (!cle.startsWith('#')) return entites[cle] ?? entite
      const hexa = cle[1]?.toLowerCase() === 'x'
      const point = Number.parseInt(cle.slice(hexa ? 2 : 1), hexa ? 16 : 10)
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entite
    })
    .normalize('NFC')
    .replace(/[’ʼ]/g, "'")
    .replace(/[^\S\n]+/g, ' ')
    .split('\n')
    .map((ligne) => ligne.trim())
    .filter(Boolean)
    .join('\n')
}

const nomsDeCodes = [
  { code: 'CGI', motif: String.raw`(?:du code général des imp[ôo]ts(?! sur)|du CGI\b)` },
  { code: 'CSS', motif: String.raw`(?:du code de la sécurité sociale|du CSS\b)` },
] as const

// « 197 », « 1657 », « L. 521-1 », « 197 A », « 197 bis ».
const numero = String.raw`(?:[LRD]\.? ?)?\d+(?:-\d+)*(?: (?:bis|ter|quater|quinquies|[A-Z]{1,2}(?![\wÀ-ÿ])))?`
const liste = `${numero}(?:(?:, | et | à )(?:[Ll]'article )?${numero})*`

function cle(article: string): string {
  return article.replace(/[. ]/g, '').toUpperCase()
}

/** Articles suivis cités avec le nom de leur code. Un numéro sans code n'est jamais rattaché. */
function citations(texte: string): ArticleSuivi[] {
  const trouves: ArticleSuivi[] = []
  for (const { code, motif } of nomsDeCodes) {
    const formes = [
      // « l'article 197 du code général des impôts »
      new RegExp(String.raw`\b[Aa]rticles? (${liste}) ${motif}`, 'g'),
      // « CGI, art. 197 »
      new RegExp(String.raw`\b${code},? (?:art\.|articles?) (${liste})`, 'g'),
    ]
    for (const forme of formes) {
      for (const [, cites = ''] of texte.matchAll(forme)) {
        for (const [cite] of cites.matchAll(new RegExp(numero, 'g'))) {
          const article = articlesSuivis.find((a) => a.code === code && cle(a.article) === cle(cite))
          // Les plages « 193 à 197 » ne sont pas développées : seules les bornes citées comptent.
          if (article) trouves.push(article)
        }
      }
    }
  }
  return trouves
}

export function correspondances(amendement: Amendement): Correspondance[] {
  const resultat = new Map<string, Correspondance>()
  for (const [origine, texte] of [
    ['article_cible', amendement.articleCible],
    ['dispositif', amendement.dispositif],
  ] as const) {
    for (const article of citations(texteNormalise(texte))) {
      if (!resultat.has(article.legiarti)) resultat.set(article.legiarti, { ...article, origine })
    }
  }
  return [...resultat.values()]
}

/** « 1 483 » -> 1483 ; « 45,25 » -> 45.25. */
const nombre = (texte: string) => Number(texte.replace(/ /g, '').replace(',', '.'))
const entier = String.raw`(\d{1,3}(?: \d{3})*|\d+)`
const decimal = String.raw`(\d{1,3}(?:,\d{1,2})?)`
const cgi197 = "de l'article 197 du code général des impôts"

// Chaque motif couvre la phrase ENTIÈRE : toute réserve, condition ou négation la rend non reconnue.
const indexation = new RegExp(
  String.raw`^au 1 du I ${cgi197}, (?:les montants|chacun des montants|les limites des tranches(?: du barème)?) (?:sont|est) (?:relevée?s?|revalorisée?s?|majorée?s?) de ${decimal} ?%\.$`,
  'i',
)
const abrogationSeuil = /^le 1 bis de l'article 1657 du code général des impôts est (?:abrogé|supprimé)\.$/i
const abrogationDecote = new RegExp(
  String.raw`^le (?:a du )?4 du I ${cgi197} est (?:abrogé|supprimé)\.$`,
  'i',
)
const modificationDecote = new RegExp(String.raw`^au a du 4 du I ${cgi197}, (.+)\.$`, 'i')
const remplacementMontant = new RegExp(
  `^le montant ?:? « ?(897|1 483) ?€ ?» est remplacé par le montant ?:? « ?${entier} ?€ ?»$`,
  'i',
)
const remplacementTaux = new RegExp(
  `^le taux ?:? « ?45,25 ?% ?» est remplacé par le taux ?:? « ?${decimal} ?% ?»$`,
  'i',
)
// Gage de recevabilité financière : sans effet sur les paramètres de l'impôt sur le revenu.
const gage =
  /^la perte de recettes (?:résultant [^.;]{1,80} )?pour l'État est compensée,? à due concurrence,? par (?:la création d'une taxe additionnelle à|la majoration de) l'accise sur les tabacs(?: prévue au [^.;]{1,160})?\.$/i

function lirePhrase(phrase: string): Parametre[] | null {
  if (gage.test(phrase)) return []
  const pourcentage = indexation.exec(phrase)?.[1]
  if (pourcentage) {
    const valeur = nombre(pourcentage)
    return valeur > 0 && valeur <= 100 ? [{ type: 'indexation_bareme', pourcentage: valeur }] : null
  }
  if (abrogationSeuil.test(phrase)) return [{ type: 'suppression_seuil_61' }]
  if (abrogationDecote.test(phrase)) return [{ type: 'suppression_decote' }]
  const remplacements = modificationDecote.exec(phrase)?.[1]
  if (!remplacements) return null
  const parametres: Parametre[] = []
  for (const segment of remplacements.split(/(?: et |, | ; )(?=le (?:montant|taux))/i)) {
    const [, ancien, nouveau] = remplacementMontant.exec(segment) ?? []
    if (ancien && nouveau) {
      const type = ancien === '897' ? 'decote_montant_celibataire' : 'decote_montant_couple'
      parametres.push({ type, euros: nombre(nouveau) })
      continue
    }
    const taux = remplacementTaux.exec(segment)?.[1]
    if (!taux || nombre(taux) > 100) return null
    parametres.push({ type: 'decote_taux', pourcentage: nombre(taux) })
  }
  return parametres
}

export function extraireParametres(dispositif: string): Extraction {
  const phrases = texteNormalise(dispositif)
    .split(/\n|(?<=\.) (?=[A-ZÀ-Ü])/)
    // Numérotation de l'amendement : « I. – », « 1° ».
    .map((phrase) => phrase.replace(/^(?:[IVX]+\. ?[–—-]|\d+° ?(?:[–—-])?) ?/, '').trim())
    .filter(Boolean)
  const parametres: Parametre[] = []
  const phrasesNonReconnues: string[] = []
  for (const phrase of phrases) {
    const lus = lirePhrase(phrase)
    if (lus) parametres.push(...lus)
    else phrasesNonReconnues.push(phrase)
  }
  // Deux fois le même paramètre, ou abroger et modifier la décote : lecture à confier à un humain.
  const types = parametres.map((p) => p.type)
  const contradiction =
    new Set(types).size !== types.length ||
    (types.includes('suppression_decote') && types.some((t) => t.startsWith('decote_')))
  return {
    parametres,
    phrasesNonReconnues,
    complete: parametres.length > 0 && phrasesNonReconnues.length === 0 && !contradiction,
  }
}

/** Valide un lot d'amendements et ne garde que ceux qui touchent un article suivi. */
export function veille(json: unknown): AmendementSuivi[] {
  if (!Array.isArray(json)) throw new TypeError('Lot invalide : un tableau d’amendements est attendu.')
  return json.flatMap((element) => {
    const amendement = parseAmendement(element)
    const trouvees = correspondances(amendement)
    if (!trouvees.length) return []
    return [{ amendement, correspondances: trouvees, extraction: extraireParametres(amendement.dispositif) }]
  })
}
