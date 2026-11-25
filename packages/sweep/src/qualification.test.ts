import { describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseVerdicts, readCommittedVerdicts } from './qualification.ts'

const yaml = `- id: F-2099-9999
  verdict: choix_assumé
  note: "Motif fictif."
  reviewer: exemple-1
`

describe('schéma des verdicts YAML', () => {
  test('lit la note et le handle de GitHub', () => {
    expect(parseVerdicts(yaml)).toEqual([
      { id: 'F-2099-9999', verdict: 'choix_assumé', note: 'Motif fictif.', reviewer: 'exemple-1' },
    ])
  })

  test.each([
    '[]',
    '---\n[]\n---\n[]',
    yaml + yaml,
    `${yaml}  verdict: lacune\n`,
    `${yaml}  champ_inconnu: true\n`,
    yaml.replace('choix_assumé', 'inconnu'),
    yaml.replace('"Motif fictif."', '"  "'),
    yaml.replace('"Motif fictif."', '42'),
    yaml.replace('F-2099-9999', '2099-9999'),
    yaml.replace('exemple-1', '@exemple'),
  ])('rejette %j', (invalid) => {
    expect(() => parseVerdicts(invalid)).toThrow()
  })
})

test('exige un fichier commité et propre et retient son dernier commit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bugdeloi-verdicts-'))
  const file = 'qualifications/verdicts/2099-01-01-exemple-1.yaml'
  const git = (...args: string[]) =>
    execFileSync(
      'git',
      [
        '-c',
        'user.name=Test',
        '-c',
        'user.email=test@example.invalid',
        '-c',
        'commit.gpgsign=false',
        ...args,
      ],
      { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] },
    )
      .toString()
      .trim()
  try {
    git('init', '-q')
    git('commit', '--allow-empty', '-m', 'Initialise le dépôt de test')
    mkdirSync(join(dir, 'qualifications/verdicts'), { recursive: true })
    const path = join(dir, file)
    writeFileSync(path, yaml)
    expect(() => readCommittedVerdicts(file, dir)).toThrow('non commité')
    git('add', file)
    expect(() => readCommittedVerdicts(file, dir)).toThrow('non commité')
    git('commit', '-m', 'Ajoute le verdict fictif')
    const commit = git('rev-parse', 'HEAD')
    git('commit', '--allow-empty', '-m', 'Commit sans changement du verdict')
    expect(readCommittedVerdicts(path, dir)).toEqual({ file, commit, entries: parseVerdicts(yaml) })

    writeFileSync(path, `${yaml}# modification locale\n`)
    expect(() => readCommittedVerdicts(file, dir)).toThrow('modifié localement')
    git('add', file)
    writeFileSync(path, yaml)
    expect(() => readCommittedVerdicts(file, dir)).toThrow('modifié localement')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
