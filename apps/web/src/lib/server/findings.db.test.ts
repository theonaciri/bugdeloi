import { expect, test } from 'bun:test'
import { createSql, type Db, finding, schema } from '@bugdeloi/db'
import { drizzle } from 'drizzle-orm/postgres-js'
import { findingDetail, publicFindings, rejectedFindings } from './queries.ts'

const url =
  process.env.TEST_DATABASE_URL ?? 'postgres://ubuntu@localhost:5432/bugdeloi_test?host=/var/run/postgresql'
const sql = createSql(url, { max: 1, connect_timeout: 2 })
const reachable = await sql`select current_database() as name`.catch(() => null)
await sql.end()
if (reachable && reachable[0]?.name !== 'bugdeloi_test') throw new Error('bugdeloi_test attendue.')

test.skipIf(!reachable)('requêtes publiques et cimetière sur bugdeloi_test', async () => {
  const client = createSql(url, { max: 1 })
  const database = drizzle(client, { schema })
  const rollback = new Error('annulation des données fictives')
  const qualification = {
    reviewer: 'exemple',
    note: 'Motif fictif',
    file: 'qualifications/verdicts/2099-01-01-exemple.yaml',
    commit: 'a'.repeat(40),
    qualified_at: '2099-01-01T10:00:00.000Z',
  }
  const positive = { ...qualification, verdict: 'lacune' }
  const negative = { ...qualification, verdict: 'choix_assumé' }
  const fixtures = [
    { id: 'F-2099-7020', status: 'candidate', qualification: negative },
    { id: 'F-2099-7021', status: 'reproduced', qualification: positive },
    { id: 'F-2099-7022', status: 'withdrawn', qualification: negative },
    { id: 'F-2099-7023', status: 'rejected' },
    { id: 'F-2099-7024', status: 'rejected', qualification: { verdict: 'choix_assumé' } },
    { id: 'F-2099-7025', status: 'rejected', qualification: positive },
    { id: 'F-2099-7026', status: 'qualified', qualification: positive },
    { id: 'F-2099-7027', status: 'published', qualification: positive },
    { id: 'F-2099-7028', status: 'rejected', qualification: negative },
  ]
  try {
    await expect(
      database.transaction(async (tx) => {
        const db = tx as unknown as Db
        await tx.insert(finding).values(
          fixtures.map(({ id, status, qualification }) => ({
            id,
            status,
            claim: 'Donnée fictive',
            detector: 'test',
            type: 'REF_MORTE',
            legalUnits: ['LEGIARTI999999999801@2020-01-01'],
            certificate: {
              qualification,
              proof: {
                text_mentions: {
                  first: { excerpt: 'avant L. 1 après', cited: 'L. 1', start: 106, excerpt_offset: 100 },
                },
              },
            },
          })),
        )
        const ids = new Set(fixtures.map(({ id }) => id))
        expect((await publicFindings(db)).map(({ id }) => id).filter((id) => ids.has(id))).toEqual([
          'F-2099-7026',
          'F-2099-7027',
        ])
        expect(
          (await rejectedFindings(db))
            .filter(({ id }) => ids.has(id))
            .map(({ id, qualification }) => [id, qualification.note]),
        ).toEqual([['F-2099-7028', 'Motif fictif']])
        for (const { id } of fixtures.slice(0, 6)) expect(await findingDetail(id, db)).toBeNull()
        for (const { id } of fixtures.slice(6)) expect((await findingDetail(id, db))?.id).toBe(id)
        expect(await findingDetail('id-invalide', db)).toBeNull()
        const detail = await findingDetail('F-2099-7026', db)
        expect(detail?.articles[0]?.url).toContain('https://www.legifrance.gouv.fr/')
        expect(detail?.excerpts).toEqual([{ before: 'avant ', marked: 'L. 1', after: ' après' }])
        throw rollback
      }),
    ).rejects.toBe(rollback)
  } finally {
    await client.end()
  }
})
