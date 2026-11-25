import { type Article, type ArticleIndex, type Code, codes } from './tricoteuses.ts'

export const date = '2026-11-25'
export const types = ['REF_MORTE', 'SYNTAXE', 'NUMEROTATION'] as const
export const verdicts = ['confirmé', 'infirmé', 'indéterminé'] as const
export type FindingType = (typeof types)[number]
export type Verdict = (typeof verdicts)[number]
export type Result = {
  id: string
  type: FindingType
  verdict: Verdict
  raison: string
  fichiers: string[]
}
type ObjectData = Record<string, unknown>

export function object(value: unknown): ObjectData {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as ObjectData) : {}
}

function strings(values: unknown[]): string[] {
  return values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function codeOf(value: unknown): Code | undefined {
  return codes.find((code) => code === value)
}

export function normalize(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[’‘ʼ]/gu, "'")
    .replace(/[«»“”]/gu, '"')
    .replace(/[‐‑‒–—―−]/gu, '-')
    .replace(/\s+/gu, ' ')
    .trim()
}

export function inForce(article: Article, at = date): boolean {
  return (
    article.start <= at &&
    at < article.end &&
    ['VIGUEUR', 'VIGUEUR_DIFF', 'ABROGE_DIFF', 'MODIFIE'].includes(article.state) &&
    !(article.state === 'MODIFIE' && article.end === '2999-01-01')
  )
}

