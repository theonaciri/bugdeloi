import { describe, expect, test } from 'bun:test'
import { totalOf } from './levels.ts'
import { buildMapTree, layoutTreemap, levelBands, type MapNode } from './map-tree.ts'

const T = 'LEGITEXT000000000001'
const focus = { id: T, path: T, title: 'Code fictif' }
const S = (n: number) => `LEGISCTA${String(n).padStart(12, '0')}`
const sections = [
  { id: S(1), path: `${T}.${S(1)}`, title: 'Livre I', position: 1 },
  { id: S(2), path: `${T}.${S(2)}`, title: 'Livre II', position: 2 },
  { id: S(11), path: `${T}.${S(1)}.${S(11)}`, title: 'Titre I', position: 1 },
  { id: S(12), path: `${T}.${S(1)}.${S(12)}`, title: 'Titre II', position: 2 },
  { id: S(99), path: `AUTRE.${S(99)}`, title: 'Hors focus', position: 1 },
]
const counts = [
  { anc: `${T}.${S(1)}.${S(11)}`, level: 'N0', n: 10 },
  { anc: `${T}.${S(1)}.${S(11)}`, level: 'N2', n: 5 },
  { anc: `${T}.${S(1)}.${S(12)}`, level: 'REF', n: 3 },
  { anc: `${T}.${S(1)}`, level: 'N0', n: 2 }, // articles propres au Livre I
  { anc: `${T}.${S(2)}`, level: 'N1', n: 4 },
  { anc: `${T}.${S(2)}`, level: 'INCONNU', n: 1 }, // niveau hors échelle → N0
  { anc: T, level: 'N0', n: 999 }, // ignoré : articles du focus envoyés un par un
]
const articles = [{ id: 'LEGIARTI000000000001', num: '1', level: 'N3', flags: ['contested'], position: 0 }]

function find(node: MapNode, id: string, kind?: string): MapNode | undefined {
  if (node.id === id && (!kind || node.kind === kind)) return node
  for (const c of node.children) {
    const f = find(c, id, kind)
    if (f) return f
  }
  return undefined
}

describe('buildMapTree', () => {
  const tree = buildMapTree(focus, sections, counts, articles)

  test('respecte la hiérarchie et ignore ce qui est hors du focus', () => {
    expect(tree.children.map((c) => c.label)).toEqual(['Article 1', 'Livre I', 'Livre II'])
    expect(find(tree, S(99))).toBeUndefined()
    expect(find(tree, S(1))?.children.map((c) => c.kind)).toEqual(['direct', 'section', 'section'])
  })

  test('remonte les comptes de bas en haut', () => {
    expect(find(tree, S(11))?.counts).toMatchObject({ N0: 10, N2: 5 })
    expect(find(tree, S(1), 'section')?.counts).toMatchObject({ N0: 12, N2: 5, REF: 3 })
    expect(find(tree, S(2))?.counts).toMatchObject({ N0: 1, N1: 4 })
    expect(totalOf(tree.counts)).toBe(1 + 20 + 5)
    expect(tree.counts.N3).toBe(1)
  })

  test('les articles du focus sont des feuilles avec leur niveau et leurs drapeaux', () => {
    const a = find(tree, 'LEGIARTI000000000001')
    expect(a?.kind).toBe('article')
    expect(a?.level).toBe('N3')
    expect(a?.flags).toEqual(['contested'])
  })
})

