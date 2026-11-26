import { join } from 'node:path'
import { LEGIARTI_RE, sha256Hex } from '../../packages/core/src/legi.ts'

export const packetFile = join(import.meta.dir, 'task/blind-packet.json')
export const promptFile = join(import.meta.dir, 'task/PROMPT.md')
export const categories = [
  'appreciation',
  'perimetre',
  'renvoi_externe',
  'arrondi',
  'parametre',
  'calcul',
  'autre',
] as const
export type Category = (typeof categories)[number]

export interface BlindArticle {
  legiarti: string
  code: 'CGI' | 'CSS' | 'CCH'
  article: string | null
  dateDebut: string | null
  dateFin: string | null
  textSha256: string
  text: string
}

export interface BlindPacket {
  articles: BlindArticle[]
}

export interface Observation {
  legiarti: string
  category: Category
  quote: string
  explanation: string
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const articleKeys = ['legiarti', 'code', 'article', 'dateDebut', 'dateFin', 'textSha256', 'text']
const date = (value: unknown) =>
  value === null || (typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value))

function isArticle(value: unknown): value is BlindArticle {
  return (
    record(value) &&
    Object.keys(value).length === articleKeys.length &&
    articleKeys.every((key) => Object.hasOwn(value, key)) &&
    typeof value.legiarti === 'string' &&
    LEGIARTI_RE.test(value.legiarti) &&
    (value.code === 'CGI' || value.code === 'CSS' || value.code === 'CCH') &&
    (value.article === null || typeof value.article === 'string') &&
    date(value.dateDebut) &&
    date(value.dateFin) &&
    typeof value.text === 'string' &&
    Boolean(value.text.trim()) &&
    value.textSha256 === sha256Hex(value.text)
  )
}

export function parsePacket(value: unknown): BlindPacket {
  if (!record(value) || Object.keys(value).length !== 1 || !Array.isArray(value.articles)) {
    throw new Error('Format de paquet LEGI invalide.')
  }
  if (!value.articles.every(isArticle)) throw new Error('Article LEGI invalide dans le paquet.')
  const ids = new Set(value.articles.map(({ legiarti }) => legiarti))
  if (ids.size !== value.articles.length || ids.size === 0) {
    throw new Error('Paquet LEGI vide ou contenant des versions en double.')
  }
  return { articles: value.articles }
}

function isObservation(value: unknown): value is Observation {
  return (
    record(value) &&
    Object.keys(value).length === 4 &&
    typeof value.legiarti === 'string' &&
    LEGIARTI_RE.test(value.legiarti) &&
    categories.some((category) => category === value.category) &&
    typeof value.quote === 'string' &&
    Boolean(value.quote.trim()) &&
    typeof value.explanation === 'string' &&
    Boolean(value.explanation.trim())
  )
}

export function parseSubmission(value: unknown, packet: BlindPacket): Observation[] {
  if (!Array.isArray(value) || !value.every(isObservation)) {
    throw new Error('Format de soumission invalide.')
  }
  const articles = new Map(packet.articles.map(({ legiarti, text }) => [legiarti, text]))
  for (const [index, { legiarti, quote }] of value.entries()) {
    if (!articles.get(legiarti)?.includes(quote.trim())) {
      throw new Error(`Observation ${index + 1} : la citation doit figurer dans le texte LEGI ${legiarti}.`)
    }
  }
  return value
}

export function writeJson(name: string, value: unknown) {
  return Bun.write(join(import.meta.dir, name), `${JSON.stringify(value, null, 2)}\n`)
}
