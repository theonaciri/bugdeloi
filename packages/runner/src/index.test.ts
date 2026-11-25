import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readImageLock, resolveSandboxImage, runInSandbox } from './index.ts'

const options = {
  workdir: import.meta.dir,
  command: ['catala', '--version'],
  timeoutMs: 5000,
  memoryMb: 128,
  cpus: 1,
  network: false,
} as const
const valid = { ...options, command: [...options.command] }

test('refuse les arguments invalides avant de lancer Podman', async () => {
  await expect(runInSandbox({ ...valid, command: ['--privileged'] })).rejects.toThrow(TypeError)
  await expect(runInSandbox({ ...valid, timeoutMs: 0 })).rejects.toThrow(TypeError)
  await expect(runInSandbox({ ...valid, memoryMb: -1 })).rejects.toThrow(TypeError)
  await expect(runInSandbox({ ...valid, cpus: Infinity })).rejects.toThrow(TypeError)
})

const available = await resolveSandboxImage().then(
  () => true,
  () => false,
)

test.skipIf(!available)('exécute Catala et garde les sources en lecture seule', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'bugdeloi-runner-test-'))
  try {
    const source = join(temp, 'source')
    await mkdir(source, { mode: 0o755 })
    await Bun.write(
      join(source, 'Smoke.catala_en'),
      [
        '```catala',
        '#[test] declaration scope Smoke:',
        '  output result content integer',
        '',
        'scope Smoke:',
        '  definition result equals 8',
        '  assertion result = 8',
        '```',
        '',
      ].join('\n'),
    )
    const result = await runInSandbox({
      ...valid,
      workdir: source,
      command: [
        'sh',
        '-ec',
        'catala --version; clerk test --json --color=never Smoke.catala_en; touch /tmp/ok /build/ok; if touch /work/intrus; then exit 1; fi',
      ],
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain((await readImageLock()).catala)
    expect(result.stdout).toContain('"scope_name":"Smoke","success":true')
    expect(result.stderr).toContain('Read-only file system')
    expect(result.timedOut).toBe(false)
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
})

test.skipIf(!available)('arrête une commande qui dépasse le délai', async () => {
  const result = await runInSandbox({ ...valid, command: ['sleep', '30'], timeoutMs: 800 })
  expect(result.timedOut).toBe(true)
  expect(result.exitCode).not.toBe(0)
  expect(result.durationMs).toBeLessThan(4000)
})
