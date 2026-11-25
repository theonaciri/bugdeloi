import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

export const source = 'inria/catala-examples'
export const sourceUrl = 'https://github.com/CatalaLang/catala-examples'
export const sourceCommit = '9e251b932288cf5f4a74af072d203144a057494b'
const sourceRepo = join(homedir(), '.cache/bugdeloi/ext/catala-examples')

async function exec(command: string[]) {
  const child = Bun.spawn(command, { stdin: 'ignore', stdout: 'ignore', stderr: 'pipe' })
  const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])
  if (code !== 0) throw new Error(`${command.join(' ')}\n${stderr.trim()}`)
}

export async function withSource<T>(use: (directory: string) => Promise<T>): Promise<T> {
  if (!(await stat(sourceRepo, { throwIfNoEntry: false }))) {
    await mkdir(dirname(sourceRepo), { recursive: true })
    await exec(['git', 'clone', sourceUrl, sourceRepo])
  }
  const temp = await mkdtemp(join(tmpdir(), 'bugdeloi-c01-'))
  try {
    const archive = join(temp, 'source.tar')
    const directory = join(temp, 'source')
    await mkdir(directory, { mode: 0o755 })
    await exec(['git', '-C', sourceRepo, 'archive', '--format=tar', `--output=${archive}`, sourceCommit])
    await exec(['tar', '-xf', archive, '-C', directory])
    return await use(directory)
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
}

export function writeJson(name: string, value: unknown) {
  return Bun.write(join(import.meta.dir, name), `${JSON.stringify(value, null, 2)}\n`)
}
