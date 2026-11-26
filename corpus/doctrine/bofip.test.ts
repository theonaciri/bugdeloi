import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import {
  BOFIP_REF_PATTERN,
  type BofipIndex,
  bofipUrl,
  buildIndex,
  CORE_MAPPINGS,
} from './build-bofip-index.ts'

const index = (await Bun.file(join(import.meta.dir, 'bofip-index.json')).json()) as BofipIndex
const groundTruth = await Bun.file(
  join(import.meta.dir, '..', '..', 'replications/c0.4/ground-truth.json'),
).json()

describe('bofip-index.json', () => {
  test('métadonnées cohérentes', () => {
    expect(index.generatedFrom.sourceCommit).toMatch(/^[0-9a-f]{40}$/)
    expect(index.totalArticles).toBe(Object.keys(index.articles).length)
    expect(index.totalReferences).toBe(Object.values(index.articles).reduce((n, e) => n + e.length, 0))
  })

  test('clés LEGIARTI valides, entrées valides', () => {
    for (const [legiarti, entries] of Object.entries(index.articles)) {
      expect(legiarti).toMatch(/^LEGIARTI\d{12}$/)
      expect(entries.length).toBeGreaterThan(0)
      for (const entry of entries) {
        expect(entry.bofipRef).toMatch(BOFIP_REF_PATTERN)
        expect(entry.title.length).toBeGreaterThan(0)
        expect(entry.url).toBe(bofipUrl(entry.bofipRef))
        expect(entry.url.startsWith('https://bofip.impots.gouv.fr/')).toBe(true)
        expect(['inria_catala_examples', 'cgi_noyau_ir']).toContain(entry.source)
        expect(entry.note).toContain('DIVERGENCE_DOCTRINE')
        if (entry.source === 'inria_catala_examples') expect(entry.evidence?.line).toBeGreaterThan(0)
      }
    }
  })

  test('pas de doublon (article, référence)', () => {
    for (const entries of Object.values(index.articles)) {
      const refs = entries.map((e) => e.bofipRef)
      expect(new Set(refs).size).toBe(refs.length)
    }
  })

  test('articles du noyau IR présents', () => {
    for (const core of CORE_MAPPINGS) {
      const refs = (index.articles[core.legiarti] ?? []).map((e) => e.bofipRef)
      for (const ref of core.bofipRefs) expect(refs).toContain(ref)
    }
  })

  test('toute référence Inria rattachée du ground-truth est indexée', () => {
    for (const item of groundTruth.items) {
      if (item.kind !== 'dependance_bofip' || !item.nearestLegiarti) continue
      const refs = (index.articles[item.nearestLegiarti] ?? []).map((e) => e.bofipRef)
      expect(refs).toContain(item.bofipRef)
    }
  })

  test('génération déterministe', () => {
    const rebuilt = buildIndex(groundTruth, index.generatedFrom.groundTruth)
    expect(JSON.stringify(rebuilt)).toBe(JSON.stringify(index))
  })
})
