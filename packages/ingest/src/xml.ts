import { LEGIARTI_RE, LEGISCTA_RE, legalTextHash, normalizeLegalText } from '@bugdeloi/core'
import type { LegiChild, legalArticle, legalLink, legalText } from '@bugdeloi/db/schema'
import { SaxesParser } from 'saxes'

type Node = {
  name: string
  attributes: Record<string, string>
  children: Node[]
  text: string
}

function readXml(xml: string, rootName: string): Node {
  const parser = new SaxesParser()
  const document: Node = { name: '', attributes: {}, children: [], text: '' }
  const stack = [document]
  let raw: { node: Node; start: number; depth: number } | undefined

  parser.on('error', (error) => {
    throw error
  })
  parser.on('doctype', () => {
    throw new Error('DOCTYPE inattendu dans un XML LEGI')
  })
  parser.on('opentag', (tag) => {
    if (raw) {
      raw.depth++
      return
    }
    const node: Node = { name: tag.name, attributes: tag.attributes, children: [], text: '' }
    stack.at(-1)?.children.push(node)
    stack.push(node)
    if (tag.name === 'CONTENU' && !tag.isSelfClosing) {
      raw = { node, start: parser.position, depth: 0 }
    }
  })
  parser.on('closetag', () => {
    if (raw && raw.depth > 0) {
      raw.depth--
      return
    }
    if (raw) {
      raw.node.text = xml.slice(raw.start, xml.lastIndexOf('</', parser.position - 1))
      raw = undefined
    }
    stack.pop()
  })
  function appendText(value: string) {
    const node = stack.at(-1)
    if (node && !raw) node.text += value
  }
  parser.on('text', appendText)
  parser.on('cdata', appendText)
  parser.write(xml).close()

  const root = document.children[0]
  if (root?.name !== rootName) throw new Error(`Racine XML attendue : ${rootName}`)
  return root
}

function at(node: Node | undefined, ...path: string[]): Node | undefined {
  for (const name of path) node = node?.children.find((entry) => entry.name === name)
  return node
}

function requireValue(value: string | undefined, field: string): string {
  if (!value) throw new Error(`Champ XML manquant : ${field}`)
  return value
}

function checkId(value: string | undefined, expected: RegExp): string {
  if (!value || !expected.test(value)) throw new Error(`Identifiant XML inattendu : ${value}`)
  return value
}

export function parseDate(value: string | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(+date) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`Date invalide : ${value}`)
  }
  return value
}

function verifyId(actual: string | undefined, expected: string) {
  if (actual !== expected) throw new Error(`Le XML de ${expected} porte l’identifiant ${actual}`)
}

export type Article = Pick<
  typeof legalArticle.$inferInsert,
  | 'id'
  | 'textId'
  | 'num'
  | 'articleKey'
  | 'etat'
  | 'type'
  | 'dateDebut'
  | 'dateFin'
  | 'contentHtml'
  | 'contentText'
  | 'textSha256'
  | 'notaHtml'
  | 'versionIds'
>
export type Link = Omit<typeof legalLink.$inferInsert, 'id'>
export type ArticleDocument = { article: Article; links: Link[] }
export type TextDocument = Pick<
  typeof legalText.$inferInsert,
  'id' | 'title' | 'shortTitle' | 'nature' | 'etat' | 'dateDebut' | 'dateFin'
>

export type Structure = { id: string; title: string | null; children: LegiChild[] }

export function parseArticle(xml: string, id: string, textId: string): ArticleDocument {
  const root = readXml(xml, 'ARTICLE')
  verifyId(at(root, 'META', 'META_COMMUN', 'ID')?.text, id)
  const meta = at(root, 'META', 'META_SPEC', 'META_ARTICLE')
  if (!meta) throw new Error('META_ARTICLE manquant')
  const num = at(meta, 'NUM')?.text.trim() || null
  const contentHtml = at(root, 'BLOC_TEXTUEL', 'CONTENU')?.text ?? ''
  const versions = at(root, 'VERSIONS')?.children.filter((node) => node.name === 'VERSION') ?? []
  const versionIds = versions.flatMap((version) =>
    version.children
      .filter((entry) => entry.name === 'LIEN_ART')
      .map((entry) => checkId(entry.attributes.id, LEGIARTI_RE)),
  )
  const article: Article = {
    id,
    textId,
    num,
    articleKey: num === null ? null : `${textId}:${num}`,
    etat: at(meta, 'ETAT')?.text || null,
    type: at(meta, 'TYPE')?.text || null,
    dateDebut: parseDate(at(meta, 'DATE_DEBUT')?.text),
    dateFin: parseDate(at(meta, 'DATE_FIN')?.text),
    contentHtml,
    contentText: normalizeLegalText(contentHtml),
    textSha256: legalTextHash(contentHtml),
    notaHtml: at(root, 'NOTA', 'CONTENU')?.text ?? null,
    versionIds: [...new Set(versionIds)],
  }
  const links =
    at(root, 'LIENS')
      ?.children.filter((node) => node.name === 'LIEN')
      .map((node): Link => {
        const attrs = node.attributes
        return {
          articleId: id,
          typeLien: requireValue(attrs.typelien, 'LIEN.typelien'),
          sens: requireValue(attrs.sens, 'LIEN.sens'),
          targetId: attrs.id || null,
          targetCid: attrs.cidtexte || null,
          targetNum: attrs.num || null,
          targetTextNum: attrs.numtexte || null,
          targetNature: attrs.naturetexte || null,
          targetNor: attrs.nortexte || null,
          targetDate: parseDate(attrs.datesignatexte),
          label: node.text || null,
        }
      }) ?? []
  return { article, links }
}

export function parseText(xml: string, id: string, shortTitle: string): TextDocument {
  const root = readXml(xml, 'TEXTE_VERSION')
  const common = at(root, 'META', 'META_COMMUN')
  verifyId(at(common, 'ID')?.text, id)
  const meta = at(root, 'META', 'META_SPEC', 'META_TEXTE_VERSION')
  return {
    id,
    title: requireValue(at(meta, 'TITREFULL')?.text || at(meta, 'TITRE')?.text, 'TITREFULL/TITRE'),
    shortTitle,
    nature: at(common, 'NATURE')?.text || null,
    etat: at(meta, 'ETAT')?.text || null,
    dateDebut: parseDate(at(meta, 'DATE_DEBUT')?.text),
    dateFin: parseDate(at(meta, 'DATE_FIN')?.text),
  }
}

export function parseStructure(xml: string, id: string, root: boolean): Structure {
  const node = readXml(xml, root ? 'TEXTELR' : 'SECTION_TA')
  verifyId((root ? at(node, 'META', 'META_COMMUN', 'ID') : at(node, 'ID'))?.text, id)
  const children: LegiChild[] = []
  for (const entry of at(node, root ? 'STRUCT' : 'STRUCTURE_TA')?.children ?? []) {
    if (entry.name !== 'LIEN_ART' && entry.name !== 'LIEN_SECTION_TA') {
      throw new Error(`Lien de structure inconnu : ${entry.name}`)
    }
    const kind = entry.name === 'LIEN_ART' ? 'article' : 'section'
    children.push({
      kind,
      id: checkId(entry.attributes.id, kind === 'article' ? LEGIARTI_RE : LEGISCTA_RE),
      etat: entry.attributes.etat || null,
      dateDebut: parseDate(entry.attributes.debut),
      dateFin: parseDate(entry.attributes.fin),
      title: kind === 'section' ? entry.text.trim() || null : null,
    })
  }
  return { id, title: root ? null : at(node, 'TITRE_TA')?.text.trim() || null, children }
}
