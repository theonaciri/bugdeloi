import { randomUUID } from 'node:crypto'
import { realpath, stat } from 'node:fs/promises'
import { arch, type } from 'node:os'

export interface SandboxOptions {
  workdir: string
  command: string[]
  timeoutMs: number
  memoryMb: number
  cpus: number
  network: false
}

interface SandboxResult {
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
  timedOut: boolean
}

const lockFile = new URL('../../../infra/catala/image.lock.json', import.meta.url)
const digestPattern = /^sha256:[a-f0-9]{64}$/
const outputLimit = 16 * 1024 * 1024

export async function readImageLock() {
  const value = await Bun.file(lockFile).json()
  if (
    !value ||
    typeof value.catala !== 'string' ||
    !/^\d+\.\d+\.\d+$/.test(value.catala) ||
    value.image !== `localhost/bugdeloi-catala:${value.catala}` ||
    typeof value.digest !== 'string' ||
    !digestPattern.test(value.digest) ||
    !['arm64', 'amd64'].includes(value.arch)
  ) {
    throw new Error('Verrou de l’image Catala invalide.')
  }
  const { catala, image, digest, arch: architecture } = value
  return { catala, image, digest, arch: architecture } as {
    catala: string
    image: string
    digest: string
    arch: 'arm64' | 'amd64'
  }
}

export async function resolveSandboxImage(): Promise<string> {
  const { image, digest, arch: architecture } = await readImageLock()
  const nativeArch = arch() === 'x64' ? 'amd64' : arch()
  if (type() !== 'Linux' || architecture !== nativeArch) {
    throw new Error(`L’image verrouillée requiert Linux ${architecture}.`)
  }
  const rootless = Bun.spawnSync(['podman', 'info', '--format', '{{.Host.Security.Rootless}}'])
  if (rootless.exitCode !== 0 || rootless.stdout.toString().trim() !== 'true') {
    throw new Error(`Podman rootless indisponible. ${rootless.stderr.toString().trim()}`)
  }
  const inspectFormat = '{{.Digest}} {{.Id}} {{.Architecture}}'
  // Podman peut indexer une image locale construite par tag seulement. Dans ce
  // cas, comparer le digest du manifeste puis exécuter par ID immuable.
  for (const reference of [`${image.split(':')[0]}@${digest}`, image]) {
    const info = Bun.spawnSync(['podman', 'image', 'inspect', '--format', inspectFormat, reference])
    const [actualDigest, id, actualArch] = info.stdout.toString().trim().split(' ')
    if (
      info.exitCode === 0 &&
      actualDigest === digest &&
      actualArch === architecture &&
      id &&
      /^[a-f0-9]{64}$/.test(id)
    ) {
      return id
    }
  }
  throw new Error(`Image locale Catala introuvable pour le digest ${digest}.`)
}

async function readOutput(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let bytes = 0
  let truncated = false
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    const remaining = outputLimit - bytes
    text += decoder.decode(value.subarray(0, remaining), { stream: true })
    bytes += Math.min(remaining, value.length)
    truncated ||= value.length > remaining
  }
  return text + decoder.decode() + (truncated ? '\n[Sortie tronquée à 16 Mio]\n' : '')
}

export async function runInSandbox(options: SandboxOptions): Promise<SandboxResult> {
  const { workdir, command, timeoutMs, memoryMb, cpus, network } = options
  if (
    typeof workdir !== 'string' ||
    workdir.length === 0 ||
    /[\0,\r\n]/.test(workdir) ||
    !Array.isArray(command) ||
    typeof command[0] !== 'string' ||
    command[0].length === 0 ||
    command[0].startsWith('-') ||
    Array.from(command).some((arg) => typeof arg !== 'string' || arg.includes('\0')) ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > 2_147_483_647 ||
    !Number.isSafeInteger(memoryMb) ||
    memoryMb <= 0 ||
    !Number.isFinite(cpus) ||
    cpus < 0.01 ||
    network !== false
  ) {
    throw new TypeError('Paramètres de sandbox invalides.')
  }
  const source = await realpath(workdir)
  if (/[\0,\r\n]/.test(source) || !(await stat(source)).isDirectory()) {
    throw new TypeError('Le dossier de travail est invalide.')
  }
  const image = await resolveSandboxImage()
  const name = `bugdeloi-catala-${randomUUID()}`
  const started = performance.now()
  const child = Bun.spawn(
    [
      'podman',
      'run',
      '--rm',
      '--name',
      name,
      '--pull=never',
      '--network=none',
      '--read-only',
      '--read-only-tmpfs=false',
      '--security-opt=no-new-privileges',
      '--cap-drop=ALL',
      '--http-proxy=false',
      '--log-driver=none',
      '--ipc=private',
      '--user=65534:65534',
      '--tmpfs=/tmp:rw,nodev,nosuid,size=128m,mode=1777',
      '--tmpfs=/build:rw,nodev,nosuid,exec,size=1g,mode=1777',
      `--memory=${memoryMb}m`,
      `--memory-swap=${memoryMb}m`,
      `--cpus=${cpus}`,
      '--pids-limit=128',
      `--timeout=${Math.ceil(timeoutMs / 1000) + 1}`,
      '--env=CLERK_BUILD_DIR=/build',
      '--env=CLERK_TARGET_DIR=/build/targets',
      '--workdir=/work',
      '--mount',
      `type=bind,src=${source},dst=/work,ro,bind-nonrecursive`,
      image,
      ...command,
    ],
    { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' },
  )
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    child.kill('SIGKILL')
  }, timeoutMs)
  const stopped = child.exited.then(async (exitCode) => {
    clearTimeout(timer)
    if (timedOut) {
      const cleanup = Bun.spawn(['podman', 'rm', '--force', '--time=0', '--ignore', name], {
        stdout: 'ignore',
        stderr: 'pipe',
      })
      const [code, stderr] = await Promise.all([cleanup.exited, new Response(cleanup.stderr).text()])
      if (code !== 0) {
        throw new Error(`Nettoyage de la sandbox impossible. ${stderr.trim()}`)
      }
    }
    return exitCode
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    stopped,
    readOutput(child.stdout),
    readOutput(child.stderr),
  ])
  return { exitCode, stdout, stderr, durationMs: Math.round(performance.now() - started), timedOut }
}