// Les préfixes répétés en tête d'alinéa prolongent une citation sur plusieurs alinéas.
function quoteScan(paragraphs: string[]) {
  const problems: string[] = []
  const scopes: number[] = []
  const open: { mark: string; scope: number }[] = []
  let serial = 0
  for (const text of paragraphs) {
    scopes.push(open.at(-1)?.scope ?? 0)
    for (const match of text.matchAll(/["“”«»]/gu)) {
      const mark = match[0]
      const active = open.at(-1)?.mark
      if (active === mark && match.index === 0 && text.length > 1) continue
      const expectedOpening = mark === '”' ? '“' : mark === '»' ? '«' : mark
      if (active === expectedOpening && mark !== '“' && mark !== '«') {
        open.pop()
      } else if (mark === '”' || mark === '»') {
        problems.push(mark === '»' ? 'guillemet_francais_non_ouvert' : 'guillemet_droit_non_apparie')
      } else {
        open.push({ mark, scope: ++serial })
      }
    }
  }
  for (const { mark } of open) {
    problems.push(mark === '«' ? 'guillemet_francais_non_ferme' : 'guillemet_droit_non_apparie')
  }
  return { problems, scopes }
}

export function syntaxProblems(paragraphs: string[]): string[] {
  const problems = quoteScan(paragraphs).problems
  let parentheses = 0
  let brackets = 0
  for (const original of paragraphs) {
    const text = original.replace(
      /^(?:"|“|«)?\s*(?:\d+°?|[a-z]|[ivxlcdm]+)(?:\s+(?:bis|ter|quater))?\)(?=\s|$)/i,
      '',
    )
    for (const char of text) {
      switch (char) {
        case '(':
          parentheses++
          break
        case '[':
          brackets++
          break
        case ')':
          if (parentheses) parentheses--
          else problems.push('parenthese_non_ouverte')
          break
        case ']':
          if (brackets) brackets--
          else problems.push('crochet_non_ouvert')
          break
      }
    }
  }
  if (parentheses) problems.push('parenthese_non_fermee')
  if (brackets) problems.push('crochet_non_ferme')
  return problems
}

function subdivision(text: string) {
  return /^(?:[IVXLCDM]+(?:\s+(?:bis|ter|quater))?\s*[.\-–]|[A-Z][.\-–])(?=\s|[-–]|\d|$)/u.test(text)
    ? 0
    : /^\d+°(?=\s|$)/u.test(text)
      ? 1
      : /^\d+\.(?=\s|$)/u.test(text)
        ? 2
        : /^\p{Ll}\)(?=\s|$)/u.test(text)
          ? 3
          : undefined
}

export function compareSubdivisions(
  paragraphs: string[],
  previous: string,
  duplicate: string,
  marker: string,
) {
  const normalized = paragraphs.map(normalize)
  const excerpts = [previous, duplicate].map(normalize)
  const [first = [], second = []] = excerpts.map((excerpt) =>
    normalized.flatMap((line, index) => (excerpt && line.startsWith(excerpt) ? [index] : [])),
  )
  const start = first[0]
  const end = second[0]
  const rank = subdivision(marker)
  if (
    start === undefined ||
    end === undefined ||
    rank === undefined ||
    start >= end ||
    first.length !== 1 ||
    second.length !== 1 ||
    ![start, end].every((index) => normalized[index]?.startsWith(`${normalize(marker)} `))
  ) {
    return 'extraits'
  }
  const { scopes } = quoteScan(paragraphs)
  if (scopes[start] !== scopes[end]) return 'citation'
  for (const line of paragraphs.slice(start + 1, end)) {
    const level = subdivision(line)
    if (level !== undefined && level < rank) return 'niveau'
    if (level === rank) return 'distance'
  }
  return 'repetition'
}

export function check(
  id: string,
  type: FindingType,
  certificate: ObjectData,
  corpus: Record<Code, ArticleIndex>,
): Result {
  const files = new Set<string>()
  const result = (verdict: Verdict, raison: string): Result => ({
    id,
    type,
    verdict,
    raison,
    fichiers: [...files].sort(),
  })
  const proof = object(certificate.proof)
  const source = object(proof.source)
  const code = codeOf(source.code)
  if (proof.projection_date !== date || !code || typeof source.id !== 'string') {
    return result('indéterminé', 'Date de projection ou version citante hors périmètre.')
  }
  const versions = corpus[code].byId.get(source.id) ?? []
  for (const article of versions) files.add(article.path)
  const article = versions[0]
  if (!article) return result('indéterminé', `Version citante ${source.id} absente de l’instantané ${code}.`)
  if (versions.length !== 1)
    return result('indéterminé', `Métadonnées multiples pour la version citante ${source.id}.`)
  if (!inForce(article)) {
    return result(
      'infirmé',
      `Version citante ${article.id} hors vigueur à la date de contrôle (${article.state}, ${article.start} à ${article.end}).`,
    )
  }

  if (type === 'REF_MORTE') {
    const lineage = object(proof.target_lineage)
    const last = object(lineage.derniere_version)
    const expectedState = object(proof.outcome).last_version_etat
    const targetCode = codeOf(lineage.code)
    const citation = object(proof.citation)
    const links = array(proof.links).map(object)
    const excerpts = strings([
      ...array(citation.occurrences).map((item) => object(item).excerpt),
      object(object(proof.text_mentions).first).excerpt,
    ])
    if (!targetCode || typeof expectedState !== 'string' || !excerpts.length) {
      return result(
        'indéterminé',
        'Extrait, code cible ou état annoncé absent du certificat ou hors périmètre.',
      )
    }
    const plain = normalize(article.paragraphs.join(' '))
    if (!excerpts.some((excerpt) => plain.includes(normalize(excerpt)))) {
      return result(
        'infirmé',
        `Aucun extrait cité du certificat retrouvé dans le corps de ${article.id} après normalisation.`,
      )
    }
    const target = corpus[targetCode].target(
      strings([last.id, ...links.map((link) => link.target_id)]),
      strings([citation.normalized_num, last.num, ...links.map((link) => link.target_num)]),
    )
    for (const item of target) files.add(item.path)
    const label = `${targetCode} ${strings([last.num, citation.raw, last.id])[0] ?? '(sans numéro)'}`
    const current = target.find((item) => inForce(item))
    if (current)
      return result(
        'infirmé',
        `Numéro cible ${label} en vigueur (${current.id}, depuis le ${current.start}).`,
      )
    const known = target.filter((item) => item.start <= date)
    if (!known.length)
      return result(
        'indéterminé',
        `Cible ${label} sans version datable à la date de contrôle dans l’instantané.`,
      )
    const mostRecent = known
      .map((item) => item.start)
      .sort()
      .at(-1)
    const latest = known.filter((item) => item.start === mostRecent)
    const states = new Set(latest.map((item) => item.state))
    if (states.size !== 1) return result('indéterminé', `Derniers états concurrents pour la cible ${label}.`)
    const lastKnown = latest[0]
    if (!lastKnown) throw new Error('Version la plus récente introuvable')
    if (lastKnown.end > date) {
      return result('indéterminé', `Dernière version de ${label} sans date de fin échue.`)
    }
    if (lastKnown.state !== expectedState) {
      return result(
        'infirmé',
        `Dernier état de ${label} dans l’instantané : ${lastKnown.state}, état annoncé : ${expectedState}.`,
      )
    }
    return result('confirmé', `Extrait présent, cible ${label} hors vigueur, dernier état ${expectedState}.`)
  }

  if (/^annexe/iu.test(article.num)) return result('indéterminé', 'Annexe hors périmètre de ce contrôle.')
  if (type === 'SYNTAXE') {
    const subtype = object(proof.defect).subtype
    if (typeof subtype !== 'string') return result('indéterminé', 'Sous-type syntaxique manquant.')
    return syntaxProblems(article.paragraphs).includes(subtype)
      ? result('confirmé', `Défaut d’appariement reproduit sur ${article.id} (${subtype}).`)
      : result('infirmé', `Défaut d’appariement annoncé absent sur ${article.id} (${subtype}).`)
  }

  if (certificate.subtype !== 'subdivision_dupliquee') {
    return result('indéterminé', 'Sous-type de numérotation hors du lot contrôlé.')
  }
  const previous = object(proof.previous).text
  const duplicate = object(proof.duplicate).text
  const marker = object(proof.marker).value
  if (typeof previous !== 'string' || typeof duplicate !== 'string' || typeof marker !== 'string') {
    return result('indéterminé', 'Extraits de subdivision incomplets.')
  }
  switch (compareSubdivisions(article.paragraphs, previous, duplicate, marker)) {
    case 'repetition':
      return result('confirmé', `Marqueur « ${marker} » répété dans la même subdivision.`)
    case 'citation':
      return result(
        'infirmé',
        `Le premier « ${marker} » appartient à une citation qui se ferme avant le second.`,
      )
    case 'niveau':
      return result('infirmé', `Une subdivision de niveau supérieur sépare les deux « ${marker} ».`)
    case 'distance':
      return result('infirmé', `Un autre marqueur du même niveau sépare les deux « ${marker} ».`)
    case 'extraits':
      return result('indéterminé', 'Impossible de localiser les deux extraits de subdivision sans ambiguïté.')
  }
}
