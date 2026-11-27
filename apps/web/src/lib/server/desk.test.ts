import { describe, expect, test } from 'bun:test'
import { sha256Hex } from '@bugdeloi/core/legi'
import {
  createSql,
  type DeskTaskPayload,
  deskTask,
  event,
  legalArticle,
  legalText,
  schema,
} from '@bugdeloi/db'
import { eq, inArray, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { claimTask, updateLease } from './desk.ts'
import { createDeskRateLimiter } from './desk-http.ts'
import { deskInput, parseDeskInput, parseDeskNextInput } from './desk-input.ts'

const leaseId = '78dd2fef-c09b-4fd6-9d8c-ad2b495347fb'

describe('schémas du desk', () => {
  test('valide le pseudo, le rôle et la famille', () => {
    const params = (query: string) => parseDeskInput(new URLSearchParams(query), deskInput.next)
    expect(params('handle=Git-Hub&role=analyst&family=humain')).toEqual({
      handle: 'Git-Hub',
      role: 'analyst',
      family: 'humain',
    })
    for (const invalid of [
      'handle=a_b&role=analyst&family=openai',
      'handle=-user&role=analyst&family=openai',
      'handle=alice--bob&role=analyst&family=openai',
      `handle=${'x'.repeat(40)}&role=analyst&family=openai`,
      'handle=a&role=other&family=openai',
      'handle=a&role=analyst&family=unknown',
      'handle=a&role=analyst',
      'handle=a&role=analyst&family=openai&extra=1',
      'handle=a&handle=b&role=analyst',
    ]) {
      expect(params(invalid)).toBeNull()
    }
  })

  test('valide le bail et le motif', () => {
    const beat = (query: string) => parseDeskInput(new URLSearchParams(query), deskInput.beat)
    const release = (query: string) => parseDeskInput(new URLSearchParams(query), deskInput.release)
    expect(beat(`lease=${leaseId}`)).toEqual({ lease: leaseId })
    expect(beat('lease=01234')).toBeNull()
    expect(beat('lease=')).toBeNull()
    expect(release(`lease=${leaseId}&reason=text_mismatch`)).toEqual({
      lease: leaseId,
      reason: 'text_mismatch',
    })
    expect(release(`lease=${leaseId}`)).toBeNull()
    expect(release(`lease=${leaseId}&reason=finished`)).toBeNull()
    expect(release(`lease=${leaseId}&reason=other&reason=submitted`)).toBeNull()
  })

  test('parseDeskNextInput applique les valeurs par défaut (limit=20, role omis) et valide les bornes', () => {
    expect(parseDeskNextInput(new URLSearchParams(''))).toEqual({
      handle: 'anonymous',
      role: undefined,
      family: 'local-autre',
      limit: 20,
    })
    expect(
      parseDeskNextInput(new URLSearchParams('limit=5&role=translate&handle=alice&family=openai')),
    ).toEqual({
      handle: 'alice',
      role: 'translate',
      family: 'openai',
      limit: 5,
    })
    for (const invalid of ['limit=0', 'limit=101', 'limit=abc', 'role=unknown', 'extra=1']) {
      expect(parseDeskNextInput(new URLSearchParams(invalid))).toBeNull()
    }
  })
})

test('débit indépendant par IP, avec délai de reprise', () => {
  const limit = createDeskRateLimiter()
  for (let i = 0; i < 30; i++) expect(limit('192.0.2.1', 0)).toBeNull()
  const rejected = limit('192.0.2.1', 1000)
  expect(rejected?.status).toBe(429)
  expect(rejected?.headers.get('retry-after')).toBe('59')
  expect(limit('192.0.2.2', 1000)).toBeNull()
  expect(limit('192.0.2.1', 60_000)).toBeNull()
})

const configuredUrl = process.env.TEST_DATABASE_URL
const url = configuredUrl ?? 'postgres://ubuntu@localhost:5432/bugdeloi_test?host=/var/run/postgresql'
const probe = createSql(url, { max: 1, connect_timeout: 2 })
const reachable = await probe`select current_database() as name`
  .catch((cause) => {
    if (configuredUrl) throw cause
    return null
  })
  .finally(() => probe.end())
if (reachable && reachable[0]?.name !== 'bugdeloi_test') throw new Error('bugdeloi_test attendue.')

test.skipIf(!reachable)(
  'attribution concurrente, renouvellement, expiration et clôture sur Postgres',
  async () => {
    const client = createSql(url, {
      connection: { default_transaction_read_only: true },
    })
    const database = drizzle(client, { schema })
    const id = `test-desk-${crypto.randomUUID()}`
    const payload: DeskTaskPayload = {
      node: 'test',
      legal_units: [],
      interface: null,
      context_pack: { objective: 'Donnée de test', code_title: '', article_number: null },
      blind_to: [],
      allowed_paths: [],
    }
    const assignment = { handle: 'Alice', role: 'reduce', family: 'openai' } as const
    const fixture = eq(deskTask.id, id)
    async function setTime(startMinutesAgo: number, expiresInMinutes: number) {
      await database.transaction(
        (tx) =>
          tx
            .update(deskTask)
            .set({
              leaseStartedAt: sql`statement_timestamp() - make_interval(mins => ${startMinutesAgo})`,
              leaseExpiresAt: sql`statement_timestamp() + make_interval(mins => ${expiresInMinutes})`,
            })
            .where(fixture),
        { accessMode: 'read write' },
      )
    }
    try {
      await database.transaction((tx) => tx.insert(deskTask).values({ id, role: assignment.role, payload }), {
        accessMode: 'read write',
      })

      const claims = await Promise.all(
        ['Alice', 'Bob', 'Chloe', 'Diane'].map((handle) => claimTask(database, { ...assignment, handle })),
      )
      const claimsWon = claims.filter((claim) => claim !== null)
      expect(claimsWon).toHaveLength(1)
      const [claim] = claimsWon
      if (!claim) throw new Error('Bail de test absent')
      expect(claim.task.id).toBe(id)
      expect(claim.expires_at.getTime() - Date.now()).toBeCloseTo(20 * 60_000, -4)
      const [row] = await database.select().from(deskTask).where(fixture)
      expect(row?.leaseDigest).toMatch(/^[a-f0-9]{64}$/)
      expect(row?.leaseDigest).not.toBe(claim.lease)
      expect(row?.leaseHandle).toMatch(/^(alice|bob|chloe|diane)$/)

      await setTime(10, 10)
      const renewed = await updateLease(database, claim.lease)
      expect((renewed?.expires_at?.getTime() ?? 0) - Date.now()).toBeCloseTo(20 * 60_000, -4)

      await setTime(350, 5)
      const capped = await updateLease(database, claim.lease)
      const [end] = await database.select({ start: deskTask.leaseStartedAt }).from(deskTask).where(fixture)
      expect(capped?.expires_at?.getTime()).toBe((end?.start?.getTime() ?? 0) + 6 * 60 * 60_000)

      await setTime(361, -1)
      expect(await updateLease(database, claim.lease)).toBeNull()
      expect(await updateLease(database, claim.lease, 'submitted')).toBeNull()
      const retry = await claimTask(database, assignment)
      if (!retry) throw new Error('Tâche expirée indisponible')
      expect(retry.task.id).toBe(id)
      expect(retry.lease).not.toBe(claim.lease)
      expect(await updateLease(database, claim.lease)).toBeNull()

      expect(await updateLease(database, retry.lease, 'other')).toEqual({ expires_at: null })
      const final = await claimTask(database, assignment)
      if (!final) throw new Error('Tâche libérée indisponible')
      expect(await updateLease(database, final.lease, 'submitted')).toEqual({ expires_at: null })
      expect(await updateLease(database, final.lease)).toBeNull()
      expect(await claimTask(database, assignment)).toBeNull()

      // Journal : trois réservations, une libération « other » puis un dépôt ; jamais le battement.
      const logged = await database
        .select({ type: event.type, actor: event.actor, payload: event.payload })
        .from(event)
        .where(eq(event.subject, id))
        .orderBy(event.id)
      expect(logged.map((e) => e.type)).toEqual([
        'desk.claimed',
        'desk.claimed',
        'desk.released',
        'desk.claimed',
        'desk.released',
      ])
      expect(logged.filter((e) => e.type === 'desk.released').map((e) => e.payload.reason)).toEqual([
        'other',
        'submitted',
      ])
      expect(logged.every((e) => /^github:(alice|bob|chloe|diane)$/.test(e.actor))).toBe(true)
    } finally {
      try {
        await database.transaction(
          async (tx) => {
            await tx.delete(event).where(eq(event.subject, id))
            await tx.delete(deskTask).where(fixture)
          },
          { accessMode: 'read write' },
        )
      } finally {
        await client.end()
      }
    }
  },
)

test.skipIf(!reachable)(
  'matérialise des analyses distinctes sous 300 demandes concurrentes',
  async () => {
    const client = createSql(url, { max: 8, connection: { default_transaction_read_only: true } })
    const database = drizzle(client, { schema })
    const textId = 'LEGITEXT999000000001'
    const contentText = 'Disposition fictive pour le test du guichet.'
    const ids = Array.from({ length: 300 }, (_, index) => `LEGIARTI999${String(index).padStart(9, '0')}`)
    const assignment = { role: 'analyst', family: 'openai' } as const
    try {
      await database.transaction(
        async (tx) => {
          await tx.insert(legalText).values({ id: textId, title: 'Code fictif' })
          await tx.insert(legalArticle).values(
            ids.map((id, index) => ({
              id,
              textId,
              num: String(index + 1),
              sectionId: 'LEGISCTA999000000001',
              etat: 'VIGUEUR',
              type: 'AUTONOME',
              dateDebut: '2000-01-01',
              contentText,
              textSha256: sha256Hex(contentText),
              // Le premier article a une autre version : la tâche doit la lister.
              versionIds: index === 0 ? [id, ids[1] as string] : [],
            })),
          )
        },
        { accessMode: 'read write' },
      )

      const claims = await Promise.all(
        ids.map((_, index) => claimTask(database, { ...assignment, handle: `agent-${index}` })),
      )
      expect(claims.every((claim) => claim !== null)).toBe(true)
      expect(new Set(claims.map((claim) => claim?.task.id)).size).toBe(ids.length)
      expect(await claimTask(database, { ...assignment, handle: 'extra' })).toBeNull()
      const withVersion = claims.find((claim) => claim?.task.node === ids[0])
      expect(withVersion?.task.context_pack.other_versions?.map((v) => v.legiarti)).toEqual([
        ids[1] as string,
      ])
      expect(claims.find((claim) => claim?.task.node === ids[2])?.task.context_pack.other_versions).toEqual(
        [],
      )

      const first = claims[0]
      if (!first) throw new Error('Bail de test absent')
      const articleId = first.task.node
      await database.transaction(
        (tx) => tx.update(legalArticle).set({ dateFin: '2001-01-01' }).where(eq(legalArticle.id, articleId)),
        { accessMode: 'read write' },
      )
      expect(await updateLease(database, first.lease, 'other')).toEqual({ expires_at: null })
      expect(await claimTask(database, { ...assignment, handle: 'extra' })).toBeNull()
    } finally {
      try {
        await database.transaction(
          async (tx) => {
            const taskIds = ids.map((id) => `analyst-${id}`)
            await tx.delete(event).where(inArray(event.subject, taskIds))
            await tx.delete(deskTask).where(inArray(deskTask.id, taskIds))
            await tx.delete(legalArticle).where(eq(legalArticle.textId, textId))
            await tx.delete(legalText).where(eq(legalText.id, textId))
          },
          { accessMode: 'read write' },
        )
      } finally {
        await client.end()
      }
    }
  },
  20_000,
)