describe('layoutTreemap', () => {
  const tree = buildMapTree(focus, sections, counts, articles)
  const rects = layoutTreemap(tree, 1000, 600)

  test('surface proportionnelle au nombre d’articles', () => {
    const leaves = rects.filter((r) => r.leaf)
    const area = (r: { x0: number; y0: number; x1: number; y1: number }) => (r.x1 - r.x0) * (r.y1 - r.y0)
    const t11 = leaves.find((r) => r.node.id === S(11))
    const t12 = leaves.find((r) => r.node.id === S(12))
    expect(t11 && t12).toBeTruthy()
    // 15 articles contre 3 : le rapport des surfaces est proche de 5 (arrondis et marges).
    const ratio = area(t11 as never) / area(t12 as never)
    expect(ratio).toBeGreaterThan(3.5)
    expect(ratio).toBeLessThan(6.5)
  })

  test('toutes les tuiles restent dans le cadre', () => {
    for (const r of rects) {
      expect(r.x0).toBeGreaterThanOrEqual(0)
      expect(r.y0).toBeGreaterThanOrEqual(0)
      expect(r.x1).toBeLessThanOrEqual(1000)
      expect(r.y1).toBeLessThanOrEqual(600)
    }
  })

  test('les nœuds de profondeur 1 avec enfants sont des cadres', () => {
    expect(rects.find((r) => r.node.id === S(1) && r.node.kind === 'section')?.leaf).toBe(false)
  })

  test('arbre vide : aucune tuile', () => {
    expect(layoutTreemap(buildMapTree(focus, [], [], []), 1000, 600)).toEqual([])
  })

  test('reste rapide avec ~10 000 articles', () => {
    const many = Array.from({ length: 10_000 }, (_, i) => ({
      id: `LEGIARTI${String(i).padStart(12, '0')}`,
      num: String(i),
      level: i % 7 === 0 ? 'N2' : 'N0',
      flags: [],
      position: i,
    }))
    const t0 = performance.now()
    const r = layoutTreemap(buildMapTree(focus, [], [], many), 1000, 600)
    expect(r.length).toBe(10_000)
    expect(performance.now() - t0).toBeLessThan(1000)
  })
})

describe('levelBands', () => {
  test('couvre exactement la tuile, dans l’ordre de l’échelle', () => {
    const bands = levelBands(10, 20, 100, 40, { N0: 1, N1: 0, N2: 1, N3: 0, N4: 0, N5: 0, REF: 2 })
    expect(bands.map((b) => b.level)).toEqual(['N0', 'N2', 'REF'])
    expect(bands.reduce((s, b) => s + b.width, 0)).toBe(100)
    expect(bands[0]).toEqual({ level: 'N0', x: 10, y: 20, width: 25, height: 40 })
    expect(bands[2]?.x).toBe(60)
  })
  test('découpe verticale si la tuile est haute', () => {
    const bands = levelBands(0, 0, 10, 100, { N0: 1, N1: 1, N2: 0, N3: 0, N4: 0, N5: 0, REF: 0 })
    expect(bands.map((b) => [b.y, b.height])).toEqual([
      [0, 50],
      [50, 50],
    ])
  })
  test('rien à découper', () => {
    expect(levelBands(0, 0, 10, 10, { N0: 0, N1: 0, N2: 0, N3: 0, N4: 0, N5: 0, REF: 0 })).toEqual([])
  })
})

describe('fenêtre à trois niveaux', () => {
  test('une section de profondeur 3 devient une feuille agrégée, sa mère garde ses articles propres', () => {
    const deep = [
      ...sections,
      { id: S(111), path: `${T}.${S(1)}.${S(11)}.${S(111)}`, title: 'Chapitre I', position: 1 },
    ]
    const c = [
      { anc: `${T}.${S(1)}.${S(11)}.${S(111)}`, level: 'N1', n: 7 },
      { anc: `${T}.${S(1)}.${S(11)}`, level: 'N0', n: 2 },
    ]
    const tree = buildMapTree(focus, deep, c, [])
    const t11 = find(tree, S(11), 'section')
    expect(t11?.children.map((x) => x.kind)).toEqual(['direct', 'section'])
    expect(t11?.counts).toMatchObject({ N0: 2, N1: 7 })
    const rects = layoutTreemap(tree, 1000, 600)
    expect(rects.find((r) => r.node.id === S(111))?.depth).toBe(3)
  })
})
