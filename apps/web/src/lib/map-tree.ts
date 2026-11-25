/**
 * Arbre de la carte (/carte) et disposition en treemap.
 *
 * Le serveur n'envoie que la « fenêtre » autour de la section visée (le focus) : ses sections
 * descendantes sur `MAP_WINDOW` niveaux, les comptes d'articles en vigueur agrégés par niveau à
 * la profondeur la plus basse de la fenêtre, et les articles rattachés directement au focus. La charge reste donc
 * proportionnelle à ce qui est affiché, même pour un code de ~10 000 articles.
 *
 * Fonctions pures (pas d'accès base, pas de DOM) : testées dans `map-tree.test.ts`.
 */
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy'
import {
  addCounts,
  asLevel,
  emptyLevelCounts,
  LEVELS,
  type Level,
  type LevelCounts,
  totalOf,
} from './levels.ts'

export interface MapSectionRow {
  id: string
  path: string
  title: string
  position: number
}

/** Articles en vigueur agrégés : `anc` = chemin ltree de la section affichée qui les contient. */
export interface MapCountRow {
  anc: string
  level: string
  n: number
}

export interface MapArticleRow {
  id: string
  num: string | null
  level: string
  flags: string[]
  position: number
}

/** Nombre de niveaux de sections affichés sous le focus. */
export const MAP_WINDOW = 3

export type MapNodeKind = 'focus' | 'section' | 'direct' | 'article'

export interface MapNode {
  kind: MapNodeKind
  /** LEGISCTA, LEGIARTI ou LEGITEXT (focus = code entier). */
  id: string
  path: string
  label: string
  counts: LevelCounts
  /** Niveau de l'article (kind = article). */
  level?: Level
  flags?: string[]
  position: number
  children: MapNode[]
}

export interface MapFocus {
  id: string
  path: string
  title: string
}

function parentPath(path: string): string {
  const i = path.lastIndexOf('.')
  return i === -1 ? '' : path.slice(0, i)
}

function bySortKey(a: MapNode, b: MapNode): number {
  return a.position - b.position || a.label.localeCompare(b.label, 'fr', { numeric: true })
}

/**
 * Construit l'arbre affichable : focus → sections (sur MAP_WINDOW niveaux) → articles directs du focus.
 * Les comptes sont remontés de bas en haut ; un nœud sans article en vigueur garde un compte nul.
 */
export function buildMapTree(
  focus: MapFocus,
  sections: MapSectionRow[],
  counts: MapCountRow[],
  articles: MapArticleRow[],
): MapNode {
  const root: MapNode = {
    kind: 'focus',
    id: focus.id,
    path: focus.path,
    label: focus.title,
    counts: emptyLevelCounts(),
    position: 0,
    children: [],
  }
  const byPath = new Map<string, MapNode>([[focus.path, root]])
  const sorted = [...sections].sort((a, b) => a.path.split('.').length - b.path.split('.').length)
  for (const s of sorted) {
    if (s.path === focus.path || !s.path.startsWith(`${focus.path}.`)) continue
    const parent = byPath.get(parentPath(s.path))
    if (!parent) continue
    const node: MapNode = {
      kind: 'section',
      id: s.id,
      path: s.path,
      label: s.title,
      counts: emptyLevelCounts(),
      position: s.position,
      children: [],
    }
    parent.children.push(node)
    byPath.set(s.path, node)
  }

  // Comptes agrégés : d'abord dans un tampon par chemin, puis rattachés.
  const own = new Map<string, LevelCounts>()
  for (const row of counts) {
    if (row.anc === focus.path) continue // articles directs du focus : envoyés un par un
    const c = own.get(row.anc) ?? emptyLevelCounts()
    c[asLevel(row.level)] += Number(row.n)
    own.set(row.anc, c)
  }
  for (const [path, c] of own) {
    const node = byPath.get(path)
    if (!node || totalOf(c) === 0) continue
    if (node.children.length === 0) {
      addCounts(node.counts, c)
    } else {
      // Section qui a à la fois des sous-sections et des articles propres : tuile dédiée.
      node.children.push({
        kind: 'direct',
        id: node.id,
        path: `${node.path}#direct`,
        label: 'Articles rattachés directement',
        counts: c,
        position: -1,
        children: [],
      })
    }
  }

  for (const a of articles) {
    const level = asLevel(a.level)
    const c = emptyLevelCounts()
    c[level] = 1
    root.children.push({
      kind: 'article',
      id: a.id,
      path: `${focus.path}#${a.id}`,
      label: a.num ? `Article ${a.num}` : a.id,
      counts: c,
      level,
      flags: a.flags,
      position: a.position,
      children: [],
    })
  }

  const rollUp = (node: MapNode): LevelCounts => {
    node.children.sort(bySortKey)
    for (const child of node.children) addCounts(node.counts, rollUp(child))
    return node.counts
  }
  rollUp(root)
  return root
}

export interface TreemapRect {
  node: MapNode
  depth: number
  x0: number
  y0: number
  x1: number
  y1: number
  /** Vrai si la tuile est remplie (feuille) ; faux pour un cadre qui contient d'autres tuiles. */
  leaf: boolean
}

/** Hauteur réservée au titre d'un cadre de section, selon sa profondeur dans la fenêtre. */
export function groupHeader(depth: number): number {
  return depth === 1 ? 20 : depth === 2 ? 16 : 2
}

/**
 * Disposition squarifiée (d3-hierarchy). Surface = nombre d'articles en vigueur.
 * Coordonnées entières dans un repère `width × height` (le SVG utilise un viewBox).
 */
export function layoutTreemap(root: MapNode, width: number, height: number): TreemapRect[] {
  const h = hierarchy<MapNode>(root, (d) => (d.children.length > 0 ? d.children : null))
    .sum((d) => (d.children.length > 0 ? 0 : totalOf(d.counts)))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  if ((h.value ?? 0) === 0) return []
  const laid = treemap<MapNode>()
    .tile(treemapSquarify.ratio(1.4))
    .size([width, height])
    .round(true)
    .paddingInner(2)
    .paddingOuter((d) => (d.depth === 0 ? 0 : 2))
    .paddingTop((d) => (d.depth === 0 ? 0 : groupHeader(d.depth)))(h)
  const rects: TreemapRect[] = []
  for (const d of laid.descendants()) {
    if (d.depth === 0 || (d.value ?? 0) === 0) continue
    rects.push({ node: d.data, depth: d.depth, x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1, leaf: !d.children })
  }
  return rects
}

export interface Band {
  level: Level
  x: number
  y: number
  width: number
  height: number
}

/**
 * Découpe une tuile en bandes proportionnelles à la répartition par niveau, le long du côté
 * le plus long (du plus bas niveau au plus haut). Les bandes couvrent exactement la tuile.
 */
export function levelBands(x: number, y: number, width: number, height: number, counts: LevelCounts): Band[] {
  const total = totalOf(counts)
  if (total === 0 || width <= 0 || height <= 0) return []
  const horizontal = width >= height
  const side = horizontal ? width : height
  const bands: Band[] = []
  let acc = 0
  let offset = 0
  for (const level of LEVELS) {
    const n = counts[level]
    if (n === 0) continue
    acc += n
    const end = Math.round((acc / total) * side)
    const size = end - offset
    if (size > 0) {
      bands.push(
        horizontal
          ? { level, x: x + offset, y, width: size, height }
          : { level, x, y: y + offset, width, height: size },
      )
    }
    offset = end
  }
  return bands
}
