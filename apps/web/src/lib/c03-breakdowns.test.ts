import { expect, test } from 'bun:test'
import summary from '../../../../replications/c0.3/summary.json'
import { C03_BREAKDOWNS } from './c03-breakdowns.ts'

test('chaque décomposition retombe sur les montants du test C0.3', () => {
  for (const item of C03_BREAKDOWNS) {
    const inria = item.lines.reduce((sum, line) => sum + (line.inriaCents ?? 0), 0)
    const law = item.lines.reduce((sum, line) => sum + (line.lawCents ?? 0), 0)
    expect(inria).toBe(item.inriaCents)
    expect(law).toBe(item.lawCents)
    const result = summary.cases.find((c) => c.name === item.name)
    expect(result).toBeDefined()
    expect(Number(result?.expected)).toBe(item.inriaCents)
    expect(Number(result?.actual)).toBe(item.lawCents)
  }
})
