import { expect, test } from 'bun:test'
import { drawSample, mulberry32 } from './sample.ts'

const items = Array.from({ length: 100 }, (_, i) => ({
  fingerprint: `fp${String(i).padStart(3, '0')}`,
  stratum: i < 70 ? 'A' : i < 98 ? 'B' : 'C',
}))

test('tirage reproductible et indépendant de l’ordre d’entrée', () => {
  const a = drawSample(items, { A: 5, B: 3, C: 5 }, 42)
  const b = drawSample([...items].reverse(), { A: 5, B: 3, C: 5 }, 42)
  expect(a.map((i) => i.fingerprint)).toEqual(b.map((i) => i.fingerprint))
  expect(a.filter((i) => i.stratum === 'C')).toHaveLength(2) // strate trop petite : prise entière
  expect(a).toHaveLength(10)
})

test('la graine change le tirage', () => {
  const a = drawSample(items, { A: 5 }, 1).map((i) => i.fingerprint)
  const b = drawSample(items, { A: 5 }, 2).map((i) => i.fingerprint)
  expect(a).not.toEqual(b)
  expect(mulberry32(7)()).toBe(mulberry32(7)())
})
