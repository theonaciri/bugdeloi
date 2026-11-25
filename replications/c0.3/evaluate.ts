import { cp, mkdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { readImageLock, runInSandbox } from '../../packages/runner/src/index.ts'
import { firstDiagnostic, parseClerkReport } from '../c0.1/report.ts'
import { sourceCommit, withSource } from '../c0.1/source.ts'
import { buildAdapter, referenceEntry, sourceFolder, witness } from './adapter.ts'
import { baremes } from './baremes.ts'
import {
  checkHandle,
  compile,
  entry,
  limits,
  stageSubmission,
  submissionFiles,
  withWorkspace,
} from './check.ts'
import { type FailureClassification, type FixtureInputs, reviewFailure } from './review.ts'

const testsFolder = `${sourceFolder}/tests`
const amountTests = `${testsFolder}/tests_allocations_familiales.catala_fr`
const dependencies = [
  'prologue_france',
  'smic',
  'prestations_familiales',
  'base_mensuelle_allocations_familiales',
]

type Case = {
  file: string
  kind: 'scope' | 'cli'
  name: string
  occurrence: number
  status: 'passed' | 'failed' | 'error'
  diagnostic: string | null
  classification: FailureClassification | null
  justification: string | null
}

type ExpectedCase = Pick<Case, 'file' | 'kind' | 'name' | 'occurrence'>

function countedCases<T extends ExpectedCase>(cases: T[]): T[] {
  const scopes = new Set(
    cases.filter((test) => test.kind === 'scope').map((test) => `${test.file}:${test.name}`),
  )
  return cases.filter((test) => {
    if (test.kind === 'scope') return true
    const scope = /^test-scope (\S+) /.exec(test.name)?.[1]
    return !scope || !scopes.has(`${test.file}:${scope}`)
  })
}

async function expectedCases(directory: string) {
  const files = [
    `${sourceFolder}/${referenceEntry}`,
    ...Array.from(new Bun.Glob('*.catala_fr').scanSync(join(directory, testsFolder)))
      .sort()
      .map((file) => `${testsFolder}/${file}`),
  ]
  const result: ExpectedCase[] = []
  for (const file of files) {
    const content = await Bun.file(join(directory, file)).text()
    const cases = [
      ...Array.from(
        content.matchAll(/^#\[test\]\s*\ndéclaration champ d'application ([^:]+):/gm),
        (match) => ['scope', match[1]] as const,
      ),
      ...Array.from(
        content.matchAll(/^```catala-test-cli\n\$ catala (.+)$/gm),
        (match) => ['cli', match[1]] as const,
      ),
    ]
    for (const [kind, name] of cases) {
      if (!name) throw new Error('Test Inria sans nom.')
      const occurrence =
        result.filter((test) => test.file === file && test.kind === kind && test.name === name).length + 1
      result.push({ file, kind, name, occurrence })
    }
  }
  if (!result.length) throw new Error('Suite Inria vide.')
  return result
}

async function stageSuite(source: string, dir: string, useWitness: boolean, inputs: FixtureInputs) {
  const includeDirs = [sourceFolder, 'soumission', 'baremes']
  const modules = useWitness ? dependencies : dependencies.slice(0, -1)
  for (const dependency of modules) {
    await cp(join(source, dependency), join(dir, dependency), { recursive: true })
    includeDirs.push(dependency)
  }
  await cp(join(source, testsFolder), join(dir, testsFolder), { recursive: true })
  if (inputs === 'completed') {
    const path = join(dir, amountTests)
    const original = await Bun.file(path).text()
    const parent = /^ {2}règle f\.i_personne_charge_effective_permanente_est_parent rempli$/gm
    const conditions = 'i_personne_charge_effective_permanente_remplit_titre_I'
    // Les cas de montant du commit Inria épinglé supposent les conditions générales remplies.
    if (original.includes(conditions) || Array.from(original.matchAll(parent)).length !== 14) {
      throw new Error('Les entrées des cas de montant Inria ont changé.')
    }
    await Bun.write(path, original.replace(parent, `$&\n  règle f.${conditions} rempli`))
  }
  await cp(join(source, 'LICENSE.txt'), join(dir, 'LICENSE-Inria.txt'))
  await Bun.write(join(dir, sourceFolder, referenceEntry), await buildAdapter(source))
  await mkdir(join(dir, 'baremes'), { mode: 0o755 })
  await Bun.write(join(dir, 'baremes/Baremes.catala_fr'), baremes())
  if (useWitness) {
    const reference = join(dir, 'reference')
    await cp(join(source, sourceFolder), reference, {
      recursive: true,
      filter: (path) => path !== join(source, testsFolder),
    })
    const module = (await Bun.file(join(reference, referenceEntry)).text()).split('```catala-test-cli')[0]
    if (!module) throw new Error('Module Inria absent.')
    await Bun.write(
      join(reference, 'Reference.catala_fr'),
      module.replace('> Module Allocations_familiales', '> Module Reference'),
    )
    await Bun.file(join(reference, referenceEntry)).delete()
    includeDirs.push('reference')
    await Bun.write(join(dir, 'soumission', entry), witness())
  }
  await Bun.write(
    join(dir, 'clerk.toml'),
    `[project]\nname = "bugdeloi-c03"\ninclude_dirs = ${JSON.stringify(includeDirs)}\n`,
  )
}

function errors(expected: ExpectedCase[], diagnostic: string): Case[] {
  return expected.map((test) => ({
    ...test,
    status: 'error',
    diagnostic,
    classification: null,
    justification: null,
  }))
}

function inlineName(command: string) {
  const tokens = command.split(' ')
  const action = tokens[1]
  if (action === 'typecheck')
    return tokens.includes('--check-invariants') ? 'Typecheck --check-invariants' : 'Typecheck'
  const scope = tokens.find((token) => token.startsWith('--scope='))?.slice('--scope='.length)
  if ((action === 'test-scope' || action === 'interpret') && scope && tokens.includes('--disable-warnings')) {
    return `test-scope ${scope} --disable-warnings`
  }
  throw new Error(`Commande de test Clerk inconnue (${command}).`)
}

function readCases(stdout: string, expected: ExpectedCase[]): Case[] {
  // Le parseur partagé valide les objets, les statuts, les noms et les messages d'erreur de Clerk.
  parseClerkReport(stdout)
  type ClerkCase = { scope_name?: string; cmd?: string; success: boolean; errors?: { message: string }[] }
  const report = JSON.parse(stdout.trimEnd().split('\n').at(-1) ?? '') as {
    'test-results': { file: string; tests: { scopes: ClerkCase[]; 'inline-tests': ClerkCase[] } }[]
  }
  const remaining = [...expected]
  const cases: Case[] = []
  for (const { file, tests } of report['test-results']) {
    for (const test of [...tests.scopes, ...tests['inline-tests']]) {
      const name = test.scope_name ?? inlineName(test.cmd ?? '')
      const index = remaining.findIndex(
        (item) =>
          item.file === file.slice('/work/'.length) &&
          item.name === name &&
          item.kind === (test.scope_name ? 'scope' : 'cli'),
      )
      const item = index < 0 ? undefined : remaining.splice(index, 1)[0]
      if (!item) throw new Error(`Test Clerk inattendu (${file}, ${test.scope_name ?? test.cmd}).`)
      const diagnostic = test.errors?.map(({ message }) => message).join('\n') || null
      const executionError = item.kind === 'scope' && !diagnostic?.startsWith('Assertion failed')
      const status = test.success ? 'passed' : executionError ? 'error' : 'failed'
      cases.push({ ...item, status, diagnostic, classification: null, justification: null })
    }
  }
  if (remaining.length) throw new Error(`${remaining.length} tests Inria absents du rapport Clerk.`)
  return cases.map((test) => {
    if (test.status !== 'failed' || test.kind !== 'cli' || test.diagnostic) return test
    const scopeName = /^test-scope (\S+) /.exec(test.name)?.[1]
    const scope = cases.find(
      (item) => item.kind === 'scope' && item.file === test.file && item.name === scopeName,
    )
    return {
      ...test,
      status: scope?.status === 'error' ? 'error' : 'failed',
      diagnostic: scope?.diagnostic ?? 'Sortie différente de la référence CLI.',
    }
  })
}

interface Submission {
  handle: string
  commit: string
  load?: () => Promise<ReadonlyMap<string, string>>
}

export async function evaluate(submission: Submission, inputs: FixtureInputs = 'completed') {
  const image = await readImageLock()
  const cases = await withSource(async (source) => {
    const expected = await expectedCases(source)
    const counted = countedCases(expected)
    return withWorkspace(async (dir) => {
      try {
        const files = submission.load ? await submission.load() : new Map()
        await stageSubmission(dir, files)
        if (!submission.load) await stageSuite(source, dir, true, inputs)
        const build = submission.load
          ? await compile(dir)
          : await runInSandbox({
              workdir: dir,
              command: ['clerk', 'typecheck', '--color=never', '--build-dir=/build', `soumission/${entry}`],
              ...limits,
            })
        if (build.exitCode !== 0 || build.timedOut) {
          return errors(
            counted,
            `Compilation : ${firstDiagnostic(build.stdout + build.stderr) ?? (build.stdout + build.stderr).trim()}`,
          )
        }
        if (submission.load) await stageSuite(source, dir, false, inputs)
        const replay = await runInSandbox({
          workdir: dir,
          command: [
            'clerk',
            'test',
            '--json',
            '--color=never',
            '--backend=interpret',
            '--makeflags=-j2',
            '--build-dir=/build',
            '--target-dir=/build/targets',
            sourceFolder,
          ],
          ...limits,
        })
        if (replay.timedOut) return errors(counted, 'Délai de rejeu dépassé.')
        try {
          const cases = readCases(replay.stdout, expected)
          if (replay.exitCode !== Number(cases.some((test) => test.status !== 'passed'))) {
            throw new Error(`Sortie Clerk inattendue (${replay.exitCode}).`)
          }
          const calculation = files.get(entry)
          const reviewed =
            files.size === 1 &&
            calculation &&
            new Bun.CryptoHasher('sha256').update(calculation).digest('hex') ===
              '752cf3fd027b7fbc26b7e4edc43c46a244a95bf8548bc6fc425cf3ea2f7021c6'
          return countedCases(cases).map((test) =>
            reviewed && test.file === amountTests && test.kind === 'scope' && test.status === 'failed'
              ? { ...test, ...reviewFailure(inputs, test.name, test.diagnostic) }
              : test,
          )
        } catch (error) {
          return errors(counted, firstDiagnostic(`${replay.stdout}\n${replay.stderr}`) ?? String(error))
        }
      } catch (error) {
        return errors(counted, String(error))
      }
    })
  })
  const passed = cases.filter((item) => item.status === 'passed').length
  const failed = cases.filter((item) => item.status === 'failed').length
  return {
    handle: submission.handle,
    witness: !submission.load,
    fixtureInputs: inputs,
    inriaCommit: sourceCommit,
    submissionCommit: submission.commit,
    catalaVersion: image.catala,
    imageDigest: image.digest,
    total: cases.length,
    passed,
    failed,
    errors: cases.length - passed - failed,
    score: passed / cases.length,
    cases,
  }
}

export async function committedSubmission(handle: string, revision: string) {
  const base = `replications/c0.3/submission/${handle}`
  const cwd = join(import.meta.dir, '../..')
  const commit = Bun.spawnSync(['git', 'rev-parse', '--verify', '--end-of-options', `${revision}^{commit}`], {
    cwd,
  })
  if (commit.exitCode !== 0) throw new Error('Révision de soumission introuvable.')
  const sha = commit.stdout.toString().trim()
  const archive = Bun.spawnSync(['git', 'archive', sha, '--', base], { cwd })
  return {
    handle,
    commit: sha,
    load: () =>
      withWorkspace(async (dir) => {
        if (archive.exitCode !== 0) throw new Error('Soumission absente du commit.')
        const tar = Bun.spawnSync(['tar', '-x', '-C', dir], { stdin: archive.stdout })
        if (tar.exitCode !== 0) throw new Error('Extraction de la soumission impossible.')
        return submissionFiles(join(dir, base))
      }),
  }
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2)
    const inputs = args[0] === '--original-inputs' ? 'original' : 'completed'
    if (inputs === 'original') args.shift()
    const [rawHandle, revision = 'HEAD', ...extra] = args
    if (!rawHandle || extra.length)
      throw new Error('Usage : bun replications/c0.3/evaluate.ts [--original-inputs] <pseudo> [commit]')
    const handle = checkHandle(rawHandle)
    const result = await evaluate(await committedSubmission(handle, revision), inputs)
    const output = join(import.meta.dir, 'results')
    await mkdir(output, { recursive: true })
    const temporary = join(output, `.${handle}-${crypto.randomUUID()}.tmp`)
    await Bun.write(temporary, `${JSON.stringify(result, null, 2)}\n`)
    const suffix = inputs === 'original' ? '.original-inputs' : ''
    await rename(temporary, join(output, `${handle}${suffix}.json`))
    console.log(
      `${result.passed}/${result.total} tests réussis, ${result.failed} échecs, ${result.errors} erreurs.`,
    )
    process.exitCode = result.passed === result.total ? 0 : 1
  } catch (error) {
    console.error(String(error))
    process.exitCode = 1
  }
}
