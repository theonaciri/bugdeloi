import type { legalSection } from '@bugdeloi/db/schema'
import type { Article, Structure } from './xml.ts'

export type Section = Omit<typeof legalSection.$inferInsert, 'lastRunId'>
export type Placement = { id: string; sectionId: string | null; position: number }
export type Dated = Pick<Article, 'etat' | 'dateDebut' | 'dateFin'>

export function isInForce(unit: Dated, asOf: string): boolean {
  const { etat, dateDebut, dateFin } = unit
  return (
    etat !== 'ANNULE' &&
    etat !== 'NON_VIGUEUR' &&
    etat !== 'MODIFIE_MORT_NE' &&
    Boolean(dateDebut && dateDebut <= asOf) &&
    (!dateFin || dateFin === '2999-01-01' || asOf < dateFin)
  )
}

export function projectTree(
  textId: string,
  structures: Map<string, Structure>,
  knownArticles: Set<string>,
  asOf: string,
) {
  const sections = new Map<string, Section>()
  const placements = new Map<string, Placement>()
  const missingSections = new Set<string>()
  const missingArticles = new Set<string>()
  let duplicatePlacements = 0

  function visit(id: string, path: string, depth: number) {
    const node = structures.get(id)
    if (!node) {
      missingSections.add(id)
      return
    }
    let position = 0
    for (const child of node.children) {
      if (!isInForce(child, asOf)) continue
      ++position
      if (child.kind === 'article') {
        if (!knownArticles.has(child.id)) {
          missingArticles.add(child.id)
        } else if (placements.has(child.id)) {
          duplicatePlacements++
        } else {
          placements.set(child.id, { id: child.id, sectionId: id === textId ? null : id, position })
        }
        continue
      }
      // Les identifiants sont uniques dans la projection. Le premier chemin DILA prime.
      if (sections.has(child.id)) {
        duplicatePlacements++
        continue
      }
      if (!structures.has(child.id)) {
        missingSections.add(child.id)
        continue
      }
      const section = {
        id: child.id,
        textId,
        parentId: id === textId ? null : id,
        path: `${path}.${child.id}`,
        depth: depth + 1,
        position,
        title: child.title ?? structures.get(child.id)?.title ?? '',
        etat: child.etat,
        dateDebut: child.dateDebut,
        dateFin: child.dateFin,
      }
      sections.set(child.id, section)
      visit(child.id, section.path, section.depth)
    }
  }
  if (!structures.has(textId)) throw new Error(`Document racine absent : ${textId}`)
  visit(textId, textId, 0)
  return { sections, placements, missingSections, missingArticles, duplicatePlacements }
}

export type Summary = {
  sections: number
  depth: number
  active: number
  unplaced: number
  rootArticles: number
  versions: number
  links: Record<string, number>
  missingSections: number
  missingArticles: number
  duplicatePlacements: number
}

export function summarize(
  tree: ReturnType<typeof projectTree>,
  articles: (Dated & { id: string })[],
  asOf: string,
  links: Record<string, number>,
): Summary {
  const active = articles.filter((article) => isInForce(article, asOf))
  return {
    sections: tree.sections.size,
    depth: Math.max(0, ...Array.from(tree.sections.values(), (section) => section.depth)),
    active: active.length,
    unplaced: active.filter(({ id }) => !tree.placements.has(id)).length,
    rootArticles: active.filter(({ id }) => tree.placements.get(id)?.sectionId === null).length,
    versions: articles.length,
    links,
    missingSections: tree.missingSections.size,
    missingArticles: tree.missingArticles.size,
    duplicatePlacements: tree.duplicatePlacements,
  }
}
