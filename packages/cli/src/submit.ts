import { basename, join } from 'node:path'
import { checkContribution, contributionTrailers } from './checker.ts'
import { Desk, leasePath, readLease, type Task } from './desk.ts'
import { errorMessage, git } from './protocol.ts'

export interface Submission {
  task: string
  role: string
  family: string
  model: string
  dryRun?: boolean
  sandbox?: boolean
  cwd?: string
}

export function submissionMessage({ task, role, family, model }: Submission) {
  if ([task, role, family, model].some((value) => /[\p{Cc}]/u.test(value))) {
    throw new Error('Les valeurs des trailers doivent tenir sur une ligne.')
  }
  const title = `Contribuer à la tâche ${task}`
  const message = `${title}\n\nBugDeLoi-Task: ${task}\nBugDeLoi-Role: ${role}\nBugDeLoi-Family: ${family}\nBugDeLoi-Model: ${model}`
  const { diagnostics } = contributionTrailers(message)
  if (diagnostics.length) throw new Error(diagnostics.join('\n'))
  return { title, message, branch: `bdl/${task}` }
}

function names(stdout: string) {
  return stdout.split('\0').filter(Boolean)
}

export function workingChanges(root: string) {
  const staged = names(git(root, 'diff', '--cached', '--no-renames', '--name-only', '-z', '--'))
  const working = names(git(root, 'diff', '--no-renames', '--name-only', '-z', '--'))
  const untracked = names(git(root, 'ls-files', '--others', '--exclude-standard', '-z'))
  return [...new Set([...staged, ...working, ...untracked])].sort()
}

export function taskCheckOptions(task: Task, root: string) {
  const monorepo = Bun.file(join(root, 'corpus', 'clerk.toml')).size > 0
  const patterns = (paths: string[]) =>
    paths.map((path) => (monorepo && !path.startsWith('corpus/') ? `corpus/${path}` : path))
  return {
    allowedPaths: patterns(task.allowed_paths),
    blindTo: patterns(task.blind_to),
    manifest: Object.fromEntries(task.legal_units.map((unit) => [unit.legiarti, unit.text_sha256])),
  }
}

export async function submit(options: Submission) {
  const { title, message, branch } = submissionMessage(options)
  const cwd = options.cwd ?? process.cwd()
  const root = git(cwd, 'rev-parse', '--show-toplevel').trim()
  const path = leasePath(root)
  const lease = await readLease(path)
  if (
    !lease ||
    lease.task.id !== options.task ||
    lease.task.role !== options.role ||
    lease.family !== options.family
  ) {
    throw new Error('Le bail local doit correspondre à la tâche, au rôle et à la famille déclarés.')
  }
  if (Date.parse(lease.expires_at) <= Date.now())
    throw new Error('Échéance du bail dépassée. Lancez bdl beat.')
  const changedPaths = workingChanges(root)
  const verdict = await checkContribution({
    cwd: root,
    changedPaths,
    message,
    sandbox: options.sandbox,
    ...taskCheckOptions(lease.task, root),
  })
  console.log(JSON.stringify(verdict, null, 2))
  if (verdict.verdict !== 'ACCEPTED') return verdict.verdict === 'REJECTED' ? 1 : 2
  if (options.dryRun) {
    console.log(
      JSON.stringify({ dry_run: true, branch, files: changedPaths, commit_message: message }, null, 2),
    )
    return 0
  }

  if (!Bun.which('gh')) throw new Error('Commande requise introuvable : gh.')
  const remoteBase = git(root, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD').trim()
  if (git(root, 'rev-parse', remoteBase).trim() !== git(root, 'rev-parse', 'HEAD').trim()) {
    throw new Error(`La contribution doit partir de ${remoteBase} pour contenir un seul commit.`)
  }
  git(root, 'switch', '-c', branch)
  git(root, '--literal-pathspecs', 'add', '--', ...changedPaths)
  git(root, 'commit', '-m', message)
  git(root, 'push', '--set-upstream', 'origin', branch)
  const pr = Bun.spawn(
    ['gh', 'pr', 'create', '--base', basename(remoteBase), '--title', title, '--body', message],
    {
      cwd: root,
      stdin: 'ignore',
      stdout: 'inherit',
      stderr: 'inherit',
    },
  )
  if ((await pr.exited) !== 0)
    throw new Error(`Création de la PR échouée. La branche ${branch} est disponible sur origin.`)
  try {
    await new Desk(path).release('submitted')
  } catch (error) {
    throw new Error(`PR créée. Libération du bail à reprendre : ${errorMessage(error)}`)
  }
  return 0
}
