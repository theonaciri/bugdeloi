import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { legalTextHash } from '@bugdeloi/core'
import { checkCatala, contributionTrailers, validateAllowedPaths, validateOracle } from './checker.ts'
import { Desk, DeskError, readLease } from './desk.ts'
import { submissionMessage } from './submit.ts'

describe('bdl checker', () => {
  test('valide les empreintes LEGI N1 et rejette toute altération du texte', () => {
    const prose = 'Le revenu imposable est divisé en parts.'
    const id = 'LEGIARTI000054373592'
    const source = `#### Article 193|${id}\n\n${prose}\n\n\`\`\`catala\ndéclaration champ d'application Demo:\n  sortie ok contenu booléen\n\`\`\`\n`
    const ok = checkCatala(source, { manifest: { [id]: legalTextHash(prose) } })
    expect(ok.diagnostics).toEqual([])

    const tampered = checkCatala(source.replace('parts.', 'tranches.'), {
      manifest: { [id]: legalTextHash(prose) },
    })
    expect(tampered.diagnostics.some((d) => d.includes('empreinte LEGI différente'))).toBe(true)
  })

  test('valide les oracles YAML et exige derivation pour derivation_manuelle', () => {
    const valid = `
id: cgi-197-test-001
interface: CalculImpotRevenu@v1
source:
  kind: derivation_manuelle
  legal_units: [LEGIARTI000053542636@2026-02-21]
author: { handle: tester, role: oracle, family: google }
blind_to: [corpus/cgi/noyau_ir.catala_fr]
inputs: { revenu: 10000 }
expected: { impot: 0 }
derivation: |
  CGI 197 I.1 : sous 11 600 €, taux 0 %.
`
    expect(validateOracle(valid)).toEqual([])

    const missingDerivation = valid.replace(/derivation:[\s\S]*/, '')
    expect(validateOracle(missingDerivation).some((d) => d.includes('derivation'))).toBe(true)

    const badFamily = valid.replace('family: google', 'family: inconnu')
    expect(validateOracle(badFamily).some((d) => d.includes('author.family'))).toBe(true)
  })

  test('valide les trailers de commit et les chemins autorisés', () => {
    const msg = submissionMessage({
      task: 'T-2026-001',
      role: 'translate',
      family: 'google',
      model: 'gemini-4-neon',
      dryRun: true,
    })
    expect(contributionTrailers(msg.message).diagnostics).toEqual([])

    const badMsg = 'Message sans trailers'
    expect(contributionTrailers(badMsg).diagnostics.length).toBeGreaterThan(0)

    expect(
      validateAllowedPaths(['corpus/cgi/a.catala_fr'], ['corpus/cgi/'], ['corpus/cgi/secret.catala_fr']),
    ).toEqual([])
    expect(
      validateAllowedPaths(
        ['corpus/cgi/secret.catala_fr', 'apps/web/src/app.css'],
        ['corpus/cgi/'],
        ['corpus/cgi/secret.catala_fr'],
      ).length,
    ).toBe(2)
  })
})

describe('bdl desk client', () => {
  test('enchaîne next, beat et release puis gère 204, 410 et 429', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bdl-desk-'))
    const file = join(dir, '.bdl-lease.json')
    try {
      const leaseToken = '11111111-1111-4111-8111-111111111111'
      const expires = new Date(Date.now() + 20 * 60_000).toISOString()
      const task = {
        id: 'T-2026-001',
        role: 'analyst',
        allowed_paths: ['corpus/interfaces/'],
        blind_to: [],
        legal_units: [{ legiarti: 'LEGIARTI000054373592', text_sha256: 'b'.repeat(64) }],
      }

      const calls: string[] = []
      const desk = new Desk(file, async (url, init) => {
        calls.push(`${init.method ?? 'GET'} ${url.pathname}`)
        if (url.pathname === '/desk/next') {
          return Response.json({ task, lease: leaseToken, expires_at: expires })
        }
        if (url.pathname === '/desk/beat') {
          return Response.json({ expires_at: expires })
        }
        if (url.pathname === '/desk/release') {
          return new Response(null, { status: 204 })
        }
        return new Response(null, { status: 404 })
      })

      const claimed = await desk.next('https://bugdeloi.theonaciri.fr', 'octocat', 'analyst', 'google')
      expect(claimed?.task.id).toBe('T-2026-001')
      expect((await readLease(file))?.lease).toBe(leaseToken)

      expect(await desk.beat()).toBe(expires)
      await desk.release('other')
      expect(await readLease(file)).toBeNull()
      expect(calls).toEqual(['GET /desk/next', 'POST /desk/beat', 'POST /desk/release'])

      const emptyDesk = new Desk(file, async () => new Response(null, { status: 204 }))
      expect(
        await emptyDesk.next('https://bugdeloi.theonaciri.fr', 'octocat', 'analyst', 'google'),
      ).toBeNull()

      const rateDesk = new Desk(
        file,
        async () => new Response(null, { status: 429, headers: { 'retry-after': '12' } }),
      )
      await expect(
        rateDesk.next('https://bugdeloi.theonaciri.fr', 'octocat', 'analyst', 'google'),
      ).rejects.toBeInstanceOf(DeskError)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
