import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const script = join(import.meta.dir, 'bdl.sh')
const task = 'translate-LEGIARTI000000000001'
const lease = '00000000-0000-4000-8000-000000000001'
const origin = 'https://desk.example'
const allowedPath = 'cgi/article_42.catala_fr'
const legalText = 'Texte fictif du test.\n\nUn alinéa avec espaces préservés.  \n\n'
const claim = {
  lease,
  expires_at: '2026-11-26T12:00:00.000Z',
  task: {
    id: task,
    role: 'translate',
    allowed_paths: [allowedPath],
    blind_to: [],
    context_pack: { article_number: '42' },
    legal_units: [{ legiarti: 'LEGIARTI000000000001', text: legalText }],
  },
}

const mockCurl = `#!/usr/bin/env bash
set -euo pipefail
method=GET
role=
origin=
while (( $# )); do
  case $1 in
    --request) method=$2; shift ;;
    --data-urlencode) [[ $2 != role=* ]] || role=\${2#role=}; shift ;;
    --output) output=$2; shift ;;
    --header) origin=$2; shift ;;
    --config) read -r url; shift ;;
  esac
  shift
done
if [[ $method == POST ]]; then
  printf '%s\\n' "$origin" "$url" >> "$BDL_TEST_REQUESTS"
  printf '%s' "$BDL_TEST_POST_STATUS"
else
  printf '%s\\n' "$role" >> "$BDL_TEST_REQUESTS"
  if [[ $role == translate && $BDL_TEST_FALLBACK == yes ]]; then
    printf 204
  else
    printf '%s' "$BDL_TEST_CLAIM" > "$output"
    printf 200
  fi
fi
`

let repo: string

beforeEach(async () => {
  repo = await mkdtemp(join(tmpdir(), 'bdl-wrapper-'))
  const init = Bun.spawnSync(['git', 'init', '--quiet', repo])
  if (init.exitCode !== 0) throw new Error(init.stderr.toString())
  await mkdir(join(repo, 'bin'))
  await writeFile(join(repo, 'bin', 'curl'), mockCurl, { mode: 0o755 })
  await writeFile(join(repo, 'bin', 'gh'), '#!/bin/sh\nprintf "default-handle\\n"\n', { mode: 0o755 })
})

afterEach(async () => {
  await rm(repo, { recursive: true, force: true })
})

function run(args: string[], overrides: Record<string, string | undefined> = {}) {
  const result = Bun.spawnSync([script, ...args], {
    cwd: repo,
    env: {
      ...process.env,
      PATH: `${join(repo, 'bin')}:${process.env.PATH}`,
      BDL_HANDLE: 'test-handle',
      BDL_ORIGIN: origin,
      BDL_FAMILY: undefined,
      BDL_MODEL: undefined,
      BDL_ROLE: undefined,
      BDL_TEST_CLAIM: JSON.stringify(claim),
      BDL_TEST_REQUESTS: join(repo, 'requests'),
      BDL_TEST_FALLBACK: 'no',
      BDL_TEST_POST_STATUS: '204',
      ...overrides,
    },
  })
  return {
    code: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  }
}

const savedLease = () => join(repo, '.bdl', 'leases', `${task}.json`)
const skeleton = () => join(repo, 'corpus', allowedPath)
const requests = () => readFile(join(repo, 'requests'), 'utf8')

