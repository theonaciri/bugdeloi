import type { MapNode } from './map-tree.ts'

/** Lien de navigation d'un nœud de la carte (descente dans une section, ou fiche article). */
export function nodeHref(code: string, node: MapNode): string {
  if (node.kind === 'article') return `/article/${node.id}`
  if (node.kind === 'focus') return `/carte?code=${code}`
  return `/carte?code=${code}&s=${node.id}`
}
