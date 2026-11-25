/** Lecture des éléments du certificat C0.2, sans consulter les articles courants en base. */
import { LEGIARTI_RE, legifranceArticleUrl } from './legi.ts'

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const string = (value: unknown): string | null => (typeof value === 'string' && value ? value : null)
const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

export function findingArticle(unit: string) {
  const [id, dateDebut] = unit.split('@')
  return id && LEGIARTI_RE.test(id)
    ? { id, dateDebut: dateDebut ?? null, url: legifranceArticleUrl(id) }
    : null
}

function version(value: unknown) {
  const data = object(value)
  const article = findingArticle(string(data.id) ?? '')
  if (!article) return null
  return {
    ...article,
    code: string(data.code),
    num: string(data.num),
    etat: string(data.etat),
    dateDebut: string(data.date_debut),
    dateFin: string(data.date_fin),
  }
}

function citationExcerpt(value: unknown) {
  const data = object(value)
  const text = string(data.excerpt)
  if (!text) return []
  const cited = string(data.cited)
  const offset =
    typeof data.start === 'number' && typeof data.excerpt_offset === 'number'
      ? data.start - data.excerpt_offset
      : -1
  if (cited && offset >= 0 && text.slice(offset, offset + cited.length) === cited) {
    return [{ before: text.slice(0, offset), marked: cited, after: text.slice(offset + cited.length) }]
  }
  return [{ before: '', marked: text, after: '' }]
}

export function findingEvidence(certificate: Record<string, unknown>) {
  const proof = object(certificate.proof)
  const hints = object(proof.hints)
  const occurrences = array(object(proof.citation).occurrences)
  const firstMention = object(proof.text_mentions).first
  const locations = array(object(proof.defect).locations)
  const excerpts = [
    ...[...occurrences, firstMention].flatMap(citationExcerpt),
    ...[
      ...locations.map((loc) => object(loc).excerpt),
      object(proof.previous).text,
      object(proof.duplicate).text,
    ].flatMap((value) =>
      typeof value === 'string' && value ? [{ before: '', marked: value, after: '' }] : [],
    ),
  ]
  const source = version(proof.source) ?? version(array(proof.versions)[0])
  return {
    source,
    target: version(object(proof.target_lineage).derniere_version),
    projectionDate: string(proof.projection_date),
    excerpts,
    hints: [...array(hints.near_citation), ...array(hints.near_marker)].flatMap((hint) => {
      const data = object(hint)
      return typeof data.phrase === 'string' ? [data.phrase] : []
    }),
    reproduction: object(certificate.independent_reproduction),
  }
}
