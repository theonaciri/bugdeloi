import { expect, test } from 'bun:test'
import { createSql, type Db, event, finding, schema } from '@bugdeloi/db'
import { inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { parseVerdicts, publishFindings, qualifyFindings } from './qualification.ts'

const url =
  process.env.TEST_DATABASE_URL ?? 'postgres://ubuntu@localhost:5432/bugdeloi_test?host=/var/run/postgresql'
const sql = createSql(url, { max: 1, connect_timeout: 2 })
const reachable = await sql`select current_database() as name`.catch(() => null)
await sql.end()
if (reachable && reachable[0]?.name !== 'bugdeloi_test') throw new Error('bugdeloi_test attendue.')

test.skipIf(!reachable)('qualification et publication atomiques sur bugdeloi_test', async () => {
  const client = createSql(url, { max: 1 })
  const database = drizzle(client, { schema })
  const rollback = new Error('annulation des données fictives')
  const [a, b, candidate, withdrawn] = ['F-2099-7010', 'F-2099-7011', 'F-2099-7012', 'F-2099-7013'] as const
  const file = 'qualifications/verdicts/2099-01-01-exemple.yaml'
  const commit = 'a'.repeat(40)
  const verdicts = (...ids: string[]) => ({
    file,
    commit,
    entries: parseVerdicts(
      ids
        .map(
          (id) =>
            `- {id: ${id}, verdict: ${id === b ? 'erreur_nôtre' : 'lacune'}, reviewer: exemple, note: Motif fictif}`,
        )
        .join('\n'),
    ),
  })
  try {
    await expect(
      database.transaction(async (tx) => {
        const db = tx as unknown as Db
        await tx.insert(finding).values(
          [a, b, candidate, withdrawn].map((id) => ({
            id,
            status: id === candidate ? 'candidate' : id === withdrawn ? 'withdrawn' : 'reproduced',
            claim: 'Donnée fictive',
            detector: 'test',
            type: 'SYNTAXE',
            certificate: { independent_reproduction: { verdict: 'confirmé' } },
          })),
        )
        const states = async () =>
          Object.fromEntries(
            (
              await tx
                .select()
                .from(finding)
                .where(inArray(finding.id, [a, b, candidate, withdrawn]))
            ).map((row) => [row.id, row.status]),
          )
        const events = () =>
          tx
            .select()
            .from(event)
            .where(inArray(event.subject, [a, b, candidate, withdrawn]))
        expect(await qualifyFindings(db, verdicts(a), true)).toEqual([
          { id: a, status: 'qualified', changed: true },
        ])
        expect((await states())[a]).toBe('reproduced')
        await expect(qualifyFindings(db, verdicts(a, candidate))).rejects.toThrow("reproduire d'abord")
        await expect(qualifyFindings(db, verdicts(withdrawn))).rejects.toThrow('withdrawn')
        expect((await states())[a]).toBe('reproduced')
        expect(await events()).toHaveLength(0)

        await qualifyFindings(db, verdicts(a, b))
        expect(await states()).toEqual({
          [a]: 'qualified',
          [b]: 'rejected',
          [candidate]: 'candidate',
          [withdrawn]: 'withdrawn',
        })
        const rows = await tx
          .select()
          .from(finding)
          .where(inArray(finding.id, [a, b]))
        expect(rows.find((row) => row.id === b)?.certificate).toEqual({
          independent_reproduction: { verdict: 'confirmé' },
          qualification: {
            verdict: 'erreur_nôtre',
            reviewer: 'exemple',
            note: 'Motif fictif',
            file,
            commit,
            qualified_at: expect.any(String),
          },
        })
        await expect(publishFindings(db, [a, b])).rejects.toThrow('rejected')
        expect((await states())[a]).toBe('qualified')
        await publishFindings(db, [a, a])
        await publishFindings(db, [a])
        expect((await states())[a]).toBe('published')
        expect((await qualifyFindings(db, verdicts(a, b))).every((r) => !r.changed)).toBe(true)
        await expect(qualifyFindings(db, { ...verdicts(a), commit: 'b'.repeat(40) })).rejects.toThrow(
          'published',
        )
        expect(
          (await events())
            .map(({ type, payload }) => ({ type, payload }))
            .sort((x, y) => x.type.localeCompare(y.type)),
        ).toEqual([
          { type: 'finding.published', payload: { id: a, type: 'SYNTAXE', verdict: 'lacune' } },
          { type: 'finding.qualified', payload: { id: a, type: 'SYNTAXE', verdict: 'lacune' } },
          { type: 'finding.rejected', payload: { id: b, type: 'SYNTAXE', verdict: 'erreur_nôtre' } },
        ])
        throw rollback
      }),
    ).rejects.toBe(rollback)
  } finally {
    await client.end()
  }
})
