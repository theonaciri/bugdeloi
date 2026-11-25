/**
 * Intégration : balayage complet sur `bugdeloi_test`, dans une transaction annulée.
 * Vérifie l'idempotence (même empreinte → pas de doublon), le rejeu, l'événement public sans nombre
 * de candidats et l'absence d'écriture dans `replication_run`. Sauté si la base est injoignable.
 */
import { describe, expect, test } from 'bun:test'
import { normalizeLegalText } from '@bugdeloi/core/legi'
import {
  createSql,
  type Db,
  event,
  finding,
  legalArticle,
  legalLink,
  legalText,
  legiState,
  replicationRun,
  schema,
  sweepRun,
} from '@bugdeloi/db'
import { eq, like } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { legalUnit } from './certificate.ts'
import { listFindings } from './list.ts'
import { replayFinding } from './replay.ts'
import { runSweep } from './run.ts'

const TEST_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://ubuntu@localhost:5432/bugdeloi_test?host=/var/run/postgresql'
const TEXT_ID = 'LEGITEXT999999999998'
const AS_OF = '2026-11-25'

async function reachable(): Promise<boolean> {
  const probe = createSql(TEST_URL, { max: 1, connect_timeout: 2 })
  try {
    await probe`select 1`
    return true
  } catch {
    return false
  } finally {
    await probe.end()
  }
}

const html =
  "<p>Pour l'application de l'article L. 200-1 du présent code, le montant (hors taxes est fixé.</p>"

describe('sweep sur bugdeloi_test', async () => {
  const ok = await reachable()
  test.skipIf(!ok)('run → findings dédoublonnés, rejeu identique, événement sans compteur', async () => {
    const client = createSql(TEST_URL, { max: 1 })
    const db = drizzle(client, { schema })
    try {
      await db.transaction(async (tx) => {
        const t = tx as unknown as Db
        await tx.insert(legalText).values({ id: TEXT_ID, title: 'Texte de test (fictif)' })
        await tx
          .insert(legiState)
          .values({ textId: TEXT_ID, archive: 'test.tar.gz', archiveSha256: 'b'.repeat(64), asOf: AS_OF })
        const row = (id: string, num: string, etat: string, debut: string, fin: string | null, h = '') => ({
          id,
          textId: TEXT_ID,
          num,
          articleKey: `${TEXT_ID}:${num}`,
          etat,
          dateDebut: debut,
          dateFin: fin,
          contentHtml: h,
          contentText: normalizeLegalText(h),
          textSha256: `sha-${id}`,
          versionIds: [id],
        })
        await tx
          .insert(legalArticle)
          .values([
            row('LEGIARTI999999999801', 'L100-1', 'VIGUEUR', '2020-01-01', '2999-01-01', html),
            row('LEGIARTI999999999802', 'L200-1', 'ABROGE', '2000-01-01', '2018-01-01'),
          ])
        await tx.insert(legalLink).values({
          articleId: 'LEGIARTI999999999801',
          typeLien: 'CITATION',
          sens: 'source',
          targetId: 'LEGIARTI999999999802',
          targetCid: TEXT_ID,
          targetNum: 'L200-1',
          targetNature: 'CODE',
          label: 'Code de test - art. L200-1',
        })
        const before = (await tx.select().from(replicationRun)).length

        const first = await runSweep(t, { codes: [TEXT_ID] })
        const created = first.outcomes.reduce((n, o) => n + o.new, 0)
        expect(created).toBe(3) // 1 lien + 1 citation textuelle + 1 parenthèse
        const rows = await tx.select().from(finding).where(like(finding.id, 'F-%'))
        const mine = rows.filter((r) =>
          r.legalUnits.includes(legalUnit({ id: 'LEGIARTI999999999801', dateDebut: '2020-01-01' })),
        )
        expect(mine.map((r) => `${r.type}/${(r.certificate as { subtype: string }).subtype}`).sort()).toEqual(
          ['REF_MORTE/abrogé', 'REF_MORTE/abrogé', 'SYNTAXE/parenthese_non_fermee'],
        )
        expect(mine.every((r) => r.status === 'candidate')).toBe(true)

        // idempotence : même base, mêmes empreintes, aucun doublon
        const second = await runSweep(t, { codes: [TEXT_ID] })
        expect(second.outcomes.reduce((n, o) => n + o.new, 0)).toBe(0)
        expect(second.outcomes.reduce((n, o) => n + o.alreadyKnown, 0)).toBe(created)

        // rejeu : preuve identique recalculée depuis la base
        const target = mine.find((r) => r.detector.startsWith('ref-morte-liens'))
        expect(target).toBeDefined()
        const same = await replayFinding(t, (target as { id: string }).id)
        expect(same.verdict).toBe('identique')
        expect(same.legiState.same).toBe(true)

        // la base change (l'article cité a une autre date de fin) → le rejeu le dit
        await tx
          .update(legalArticle)
          .set({ dateFin: '2019-01-01' })
          .where(eq(legalArticle.id, 'LEGIARTI999999999802'))
        const changed = await replayFinding(t, (target as { id: string }).id)
        expect(changed.verdict).toBe('différente')
        expect(changed.differences.length).toBeGreaterThan(0)

        // liste
        const listed = await listFindings(t, { type: 'SYNTAXE' })
        expect(listed.some((l) => l.subtype === 'parenthese_non_fermee')).toBe(true)

        // événement public : ni nombre de candidats ni identifiant de finding
        const [ev] = await tx
          .select()
          .from(event)
          .where(eq(event.subject, String(second.runId)))
        expect(ev?.type).toBe('sweep.finished')
        expect(JSON.stringify(ev?.payload)).not.toMatch(/candidat|F-20|findings?"/)
        expect(Object.keys(ev?.payload ?? {}).sort()).toEqual([
          'articlesChecked',
          'asOf',
          'codes',
          'detectors',
          'runId',
          'summary',
        ])

        // un balayage ne pollue pas replication_run
        expect((await tx.select().from(replicationRun)).length).toBe(before)
        const [run] = await tx
          .select()
          .from(sweepRun)
          .where(eq(sweepRun.id, first.runId as number))
        expect(run?.status).toBe('success')
        expect(run?.articlesChecked).toEqual({ [TEXT_ID]: 1 })
        tx.rollback()
      })
    } catch (error) {
      if (!(error instanceof Error && error.message.includes('Rollback'))) throw error
    } finally {
      await client.end()
    }
  })
})
