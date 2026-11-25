import { lstat, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInSandbox } from '../../packages/runner/src/index.ts'

export const entry = 'Calcul.catala_fr'
export const task = join(import.meta.dir, 'task')
export const limits = { timeoutMs: 60_000, cpus: 2, memoryMb: 1536, network: false } as const

export function checkHandle(handle: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}$/.test(handle)) throw new Error('Pseudo invalide.')
  return handle
}

export async function withWorkspace<T>(use: (dir: string) => Promise<T>) {
  const root = await mkdtemp(join(tmpdir(), 'bugdeloi-c03-'))
  try {
    const dir = join(root, 'work')
    await mkdir(dir, { mode: 0o755 })
    return await use(dir)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

export async function submissionFiles(directory: string) {
  if (!(await lstat(directory)).isDirectory()) throw new Error('Dossier de soumission invalide.')
  const files = new Map<string, string>()
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (
      !item.isFile() ||
      !/^[A-Za-z0-9_-]+\.catala_fr$/.test(item.name) ||
      item.name === 'interface.catala_fr'
    ) {
      throw new Error(`Fichier de soumission interdit (${item.name}).`)
    }
    const file = Bun.file(join(directory, item.name))
    if (file.size > 512 * 1024) throw new Error(`Fichier trop volumineux (${item.name}).`)
    const content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
    if (/^\s*>\s*(?:Usage de|Module)\b|^\s*```\s*catala-test|#\[test\]/m.test(content)) {
      throw new Error(`Directive de module ou de test interdite (${item.name}).`)
    }
    files.set(item.name, content)
  }
  const main = files.get(entry)
  if (!main || !/^> Inclusion: interface\.catala_fr\s*$/m.test(main)) {
    throw new Error(`${entry} doit inclure interface.catala_fr.`)
  }
  for (const [name, content] of files) {
    for (const line of content.match(/^\s*>\s*Inclusion\b[^\n]*/gm) ?? []) {
      const target = /^> Inclusion: ([A-Za-z0-9_-]+\.catala_fr)$/.exec(line.trim())?.[1]
      if (!target || (target === 'interface.catala_fr' ? name !== entry : !files.has(target))) {
        throw new Error(`Inclusion hors soumission (${name}).`)
      }
    }
  }
  return files
}

export async function stageSubmission(workdir: string, files: ReadonlyMap<string, string>) {
  const target = join(workdir, 'soumission')
  await mkdir(target, { mode: 0o755 })
  await Bun.write(join(target, 'interface.catala_fr'), Bun.file(join(task, 'interface.catala_fr')))
  for (const [name, content] of files) {
    const header = name === entry ? '> Module Calcul\n\n' : ''
    await writeFile(join(target, name), header + content, { mode: 0o644 })
  }
}

export function compile(workdir: string) {
  return runInSandbox({
    workdir,
    command: [
      'clerk',
      'typecheck',
      '--catala-opts=--check-invariants',
      '--color=never',
      '--build-dir=/build',
      '--target-dir=/build/targets',
      '-I',
      'soumission',
      `soumission/${entry}`,
    ],
    ...limits,
  })
}

if (import.meta.main) {
  try {
    if (process.argv.length !== 3 || !process.argv[2]) throw new Error('Usage : bun check.ts <pseudo>')
    const files = await submissionFiles(join(import.meta.dir, 'submission', checkHandle(process.argv[2])))
    const result = await withWorkspace(async (dir) => {
      await stageSubmission(dir, files)
      return compile(dir)
    })
    process.stdout.write(result.stdout)
    process.stderr.write(result.stderr)
    process.exitCode = result.exitCode === 0 && !result.timedOut ? 0 : 1
  } catch (error) {
    console.error(String(error))
    process.exitCode = 1
  }
}
