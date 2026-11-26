import { lstat, readdir, readFile, realpath } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { GIT_SHA_RE, LEGIARTI_RE, legalTextHash } from '@bugdeloi/core'
import { runInSandbox } from '@bugdeloi/runner'
import {
  digestPattern,
  errorMessage,
  families,
  git,
  isOneOf,
  nonEmpty,
  record,
  roles,
  strings,
  taskIdPattern,
} from './protocol.ts'

const maxBytes = 512 * 1024
type Manifest = Record<string, string>
type SandboxStatus = 'PASSED' | 'FAILED' | 'FAULT' | 'SKIPPED_NO_SANDBOX' | 'NOT_APPLICABLE' | 'NOT_RUN'

export interface CheckOptions {
  cwd?: string
  path?: string
  changedPaths?: string[]
  allowedPaths?: string[]
  blindTo?: string[]
  dependencies?: string[]
  manifest?: Manifest
  commit?: string
  message?: string
  sandbox?: boolean
  prDiff?: boolean
}

interface Verdict {
  verdict: 'ACCEPTED' | 'REJECTED' | 'FAULT'
  diagnostics: string[]
  warnings: string[]
  sandbox: SandboxStatus
}

export function parseManifest(value: unknown): Manifest {
  if (
    !record(value) ||
    Object.entries(value).some(
      ([id, hash]) => !LEGIARTI_RE.test(id) || typeof hash !== 'string' || !digestPattern.test(hash),
    )
  )
    throw new Error('Manifeste LEGI invalide (objet LEGIARTI → SHA-256 attendu).')
  return value as Manifest
}

function relativePath(path: string) {
  return (
    !/[\\\p{Cc}]/u.test(path) && path.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
  )
}

function matchesPath(path: string, pattern: string) {
  const prefix = pattern.endsWith('/') ? pattern.slice(0, -1) : pattern
  if (!relativePath(prefix)) return false
  if (pattern.endsWith('/')) return path.startsWith(`${prefix}/`)
  return new Bun.Glob(pattern).match(path)
}

export function validateAllowedPaths(
  paths: readonly string[],
  allowed: readonly string[],
  blind: readonly string[] = [],
) {
  return paths.flatMap((path) => {
    if (!relativePath(path) || blind.some((pattern) => matchesPath(path, pattern))) {
      return [`Chemin interdit : ${JSON.stringify(path)}.`]
    }
    return allowed.some((pattern) => matchesPath(path, pattern))
      ? []
      : [`Chemin hors tâche : ${JSON.stringify(path)}.`]
  })
}

const trailerNames = ['Task', 'Role', 'Family', 'Model'] as const

export function contributionTrailers(message: string) {
  // Git is the authority on where the final trailer block begins.
  const result = Bun.spawnSync(['git', 'interpret-trailers', '--parse'], { stdin: Buffer.from(message) })
  if (!result.success) throw new Error('Impossible de lire les trailers Git.')
  const lines = result.stdout.toString().split('\n')
  const values = trailerNames.map((name) => {
    const prefix = `BugDeLoi-${name}:`
    const matches = lines.filter((line) => line.toLowerCase().startsWith(prefix.toLowerCase()))
    const line = matches.length === 1 ? matches[0] : undefined
    return line?.slice(prefix.length).trim() ?? ''
  })
  const [task = '', role = '', family = '', model = ''] = values
  const diagnostics = [
    taskIdPattern.test(task) ? null : 'Trailer BugDeLoi-Task absent, en double ou invalide.',
    isOneOf(roles, role) ? null : 'Trailer BugDeLoi-Role absent, en double ou invalide.',
    isOneOf(families, family) ? null : 'Trailer BugDeLoi-Family absent, en double ou invalide.',
    model && model.length <= 160 && !/[\p{Cc}]/u.test(model)
      ? null
      : 'Trailer BugDeLoi-Model absent, en double ou invalide.',
  ].filter((item) => item !== null)
  return { task, role, family, model, diagnostics }
}

const oracleKinds = [
  'bofip_example',
  'brochure_officielle',
  'inria_test',
  'dgfip_m',
  'openfisca_test',
  'derivation_manuelle',
] as const

