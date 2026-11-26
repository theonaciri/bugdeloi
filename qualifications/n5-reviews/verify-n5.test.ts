import { afterAll, describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { classifySignature, readGitInfo, reviewResult, validateReview, verifyDirectory } from './verify-n5.ts'

const sample = await Bun.file(join(import.meta.dir, 'EXEMPLE-N5.yaml.sample')).text()

const valid = () => ({
  node: 'Cgi197Decote@v1',
  legal_units: [{ legiarti: 'LEGIARTI000053542636', text_sha256: 'a'.repeat(64) }],
  catala_file: 'corpus/cgi/noyau_ir.catala_fr',
  catala_commit: 'b'.repeat(40),
  reviewer: { name: 'A B', handle: 'ab', credentials: 'Avocat fiscaliste', affiliation: 'Cabinet X' },
  reviewed_at: '2026-12-01',
  interpretation_choices_checked: ['Art. 197 I-1 : seuil inclusif'],
  verdict: 'approved',
  note: 'RAS',
})

describe('validateReview', () => {
  test('revue valide', () => expect(validateReview(valid())).toEqual([]))

  test('le modèle EXEMPLE-N5.yaml.sample respecte le schéma', () => {
    expect(validateReview(Bun.YAML.parse(sample))).toEqual([])
  })

  test('qualification du relecteur manquante', () => {
    const doc = valid()
    doc.reviewer.credentials = ' '
    expect(validateReview(doc).join('\n')).toContain('reviewer.credentials')
    delete (doc.reviewer as Partial<typeof doc.reviewer>).handle
    expect(validateReview(doc).join('\n')).toContain('reviewer.handle')
  })

  test('LEGIARTI et SHA-256 invalides', () => {
    const doc = valid()
    doc.legal_units = [{ legiarti: 'LEGIARTI123', text_sha256: 'xyz' }]
    const errors = validateReview(doc).join('\n')
    expect(errors).toContain('legiarti')
    expect(errors).toContain('text_sha256')
  })

  test('choix d’interprétation vides, verdict inconnu, date invalide', () => {
    const doc = { ...valid(), interpretation_choices_checked: [], verdict: 'ok', reviewed_at: '01/12/2026' }
    const errors = validateReview(doc).join('\n')
    expect(errors).toContain('interpretation_choices_checked')
    expect(errors).toContain('verdict')
    expect(errors).toContain('reviewed_at')
  })

  test('changes_requested exige une note', () => {
    const doc = { ...valid(), verdict: 'changes_requested', note: '' }
    expect(validateReview(doc).join('\n')).toContain('note')
  })

  test('document non objet', () => expect(validateReview('x')).not.toEqual([]))
})

describe('classifySignature', () => {
  test('G et U sont acceptés', () => {
    expect(classifySignature('G')).toBe('VALID_SIGNED')
    expect(classifySignature('U')).toBe('VALID_SIGNED')
  })
  test('N et vide : non signé', () => {
    expect(classifySignature('N')).toBe('UNSIGNED_COMMIT')
    expect(classifySignature('')).toBe('UNSIGNED_COMMIT')
  })
  test.each(['B', 'X', 'Y', 'R', 'E'])('%s : signature refusée', (code) => {
    expect(classifySignature(code)).toBe('BAD_SIGNATURE')
  })
})

describe('reviewResult', () => {
  const yaml = JSON.stringify(valid())
  const signed = { signatureCode: 'G', commit: 'c'.repeat(40), dirty: false }

  test('signé + approved : N5', () => {
    const r = reviewResult('r.yaml', yaml, signed)
    expect(r.status).toBe('VALID_SIGNED')
    expect(r.grantsN5).toBe(true)
  })
  test('signé + changes_requested : pas de N5', () => {
    const r = reviewResult('r.yaml', JSON.stringify({ ...valid(), verdict: 'changes_requested' }), signed)
    expect(r.status).toBe('VALID_SIGNED')
    expect(r.grantsN5).toBe(false)
  })
  test('non signé : jamais N5', () => {
    const r = reviewResult('r.yaml', yaml, { ...signed, signatureCode: 'N' })
    expect(r.status).toBe('UNSIGNED_COMMIT')
    expect(r.grantsN5).toBe(false)
  })
  test('signature mauvaise', () => {
    expect(reviewResult('r.yaml', yaml, { ...signed, signatureCode: 'B' }).status).toBe('BAD_SIGNATURE')
  })
  test('non commité ou modifié', () => {
    expect(reviewResult('r.yaml', yaml, { signatureCode: null, commit: null, dirty: false }).status).toBe(
      'UNCOMMITTED',
    )
    expect(reviewResult('r.yaml', yaml, { ...signed, dirty: true }).status).toBe('UNCOMMITTED')
  })
  test('schéma invalide prime, même signé', () => {
    const r = reviewResult('r.yaml', JSON.stringify({ ...valid(), node: '' }), signed)
    expect(r.status).toBe('INVALID_SCHEMA')
    expect(r.grantsN5).toBe(false)
  })
  test('YAML illisible', () => {
    expect(reviewResult('r.yaml', 'a: [', signed).status).toBe('INVALID_SCHEMA')
  })
})

describe('intégration Git', () => {
  const dir = mkdtempSync(join(tmpdir(), 'n5-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))
  const run = (cmd: string, args: string[]) => spawnSync(cmd, args, { cwd: dir, encoding: 'utf8' })
  const hasSsh = spawnSync('ssh-keygen', ['-V']).error === undefined

  run('git', ['init', '-q'])
  run('git', ['config', 'user.email', 'juriste@example.org'])
  run('git', ['config', 'user.name', 'Juriste'])
  run('git', ['config', 'commit.gpgsign', 'false'])
  writeFileSync(join(dir, 'unsigned.yaml'), JSON.stringify(valid()))
  writeFileSync(join(dir, 'ignored.yaml.sample'), 'x: 1')
  run('git', ['add', '.'])
  run('git', ['commit', '-q', '-m', 'revue non signée'])
  writeFileSync(join(dir, 'untracked.yaml'), JSON.stringify(valid()))

  test('commit non signé → UNSIGNED_COMMIT, fichier non suivi → UNCOMMITTED, .sample ignoré', async () => {
    const results = await verifyDirectory(dir)
    expect(results.map((r) => [r.file.split('/').pop(), r.status])).toEqual([
      ['unsigned.yaml', 'UNSIGNED_COMMIT'],
      ['untracked.yaml', 'UNCOMMITTED'],
    ])
    expect(results.every((r) => !r.grantsN5)).toBe(true)
  })

  test.skipIf(!hasSsh)('commit signé (SSH) → VALID_SIGNED', async () => {
    run('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-f', join(dir, 'key')])
    const pub = await Bun.file(join(dir, 'key.pub')).text()
    writeFileSync(join(dir, 'allowed'), `juriste@example.org ${pub}`)
    run('git', ['config', 'gpg.format', 'ssh'])
    run('git', ['config', 'gpg.ssh.allowedSignersFile', join(dir, 'allowed')])
    run('git', ['config', 'user.signingkey', join(dir, 'key.pub')])
    writeFileSync(join(dir, 'signed.yaml'), JSON.stringify(valid()))
    run('git', ['add', 'signed.yaml'])
    const commit = run('git', ['commit', '-q', '-S', '-m', 'revue signée'])
    expect(commit.status).toBe(0)
    const info = readGitInfo(join(dir, 'signed.yaml'))
    expect(info.signatureCode).toBe('G')
    const result = reviewResult('signed.yaml', JSON.stringify(valid()), info)
    expect(result.status).toBe('VALID_SIGNED')
    expect(result.grantsN5).toBe(true)
  })
})
