/**
 * Invariant : le prédicat SQL `articleInForce` et la règle JS `isInForce` (@bugdeloi/core) comptent
 * exactement les mêmes articles. Sans cela, la carte (arbre daté par l'ingestion) et les compteurs
 * du site divergent. Base : bugdeloi_test, tout est fait dans une transaction annulée.
 */
import { describe, expect, test } from 'bun:test'
import { isInForce } from '@bugdeloi/core/legi'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { createSql } from './client.ts'
import { articleInForce } from './predicates.ts'
import * as schema from './schema.ts'

const TEST_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://ubuntu@localhost:5432/bugdeloi_test?host=/var/run/postgresql'

const TEXT_ID = 'LEGITEXT999999999999'
const AS_OF = '2026-11-25'
const CASES: Array<{ etat: string | null; dateDebut: string | null; dateFin: string | null }> = [
  { etat: 'VIGUEUR', dateDebut: '2020-01-01', dateFin: '2999-01-01' },
  { etat: 'VIGUEUR', dateDebut: '2020-01-01', dateFin: null },
  { etat: 'ABROGE_DIFF', dateDebut: '2020-01-01', dateFin: '2027-01-01' },
  { etat: 'ABROGE_DIFF', dateDebut: '2020-01-01', dateFin: AS_OF }, // fin exclue
  { etat: 'VIGUEUR_DIFF', dateDebut: '2027-01-01', dateFin: '2999-01-01' }, // pas encore
  { etat: 'MODIFIE', dateDebut: '2010-01-01', dateFin: '2020-01-01' },
  { etat: 'MODIFIE_MORT_NE', dateDebut: '2020-01-01', dateFin: '2999-01-01' },
  { etat: 'ANNULE', dateDebut: '2020-01-01', dateFin: '2999-01-01' },
  { etat: 'ABROGE', dateDebut: '2010-01-01', dateFin: '2222-02-22' }, // incohérence DILA réelle
  { etat: null, dateDebut: AS_OF, dateFin: null }, // début inclus
  { etat: 'VIGUEUR', dateDebut: null, dateFin: null },
]

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

describe('articleInForce ≡ isInForce', async () => {
  const ok = await reachable()
  test.skipIf(!ok)('mêmes articles retenus, avec et sans date explicite', async () => {
    const client = createSql(TEST_URL, { max: 1 })
    const db = drizzle(client, { schema })
    try {
      await db.transaction(async (tx) => {
        await tx.insert(schema.legalText).values({ id: TEXT_ID, title: 'Texte de test (fictif)' })
        await tx
          .insert(schema.legiState)
          .values({ textId: TEXT_ID, archive: 'test', archiveSha256: 'test', asOf: AS_OF })
        await tx.insert(schema.legalArticle).values(
          CASES.map((c, i) => ({
            id: `LEGIARTI9999999999${String(i).padStart(2, '0')}`,
            textId: TEXT_ID,
            textSha256: 'test',
            ...c,
          })),
        )
        const expected = CASES.map((c, i) => [i, isInForce(c, AS_OF)] as const)
          .filter(([, v]) => v)
          .map(([i]) => `LEGIARTI9999999999${String(i).padStart(2, '0')}`)
          .sort()
        for (const predicate of [articleInForce(), articleInForce(AS_OF)]) {
          const rows = await tx
            .select({ id: schema.legalArticle.id })
            .from(schema.legalArticle)
            .where(and(eq(schema.legalArticle.textId, TEXT_ID), predicate))
          expect(rows.map((r) => r.id).sort()).toEqual(expected)
        }
        expect(expected.length).toBe(5)
        tx.rollback()
      })
    } catch (error) {
      if (!(error instanceof Error && error.message.includes('Rollback'))) throw error
    } finally {
      await client.end()
    }
  })
})
