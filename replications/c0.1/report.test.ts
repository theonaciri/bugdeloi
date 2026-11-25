import { expect, test } from 'bun:test'
import { articleHeadings } from './coverage.ts'
import { buildErrors, parseClerkReport } from './report.ts'

test('compte les tests de scope et les tests CLI du rapport Clerk', () => {
  const output = JSON.stringify({
    'test-results': [
      {
        file: '/work/tests.catala_fr',
        tests: {
          scopes: [{ scope_name: 'Test', success: false, errors: [{ message: 'Assertion échouée' }] }],
          'inline-tests': [{ cmd: 'catala interpret', success: true }],
        },
      },
    ],
  })
  expect(parseClerkReport(`[1/1] Test\n${output}\n`)).toEqual([
    {
      file: 'tests.catala_fr',
      tests: 2,
      passed: 1,
      failed: 1,
      errors: ['Assertion échouée'],
      failedCases: ['Test'],
    },
  ])
  expect(() => parseClerkReport('[ERROR] Impossible de compiler.')).toThrow()
})

test('rattache un échec Ninja à son fichier', () => {
  expect(buildErrors('FAILED: /build/example.catala_fr@test\n[ERROR] Message\n')).toEqual([
    {
      file: 'example.catala_fr',
      tests: 0,
      passed: 0,
      failed: 0,
      errors: ['[ERROR] Message'],
      failedCases: [],
    },
  ])
})

test('relève les titres Article avec les positions, hors blocs de code', () => {
  const heading = '####### Article X | LEGIARTI000000000000 [archive]'
  expect(
    articleHeadings(['~~~catala', heading, '~~~', heading, '### Annexe | LEGIARTI000000000001'].join('\r\n')),
  ).toEqual([{ heading, legiarti: 'LEGIARTI000000000000', line: 4 }])
})
