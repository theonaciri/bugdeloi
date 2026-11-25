import { join } from 'node:path'
import { sourceCommit, withSource } from '../c0.1/source.ts'
import type { evaluate } from './evaluate.ts'

type Replay = Awaited<ReturnType<typeof evaluate>>
type Case = Replay['cases'][number]

const handle = 'codex-gpt-6.2-sol'
const submissionCommit = '028d1c4b09debc96e201b9be78699dbda178080c'
const amountFile = 'allocations_familiales/tests/tests_allocations_familiales.catala_fr'
const openingFile = 'allocations_familiales/tests/tests_ouverture_droits.catala_fr'

async function readReplay(suffix: string, fixtureInputs?: Replay['fixtureInputs']) {
  const path = join(import.meta.dir, 'results', `${handle}${suffix}.json`)
  const result = (await Bun.file(path).json()) as Replay
  if (
    result.handle !== handle ||
    result.submissionCommit !== submissionCommit ||
    result.inriaCommit !== sourceCommit ||
    result.witness !== false ||
    result.fixtureInputs !== fixtureInputs ||
    !Array.isArray(result.cases) ||
    !result.cases.length ||
    result.cases.some(
      (test) =>
        !test ||
        typeof test.file !== 'string' ||
        typeof test.name !== 'string' ||
        !['scope', 'cli'].includes(test.kind) ||
        !['passed', 'failed'].includes(test.status),
    ) ||
    result.errors !== 0 ||
    result.total !== result.cases.length ||
    result.passed !== result.cases.filter((test) => test.status === 'passed').length ||
    result.failed !== result.total - result.passed
  ) {
    throw new Error(`Rejeu inattendu ou incomplet dans ${path}.`)
  }
  return result
}

function toCents(amount: string) {
  const match = /^(\d+)(?:,(\d{2}))?$/.exec(amount)
  if (!match) throw new Error(`Montant illisible : ${amount}`)
  return 100 * Number(match[1]) + Number(match[2] ?? 0)
}

async function assertionsFrom(source: string, file: string) {
  const content = await Bun.file(join(source, file)).text()
  const scopes = content.split(/^champ d'application (Test\d+):\s*$/gm)
  const assertions = new Map<string, string[]>()
  for (let i = 1; i < scopes.length; i += 2) {
    const name = scopes[i]
    const body = scopes[i + 1]?.split(/^\x60{3}/m)[0]
    if (!name || !body || assertions.has(name)) throw new Error(`Test illisible dans ${file}.`)
    assertions.set(
      name,
      Array.from(body.matchAll(/^ {2}assertion (.+)$/gm), ([, rule]) => rule ?? ''),
    )
  }
  return assertions
}

const controlLabels = {
  Typecheck: ['Contrôle des types', 'Les types des données sont compatibles.'],
  'Typecheck --check-invariants': [
    'Contrôle des types et de cohérence',
    'Les types et les règles internes du langage sont respectés.',
  ],
} as const

async function summarizeCases(cases: Case[]) {
  const rows = await withSource(async (source) => {
    const amounts = await assertionsFrom(source, amountFile)
    const openings = await assertionsFrom(source, openingFile)
    return cases.map((test) => {
      const base = { id: `${test.file}:${test.name}`, status: test.status, name: test.name }
      if (test.file === amountFile && test.kind === 'scope') {
        const rules = amounts.get(test.name)
        const money = /^f\.i_montant_versé = ([\d,]+)\s*€$/.exec(rules?.[0] ?? '')?.[1]
        if (rules?.length !== 1 || !money) throw new Error(`Montant attendu absent pour ${test.name}.`)
        const expected = toCents(money)
        if (test.status === 'passed') return { ...base, expected, actual: expected, classification: null }
        const [, observed, reference] =
          /^Assertion failed: ([\d,]+)\s*€ ≠ ([\d,]+)\s*€$/.exec(test.diagnostic ?? '') ?? []
        if (!observed || !reference || toCents(reference) !== expected) {
          throw new Error(`Montant obtenu illisible ou attente différente pour ${test.name}.`)
        }
        return { ...base, expected, actual: toCents(observed), classification: test.classification }
      }
      // Les seuls autres cas de cette remise sont des contrôles réussis.
      if (test.status !== 'passed') throw new Error(`Contrôle à documenter : ${base.id}`)
      if (test.file === openingFile && test.kind === 'scope') {
        const rules = openings.get(test.name) ?? []
        if (!rules.length) throw new Error(`Conditions absentes pour ${test.name}.`)
        const expected = rules
          .map((rule, i) => {
            const match = /^\((non \()?f\.droit_ouvert de données\.enfant(\d+)\)\)?$/.exec(rule)
            if (!match || Number(match[2]) !== i + 1) throw new Error(`Condition illisible : ${rule}`)
            return match[1] === undefined
          })
          .map((open, index) => `Enfant ${index + 1} : ${open ? 'droit ouvert' : 'droit fermé'}`)
          .join(' · ')
        return {
          ...base,
          name: `${test.name} · Ouverture du droit`,
          expected,
          actual: expected,
          classification: null,
        }
      }
      const control = controlLabels[test.name as keyof typeof controlLabels]
      if (!control || test.kind !== 'cli') throw new Error(`Cas sans libellé : ${base.id}`)
      return {
        ...base,
        name: control[0],
        expected: control[1],
        actual: 'Contrôle réussi.',
        classification: null,
      }
    })
  })
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error('Cas de test en double.')
  return rows
}

const [raw, original, completed] = await Promise.all([
  readReplay('.raw'),
  readReplay('.original-inputs', 'original'),
  readReplay('', 'completed'),
])
const caseKey = ({ file, kind, name }: Case) => JSON.stringify([file, kind, name])
const originalKeys = new Set(original.cases.map(caseKey))
if (
  original.total !== completed.total ||
  original.total >= raw.total ||
  completed.cases.some((test) => !originalKeys.has(caseKey(test))) ||
  [original, completed].some((run) => run.imageDigest !== raw.imageDigest)
) {
  throw new Error('Les trois rejeux ne sont pas comparables.')
}

const score = ({ passed, total }: Replay) => ({ passed, total })
const summary = {
  inriaCommit: sourceCommit,
  submissionCommit,
  handle,
  scores: { raw: score(raw), original: score(original), completed: score(completed) },
  cases: await summarizeCases(completed.cases),
}
await Bun.write(join(import.meta.dir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
