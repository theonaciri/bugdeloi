import { isInForce } from '@bugdeloi/core/legi'
import type { legalSection } from '@bugdeloi/db/schema'
import type { Article, Structure } from './xml.ts'

export type Section = Omit<typeof legalSection.$inferInsert, 'lastRunId'>
export type Placement = { id: string; sectionId: string | null; position: number }
export type Dated = Pick<Article, 'etat' | 'dateDebut' | 'dateFin'>

/** Règle partagée avec le site : voir @bugdeloi/core/legi. */
export { isInForce }

export function projectTree(
  textId: string,
  structures: Map<string, Structure>,
  knownArticles: Set<string>,
  asOf: string,
  /**
   * Métadonnées propres des versions d'articles. Si fournies, une version n'est placée dans l'arbre
   * que si elle est elle-même en vigueur (`isInForce`), même quand le lien de sa section la dit en
   * vigueur : l'arbre et les compteurs suivent alors exactement la même règle (cas CSS R611-2).
   */
  articleMeta?: Map<string, Dated>,
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
      if (child.kind === 'article') {
        const meta = articleMeta?.get(child.id)
        if (meta && !isInForce(meta, asOf)) continue
      }
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
