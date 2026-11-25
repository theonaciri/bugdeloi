import { expect, test } from 'bun:test'
import { readVerifications } from './c03-verifications.ts'

const base = 'https://example.test/reports'

test('affiche les deux familles en attente avant l’arrivée des rapports', () => {
  expect(readVerifications('Test3', {}, base)).toEqual([
    { family: 'anthropic', url: null, verdict: null },
    { family: 'google', url: null, verdict: null },
  ])
})

test('identifie la famille et le verdict dans les tableaux et les listes Markdown', () => {
  const filename = '2026-11-25-c0.3-relecture.md'
  const reports = {
    [filename]:
      '- **Famille** : Google\r\n| `Test3` | **ambigui\u0308te\u0301** |\r\n- Test12 : inria_correct',
  }
  expect(readVerifications('Test3', reports, base)[1]).toEqual({
    family: 'google',
    url: `${base}/${filename}`,
    verdict: 'Plusieurs lectures sont possibles.',
  })
  expect(readVerifications('Test12', reports, base)[1]?.verdict).toBe('Le résultat Inria est retenu.')
})

test('renvoie le lien du rapport si le verdict manque ou si les verdicts se contredisent', () => {
  const filename = '2026-11-25-c0.3-claude.md'
  const reports = {
    [filename]: 'Test30 : les_deux_faux\nTest12 : en attente\nTest3 : inria_correct\nTest3 : indéterminé',
  }
  for (const name of ['Test3', 'Test12'] as const) {
    expect(readVerifications(name, reports, base)[0]).toEqual({
      family: 'anthropic',
      url: `${base}/${filename}`,
      verdict: null,
    })
  }
})
