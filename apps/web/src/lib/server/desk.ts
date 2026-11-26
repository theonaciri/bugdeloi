import { randomUUID } from 'node:crypto'
import { sha256Hex } from '@bugdeloi/core/legi'
import { type Db, deskTask, legalArticle, legalText } from '@bugdeloi/db'
import { and, eq, gt, isNull, lte, or, sql } from 'drizzle-orm'
import { currentDeskTask, newDeskTask, newDeskTaskFilter, taskArticle } from './desk-catalog.ts'

type TaskRow = typeof deskTask.$inferSelect
type Assignment = {
  handle: string
  role: TaskRow['role']
  family: NonNullable<TaskRow['leaseFamily']>
}
type ReleaseReason = NonNullable<TaskRow['releaseReason']>

const readWrite = { accessMode: 'read write' } as const
const time = sql`statement_timestamp()`
const heartbeatExpiry = sql`${time} + interval '20 minutes'`

export async function claimTask(db: Db, { handle, role, family }: Assignment) {
  return db.transaction(async (tx) => {
    const [available] = await tx
      .select({ id: deskTask.id })
      .from(deskTask)
      .where(
        and(
          eq(deskTask.role, role),
          currentDeskTask,
          isNull(deskTask.completedAt),
          or(isNull(deskTask.leaseExpiresAt), lte(deskTask.leaseExpiresAt, time)),
        ),
      )
      .orderBy(deskTask.id)
      .limit(1)
      .for('update', { skipLocked: true })
    const lease = randomUUID()
    const reservation = {
      leaseDigest: sha256Hex(lease),
      leaseHandle: handle.toLowerCase(),
      leaseFamily: family,
      leaseStartedAt: time,
      leaseExpiresAt: heartbeatExpiry,
      releaseReason: null,
    }
    const returned = { id: deskTask.id, payload: deskTask.payload, expires_at: deskTask.leaseExpiresAt }

    if (available) {
      const [row] = await tx
        .update(deskTask)
        .set(reservation)
        .where(eq(deskTask.id, available.id))
        .returning(returned)
      if (!row?.expires_at) throw new Error('Échéance du nouveau bail absente')
      return { task: { ...row.payload, id: row.id, role }, lease, expires_at: row.expires_at }
    }
    if (role !== 'analyst' && role !== 'translate') return null

    // Une transaction concurrente peut avoir matérialisé la tâche après le début du SELECT.
    // En cas de conflit, le SELECT suivant voit la ligne et passe à l'article suivant.
    for (;;) {
      const [article] = await tx
        .select(taskArticle)
        .from(legalArticle)
        .innerJoin(legalText, eq(legalText.id, legalArticle.textId))
        .where(newDeskTaskFilter(role))
        .orderBy(legalArticle.id)
        .limit(1)
        .for('update', { of: legalArticle, skipLocked: true })
      if (!article) return null

      const task = newDeskTask(article, role)
      const [row] = await tx
        .insert(deskTask)
        .values({ ...task, ...reservation })
        .onConflictDoNothing()
        .returning(returned)
      if (row?.expires_at)
        return { task: { ...row.payload, id: row.id, role }, lease, expires_at: row.expires_at }
    }
  }, readWrite)
}

export async function updateLease(db: Db, lease: string, reason?: ReleaseReason) {
  return db.transaction(async (tx) => {
    const leaseMatches = eq(deskTask.leaseDigest, sha256Hex(lease))
    const [current] = await tx.select({ id: deskTask.id }).from(deskTask).where(leaseMatches).for('update')
    if (!current) return null

    // L'heure est lue au début de l'UPDATE, après toute attente du verrou.
    const [row] = await tx
      .update(deskTask)
      .set(
        reason
          ? {
              leaseDigest: null,
              leaseExpiresAt: null,
              releaseReason: reason,
              completedAt: reason === 'submitted' ? time : null,
            }
          : {
              leaseExpiresAt: sql`least(${heartbeatExpiry}, ${deskTask.leaseStartedAt} + interval '6 hours')`,
            },
      )
      .where(and(eq(deskTask.id, current.id), gt(deskTask.leaseExpiresAt, time)))
      .returning({ expires_at: deskTask.leaseExpiresAt })
    return row ?? null
  }, readWrite)
}
