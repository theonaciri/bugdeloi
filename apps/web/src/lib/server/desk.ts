import { randomUUID } from 'node:crypto'
import { sha256Hex } from '@bugdeloi/core/legi'
import { type Db, deskTask } from '@bugdeloi/db'
import { and, eq, gt, isNull, lte, or, sql } from 'drizzle-orm'

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
      .select({ id: deskTask.id, payload: deskTask.payload })
      .from(deskTask)
      .where(
        and(
          eq(deskTask.role, role),
          isNull(deskTask.completedAt),
          or(isNull(deskTask.leaseExpiresAt), lte(deskTask.leaseExpiresAt, time)),
        ),
      )
      .orderBy(deskTask.id)
      .limit(1)
      .for('update', { skipLocked: true })
    if (!available) return null

    const lease = randomUUID()
    const [row] = await tx
      .update(deskTask)
      .set({
        leaseDigest: sha256Hex(lease),
        leaseHandle: handle.toLowerCase(),
        leaseFamily: family,
        leaseStartedAt: time,
        leaseExpiresAt: heartbeatExpiry,
        releaseReason: null,
      })
      .where(eq(deskTask.id, available.id))
      .returning({ expires_at: deskTask.leaseExpiresAt })

    if (!row?.expires_at) throw new Error('Échéance du nouveau bail absente')
    return { task: { ...available.payload, id: available.id, role }, lease, expires_at: row.expires_at }
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