function legalUnit(value: string) {
  const [id = '', version, ...rest] = value.split('@')
  if (!LEGIARTI_RE.test(id) || rest.length) return false
  if (version === undefined) return true
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(version) &&
    Number.isFinite(Date.parse(version)) &&
    new Date(version).toISOString().startsWith(version)
  )
}

function validateOracleEntry(value: unknown, prefix = ''): string[] {
  if (!record(value)) return [`${prefix}Un cas d’oracle YAML doit être un objet.`]

  const { source, author, blind_to: blindTo, inputs, expected, derivation } = value
  const diagnostics: string[] = []
  if (!nonEmpty(value.id)) diagnostics.push(`${prefix}id obligatoire.`)
  if (!nonEmpty(value.interface) || !/^[\p{L}_][\p{L}\p{N}_]*@v[1-9]\d*$/u.test(value.interface)) {
    diagnostics.push(`${prefix}interface invalide (Nom@vN attendu).`)
  }
  if (!record(source) || !isOneOf(oracleKinds, source.kind))
    diagnostics.push(`${prefix}source.kind invalide.`)
  if (
    !record(source) ||
    !strings(source.legal_units) ||
    !source.legal_units.length ||
    !source.legal_units.every(legalUnit)
  )
    diagnostics.push(`${prefix}source.legal_units invalide.`)
  if (!record(author) || !isOneOf(families, author.family))
    diagnostics.push(`${prefix}author.family invalide.`)
  if (!strings(blindTo) || !blindTo.every(relativePath))
    diagnostics.push(`${prefix}blind_to doit lister des chemins relatifs.`)
  if (!record(inputs)) diagnostics.push(`${prefix}inputs doit être un objet.`)
  if (!record(expected) || !Object.keys(expected).length)
    diagnostics.push(`${prefix}expected doit fournir au moins une sortie.`)
  if (record(source) && source.kind === 'derivation_manuelle' && !nonEmpty(derivation)) {
    diagnostics.push(`${prefix}derivation obligatoire pour derivation_manuelle.`)
  }
  return diagnostics
}

export function validateOracle(yaml: string) {
  let value: unknown
  try {
    value = Bun.YAML.parse(yaml)
  } catch {
    return ['YAML d’oracle invalide.']
  }
  if (Array.isArray(value)) {
    if (!value.length) return ['La liste des cas d’oracle YAML est vide.']
    return value.flatMap((entry, index) => validateOracleEntry(entry, `Cas ${index + 1} : `))
  }
  return validateOracleEntry(value)
}

const articleHeading = /^####[ \t]+Article[ \t]+[^|]+\|[ \t]*(LEGIARTI\d{12})[ \t]*$/iu
const catalaFences = new Set(['catala', 'catala-metadata'])
const numericLiteral = /(?<![\p{L}\p{N}_'])\d+(?![\p{L}\p{N}_'])/u
const citationComment = /^\s*#.*(?:\bLEGIARTI\d{12}\b|\b(?:source\s*:|article\s+\S+|alinéa\s+\S+))/iu
const embeddedSecret =
  /(?:-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16})\b)/