describe('tools/bdl.sh', () => {
  test('lists contributor commands without calling the desk', async () => {
    const result = run(['--help'])
    expect(result.code).toBe(0)
    for (const command of ['setup', 'next', 'beat', 'check', 'submit', 'submit-batch', 'release', 'doc']) {
      expect(result.stdout).toContain(command)
    }
    expect((await readdir(repo)).sort()).toEqual(['.git', 'bin'])
  })

  test('rejects invalid or missing arguments before calling the desk', async () => {
    const invalid = [
      ['unknown'],
      ['next', 'extra'],
      ['next', '0'],
      ['next', '2', 'extra'],
      ['beat'],
      ['beat', '../escape'],
      ['submit-batch', task],
      ['check', '../escape'],
      ['submit', '--all'],
      ['release', task],
      ['release', task, 'invalid'],
    ]
    for (const args of invalid) {
      expect(run(args).code).toBe(1)
    }
    expect((await readdir(repo)).sort()).toEqual(['.git', 'bin'])
  })

  test('writes the verbatim skeleton and stores the lease privately', async () => {
    const result = run(['next'], { BDL_HANDLE: undefined })
    expect(result).toEqual({
      code: 0,
      stderr: '',
      stdout: `Tâche réservée : ${task} → ${allowedPath}\nJ’ai rejoint BugDeLoi. Suivre mon avancement : ${origin}/a/default-handle\n`,
    })
    expect(await readFile(skeleton(), 'utf8')).toBe(`#### Article 42|LEGIARTI000000000001\n\n${legalText}`)
    expect(JSON.parse(await readFile(savedLease(), 'utf8'))).toEqual({
      ...claim,
      origin,
      family: 'openai',
      model: 'unknown',
    })
    expect((await stat(savedLease())).mode & 0o777).toBe(0o600)
    expect((await stat(join(repo, '.bdl', 'leases'))).mode & 0o777).toBe(0o700)
    expect(await readdir(join(repo, '.bdl', 'leases'))).toEqual([`${task}.json`])

    await writeFile(skeleton(), 'Contribution en cours\n')
    expect(run(['next']).code).toBe(0)
    expect(await readFile(skeleton(), 'utf8')).toBe('Contribution en cours\n')
  })

  test('falls back to analyst only when the role is implicit', async () => {
    const analyst = { ...claim, task: { ...claim.task, role: 'analyst', allowed_paths: ['analyses/a.md'] } }
    const fallback = { BDL_TEST_FALLBACK: 'yes', BDL_TEST_CLAIM: JSON.stringify(analyst) }
    const forced = run(['next'], { ...fallback, BDL_ROLE: 'translate' })
    expect(forced).toEqual({ code: 0, stderr: '', stdout: 'Aucune tâche disponible.\n' })
    expect(await readdir(join(repo, '.bdl', 'leases'))).toEqual([])

    expect(run(['next'], fallback).code).toBe(0)
    expect(JSON.parse(await readFile(savedLease(), 'utf8')).task.role).toBe('analyst')
    expect(await Bun.file(skeleton()).exists()).toBe(false)
    expect(await requests()).toBe('translate\ntranslate\nanalyst\n')
  })

  test('rejects skeleton paths outside the corpus and preserves the lease', async () => {
    const invalid = { ...claim, task: { ...claim.task, allowed_paths: ['../article_42.catala_fr'] } }
    expect(run(['next'], { BDL_TEST_CLAIM: JSON.stringify(invalid) }).code).toBe(1)
    expect(await Bun.file(join(repo, 'article_42.catala_fr')).exists()).toBe(false)
    expect(await Bun.file(savedLease()).exists()).toBe(true)
  })

  test('retains the lease on failed release and removes it after HTTP 204', async () => {
    expect(run(['next']).code).toBe(0)
    expect(run(['release', task, 'submitted'], { BDL_TEST_POST_STATUS: '503' }).code).toBe(1)
    expect(await Bun.file(savedLease()).exists()).toBe(true)
    expect(run(['release', task, 'submitted'], { BDL_ORIGIN: 'https://other.example' }).code).toBe(0)
    expect(await Bun.file(savedLease()).exists()).toBe(false)
    const release = `Origin: ${origin}\nurl = "${origin}/desk/release?lease=${lease}&reason=submitted"\n`
    expect(await requests()).toBe(`translate\n${release}${release}`)
  })

  test('renews active leases and stops and cleans up after HTTP 410', async () => {
    expect(run(['next']).code).toBe(0)
    expect(run(['beat', task], { BDL_TEST_POST_STATUS: '200' }).code).toBe(0)
    expect(await Bun.file(savedLease()).exists()).toBe(true)
    expect(run(['beat', task], { BDL_TEST_POST_STATUS: '410' })).toEqual({
      code: 1,
      stdout: 'STOPPED\n',
      stderr: '',
    })
    expect(await Bun.file(savedLease()).exists()).toBe(false)
    const beat = `Origin: ${origin}\nurl = "${origin}/desk/beat?lease=${lease}"\n`
    expect(await requests()).toBe(`translate\n${beat}${beat}`)
  })

  test('checks the corpus and tests the leased path in the container', async () => {
    for (const name of ['bun', 'podman']) {
      await writeFile(
        join(repo, 'bin', name),
        `#!/bin/bash\nprintf "%s\\n" "${name}" "$@" >> "$BDL_TEST_REQUESTS"\n`,
        {
          mode: 0o755,
        },
      )
    }
    expect(run(['next']).code).toBe(0)
    expect(run(['check', task]).code).toBe(0)
    const commands = await requests()
    expect(commands).toStartWith('translate\nbun\nscripts/check-corpus-pr.ts\npodman\nrun\n')
    expect(commands).toContain(`--network=none\n--read-only\n`)
    expect(commands).toContain(`-v\n${repo}/corpus:/work:ro\n`)
    expect(commands).toEndWith(
      `/work\nghcr.io/theonaciri/bugdeloi-catala:1.3.2\nclerk\ntest\n--color=never\n${allowedPath}\n`,
    )
  })

  test('prints the pinned Catala documentation without calling the desk', async () => {
    const result = run(['doc'])
    expect(result.code).toBe(0)
    expect(result.stdout).toContain(
      'https://github.com/CatalaLang/catala/blob/1.3.2/doc/syntax/syntax_fr.catala_fr',
    )
    expect(result.stdout).toContain('corpus/CATALA.md')
    expect((await readdir(repo)).sort()).toEqual(['.git', 'bin'])
  })

  test('reserves several tasks with next N and announces the owner link once', async () => {
    const result = run(['next', '2'])
    expect(result.code).toBe(0)
    expect(result.stdout.match(/Tâche réservée/g)?.length).toBe(2)
    expect(result.stdout.match(/J’ai rejoint/g)?.length).toBe(1)
    expect(await requests()).toBe('translate\ntranslate\n')
  })

  test('stops next N at the first empty queue', async () => {
    const result = run(['next', '3'], { BDL_ROLE: 'translate', BDL_TEST_FALLBACK: 'yes' })
    expect(result).toEqual({ code: 0, stderr: '', stdout: 'Aucune tâche disponible.\n' })
    expect(await requests()).toBe('translate\n')
  })

  test('renews every local lease with beat --all', async () => {
    const leases = join(repo, '.bdl', 'leases')
    await mkdir(leases, { recursive: true })
    for (const [id, l] of [
      ['translate-LEGIARTI000000000001', lease],
      ['translate-LEGIARTI000000000002', '00000000-0000-4000-8000-000000000002'],
    ] as const) {
      await writeFile(
        join(leases, `${id}.json`),
        JSON.stringify({ ...claim, lease: l, task: { ...claim.task, id }, origin }),
      )
    }
    const result = run(['beat', '--all'], { BDL_TEST_POST_STATUS: '200' })
    expect(result.code).toBe(0)
    expect(result.stdout.match(/Bail renouvelé/g)?.length).toBe(2)
    expect((await requests()).match(/desk\/beat/g)?.length).toBe(2)
  })

  test('submits a batch in one commit with one trailer per task, then releases each lease', async () => {
    const remote = await mkdtemp(join(tmpdir(), 'bdl-remote-'))
    const git = (...args: string[]) => {
      const r = Bun.spawnSync(['git', ...args], { cwd: repo })
      if (r.exitCode !== 0) throw new Error(r.stderr.toString())
      return r.stdout.toString()
    }
    try {
      Bun.spawnSync(['git', 'init', '--quiet', '--bare', remote])
      git('config', 'user.email', 'test@example.invalid')
      git('config', 'user.name', 'Test')
      await writeFile(join(repo, 'README'), 'base\n')
      git('add', 'README')
      git('commit', '--quiet', '-m', 'base')
      git('branch', '-M', 'main')
      git('remote', 'add', 'origin', remote)
      git('push', '--quiet', '-u', 'origin', 'main')
      git('remote', 'set-head', 'origin', 'main')
      await writeFile(
        join(repo, 'bin', 'gh'),
        '#!/bin/sh\nprintf "gh %s\\n" "$*" >> "$BDL_TEST_REQUESTS"\n',
        { mode: 0o755 },
      )
      for (const name of ['bun', 'podman']) {
        await writeFile(join(repo, 'bin', name), '#!/bin/sh\nexit 0\n', { mode: 0o755 })
      }
      const leases = join(repo, '.bdl', 'leases')
      await mkdir(leases, { recursive: true })
      const ids = ['translate-LEGIARTI000000000001', 'translate-LEGIARTI000000000002']
      for (const [i, id] of ids.entries()) {
        const path = `cgi/article_${i + 1}.catala_fr`
        await mkdir(join(repo, 'corpus', 'cgi'), { recursive: true })
        await writeFile(join(repo, 'corpus', path), `#### Article ${i + 1}|LEGIARTI00000000000${i + 1}\n`)
        await writeFile(
          join(leases, `${id}.json`),
          JSON.stringify({
            ...claim,
            lease: `00000000-0000-4000-8000-00000000000${i + 1}`,
            task: { ...claim.task, id, allowed_paths: [path] },
            origin,
            family: 'anthropic',
            model: 'test-model',
          }),
        )
      }
      const result = run(['submit-batch', ...ids])
      expect(result.stderr).not.toContain('invalide')
      expect(result.code).toBe(0)
      expect(result.stdout).toContain(`Tâche déposée : ${ids[1]}`)
      const message = git('log', '-1', '--format=%B')
      expect(message).toContain(`BugDeLoi-Task: ${ids[0]}\nBugDeLoi-Task: ${ids[1]}\n`)
      expect(message).toContain(
        'BugDeLoi-Role: translate\nBugDeLoi-Family: anthropic\nBugDeLoi-Model: test-model',
      )
      expect(git('show', '--name-only', '--format=', 'HEAD').trim().split('\n').sort()).toEqual([
        'corpus/cgi/article_1.catala_fr',
        'corpus/cgi/article_2.catala_fr',
      ])
      const log = await requests()
      expect(log).toContain('gh pr create')
      expect(log.match(/reason=submitted/g)?.length).toBe(2)
      expect(await readdir(leases)).toEqual([])
    } finally {
      await rm(remote, { recursive: true, force: true })
    }
  })
})