const external = /(?:^|[^\p{L}\p{N}_])(?:externe|external|ffi)(?![\p{L}\p{N}_])/iu
const scope = /^\s*(?:déclaration\s+)?(?:champ d'application|scope)\s+/u

export function checkCatala(
  source: string,
  {
    manifest,
    dependencies = [],
    requiresArticle = true,
  }: { manifest?: Manifest; dependencies?: string[]; requiresArticle?: boolean } = {},
) {
  const diagnostics: string[] = []
  const warnings: string[] = []
  let article: { id: string; prose: string[] } | undefined
  let count = 0
  let fence: { marker: string; kind: string } | undefined
  let blocks = 0
  let testing = false
  let testScope = false
  let assertion = false
  let tests = 0
  const lines = source.split(/\r?\n/u)

  function finishArticle() {
    if (!article) return
    const prose = article.prose.join('\n').trim()
    if (!prose) diagnostics.push(`${article.id} : texte de l’article absent.`)
    else if (manifest && manifest[article.id] !== legalTextHash(prose)) {
      diagnostics.push(
        manifest[article.id]
          ? `${article.id} : empreinte LEGI différente.`
          : `${article.id} : empreinte absente du manifeste.`,
      )
    }
    article = undefined
  }

  function finishTest() {
    if (testing && (!testScope || !assertion)) diagnostics.push('Scope #[test] sans assertion.')
    testing = false
    testScope = false
    assertion = false
  }

  for (const [index, line] of lines.entries()) {
    const at = `Ligne ${index + 1}`
    if (fence) {
      if (line.trim() === fence.marker) {
        finishTest()
        fence = undefined
        continue
      }
      if (!catalaFences.has(fence.kind)) continue
      const code = line.replace(/#.*$/u, '').trim()
      if (/^\s*#\[test\]/u.test(line)) {
        finishTest()
        testing = true
        tests++
      }
      if (scope.test(code) && testing) {
        if (/^\s*déclaration\s+/u.test(code)) {
          if (testScope) finishTest()
          else testScope = true
        } else if (!testScope) {
          testScope = true
        }
      }
      if (testing && testScope && /^(?:assertion|assert)\b/u.test(code)) assertion = true
      if (external.test(code)) diagnostics.push(`${at} : déclaration externe interdite.`)
      if (
        numericLiteral.test(code) &&
        !lines.slice(Math.max(0, index - 3), index).some((preceding) => citationComment.test(preceding))
      )
        diagnostics.push(`${at} : constante numérique sans citation dans les trois lignes précédentes.`)
      continue
    }

    const heading = articleHeading.exec(line)
    if (/^#{1,6}[ \t]/u.test(line)) finishArticle()
    if (heading?.[1]) {
      count++
      const id = heading[1]
      if (!LEGIARTI_RE.test(id)) diagnostics.push(`${at} : identifiant LEGIARTI invalide.`)
      article = { id, prose: [] }
      continue
    }
    if (/^#{1,6}[ \t]+Article\b/iu.test(line))
      diagnostics.push(`${at} : titre d’article sans identifiant LEGIARTI valide.`)
    const opening = /^\s*(`{3,}|~{3,})\s*([^\s`~]*)\s*$/u.exec(line)
    if (opening?.[1]) {
      const kind = opening[2] ?? ''
      if (kind.startsWith('catala')) finishArticle()
      if (catalaFences.has(kind)) blocks++
      if (kind.startsWith('catala') && !catalaFences.has(kind)) {
        diagnostics.push(`${at} : bloc ${kind} hors liste blanche.`)
      }
      fence = { marker: opening[1], kind }
      continue
    }

    const directive = /^\s*>\s*(?:Inclusion\s*:|Usage\s+de)\s*(.+?)\s*$/iu.exec(line)
    if (directive?.[1] && !dependencies.includes(directive[1])) {
      diagnostics.push(`${at} : dépendance Catala non déclarée.`)
    }
    if (/^\s*>\s*Module\b/iu.test(line) && external.test(line)) {
      diagnostics.push(`${at} : module externe interdit.`)
    }
    if (article) {
      if (
        /(?:https?:\/\/|\[[^\]]+\]\s*\(|ign(?:ore|orer)\s+(?:les\s+)?instructions|\b(?:assistant|agent)\s*:)/iu.test(
          line,
        )
      ) {
        diagnostics.push(`${at} : lien ou instruction dans le texte formalisé.`)
      }
      article.prose.push(line)
    }
  }

  finishArticle()
  finishTest()
  if (fence) diagnostics.push('Bloc Markdown non fermé.')
  if (embeddedSecret.test(source)) diagnostics.push('Motif de secret détecté dans le fichier Catala.')
  if (requiresArticle && !count) diagnostics.push('Aucun titre « #### Article …|LEGIARTI… ».')
  if (!blocks) diagnostics.push('Aucun bloc de code Catala.')
  if (!tests && /(?:^|\n)\s*#\[test\]/u.test(source)) diagnostics.push('Annotation #[test] hors bloc Catala.')
  if (count && !manifest)
    warnings.push('Empreintes LEGI non comparées : aucun manifeste de confiance disponible.')
  return { diagnostics, warnings }
}

async function readText(path: string) {
  const file = await lstat(path)
  if (!file.isFile()) throw new Error('Fichier ordinaire attendu.')
  if (file.size > maxBytes) throw new Error('Fichier au-delà de 512 Kio.')
  const data = await readFile(path)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data)
  } catch {
    throw new Error('Encodage UTF-8 invalide.')
  }
}

function inside(root: string, target: string) {
  const child = relative(root, target)
  return child === '' || (child !== '..' && !child.startsWith(`..${sep}`))
}

async function discover(path: string, root: string, blindTo: string[] = []): Promise<string[]> {
  if (blindTo.some((pattern) => matchesPath(relative(root, path), pattern))) return []
  const info = await lstat(path)
  if (info.isSymbolicLink()) throw new Error(`Lien symbolique interdit : ${relative(root, path)}.`)
  if (!info.isDirectory()) return [path]
  const entries = (await readdir(path)).sort()
  const result: string[] = []
  for (const entry of entries) {
    if (!entry.startsWith('.') && !['node_modules', 'build', '_target', 'dist'].includes(entry)) {
      result.push(...(await discover(join(path, entry), root, blindTo)))
    }
  }
  return result
}

export function assertSafeContributionPath(root: string, path: string) {
  if (!relativePath(path) || !inside(root, resolve(root, path)))
    throw new Error('Chemin de contribution invalide.')
}

export function repositoryPolicies(raw: string | undefined, task: string, role: string) {
  if (!raw) throw new Error('Configurez BDL_TASK_POLICIES côté dépôt pour le contrôle des chemins par tâche.')
  const data: unknown = JSON.parse(raw)
  const policy = record(data) && Object.hasOwn(data, task) ? data[task] : undefined
  if (
    !record(policy) ||
    policy.role !== role ||
    !strings(policy.allowed_paths) ||
    !policy.allowed_paths.length ||
    (policy.blind_to !== undefined && !strings(policy.blind_to)) ||
    (policy.dependencies !== undefined && !strings(policy.dependencies))
  ) {
    throw new Error('Politique de cette tâche absente ou invalide.')
  }
  return {
    allowedPaths: policy.allowed_paths,
    blindTo: policy.blind_to,
    dependencies: policy.dependencies,
    manifest: policy.legi !== undefined ? parseManifest(policy.legi) : undefined,
  }
}

async function pullRequestRange(cwd: string) {
  const eventPath = process.env.GITHUB_EVENT_PATH
  const value: unknown = eventPath ? await Bun.file(eventPath).json() : null
  const pull = record(value) ? value.pull_request : undefined
  const base = record(pull) && record(pull.base) ? pull.base.sha : undefined
  const head = record(pull) && record(pull.head) ? pull.head.sha : undefined
  if (
    typeof base !== 'string' ||
    !GIT_SHA_RE.test(base) ||
    typeof head !== 'string' ||
    !GIT_SHA_RE.test(head)
  )
    throw new Error('Révisions de la PR indisponibles.')
  if (git(cwd, 'rev-parse', 'HEAD').trim() !== head) throw new Error('HEAD doit être la révision de la PR.')
  const range = `${base}...${head}`
  return {
    head,
    paths: git(cwd, 'diff', '--no-renames', '--name-only', '-z', range, '--').split('\0').filter(Boolean),
    count: Number(git(cwd, 'rev-list', '--count', `${base}..${head}`).trim()),
  }
}

export async function checkContribution(options: CheckOptions): Promise<Verdict> {
  const result: Verdict = { verdict: 'ACCEPTED', diagnostics: [], warnings: [], sandbox: 'NOT_RUN' }
  const reject = () => ({ ...result, verdict: 'REJECTED' as const })
  let { allowedPaths, changedPaths, blindTo, dependencies, manifest } = options
  const root = resolve(options.cwd ?? process.cwd())
  try {
    const pr = options.prDiff ? await pullRequestRange(root) : undefined
    const ref = pr?.head ?? options.commit
    if (pr && pr.count !== 1) result.diagnostics.push('Une contribution doit contenir exactement un commit.')
    const message = ref
      ? git(root, 'show', '--no-patch', '--format=%B', '--end-of-options', ref, '--')
      : options.message
    if (message !== undefined) {
      const trailers = contributionTrailers(message)
      result.diagnostics.push(...trailers.diagnostics)
      if (pr && !result.diagnostics.length) {
        const policy = repositoryPolicies(process.env.BDL_TASK_POLICIES, trailers.task, trailers.role)
        ;({ allowedPaths, blindTo, dependencies, manifest } = policy)
        changedPaths = pr.paths
      }
    }
    if (result.diagnostics.length) return reject()

    if (changedPaths) {
      if (!changedPaths.length) result.diagnostics.push('Aucun fichier modifié.')
      if (!allowedPaths) throw new Error('Chemins autorisés de la tâche manquants.')
      result.diagnostics.push(...validateAllowedPaths(changedPaths, allowedPaths, blindTo))
      if (result.diagnostics.length) return reject()
    }

    const target = resolve(root, options.path ?? '.')
    if (!inside(root, target) || !inside(await realpath(root), await realpath(target))) {
      throw new Error('Le chemin à contrôler doit rester dans le répertoire de travail.')
    }
    if ((await realpath(target)) !== resolve(await realpath(root), relative(root, target))) {
      result.diagnostics.push('Lien symbolique interdit sur le chemin à contrôler.')
      return reject()
    }
    const paths = changedPaths?.map((path) => resolve(root, path)) ?? (await discover(target, root, blindTo))
    const catala: string[] = []
    for (const path of paths) {
      const name = relative(root, path)
      const kind = path.endsWith('.catala_fr')
        ? 'catala'
        : /(?:^|\/)oracles\/.*\.ya?ml$/u.test(name)
          ? 'oracle'
          : null
      try {
        const resolved = await realpath(path)
        if (resolved !== resolve(await realpath(root), name)) throw new Error('Lien symbolique interdit.')
        const source = await readText(path)
        if (kind === 'catala') {
          catala.push(path)
          if (/(?:^|\/)tests?\//u.test(name) || /(?:^|[_-])tests?\.catala_fr$/u.test(basename(name))) {
            if (!/^\s*#\[test\]/mu.test(source))
              result.diagnostics.push(`${name} : fichier de tests sans scope #[test].`)
          }
          const requiresArticle = !/(?:^|\/)(?:interfaces|oracles|tests?)\//u.test(name)
          const check = checkCatala(source, { manifest, dependencies, requiresArticle })
          result.diagnostics.push(...check.diagnostics.map((item) => `${name} : ${item}`))
          result.warnings.push(...check.warnings.map((item) => `${name} : ${item}`))
        }
        if (kind === 'oracle')
          result.diagnostics.push(...validateOracle(source).map((item) => `${name} : ${item}`))
      } catch (error) {
        result.diagnostics.push(`${JSON.stringify(name)} : ${errorMessage(error)}`)
      }
    }
    if (result.diagnostics.length) return reject()
    if (options.sandbox === false) {
      result.sandbox = 'SKIPPED_NO_SANDBOX'
      result.warnings.push('SKIPPED_NO_SANDBOX : contrôle Catala désactivé explicitement.')
    } else if (!catala.length) {
      result.sandbox = 'NOT_APPLICABLE'
    } else {
      result.sandbox = 'FAULT'
      if (!Bun.which('podman'))
        throw new Error('Podman indisponible. Utilisez --no-sandbox pour un contrôle statique.')
      const corpus = join(root, 'corpus')
      const workdir = catala.every((path) => inside(corpus, path))
        ? corpus
        : (await lstat(target)).isDirectory()
          ? target
          : dirname(target)
      if (catala.some((path) => !inside(workdir, path)))
        throw new Error('Fichiers Catala hors du projet Clerk.')
      for (const path of catala) {
        const file = `./${relative(workdir, path)}`
        for (const command of [
          ['clerk', 'typecheck', '--color=never', '--build-dir=/build', file],
          [
            'clerk',
            'test',
            '--color=never',
            '--backend=interpret',
            '--makeflags=-j2',
            '--build-dir=/build',
            '--target-dir=/build/targets',
            file,
          ],
        ]) {
          const run = await runInSandbox({
            workdir,
            command,
            timeoutMs: 120_000,
            memoryMb: 1024,
            cpus: 2,
            network: false,
          })
          if (run.timedOut || run.exitCode >= 125) throw new Error(`Échec d’exécution de Clerk pour ${file}.`)
          if (run.exitCode !== 0) {
            result.sandbox = 'FAILED'
            result.diagnostics.push(
              `${file} : échec de clerk ${command[1]}. ${(run.stderr || run.stdout).trim().slice(0, 4000)}`,
            )
            return reject()
          }
        }
      }
      result.sandbox = 'PASSED'
    }
    return result
  } catch (error) {
    return { ...result, verdict: 'FAULT', diagnostics: [...result.diagnostics, errorMessage(error)] }
  }
}
