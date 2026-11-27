import { randomUUID } from 'node:crypto'
import { sha256Hex } from '@bugdeloi/core/legi'
import { type Db, deskTask, event, legalArticle, legalText } from '@bugdeloi/db'
import { and, eq, gt, isNull, lte, or, sql } from 'drizzle-orm'
import { currentDeskTask, newDeskTask, newDeskTaskFilter, taskArticle, taskLabel } from './desk-catalog.ts'
import { catalaPath, frozenInterfaces, sectionTitles } from './interfaces.ts'

type TaskRow = typeof deskTask.$inferSelect
type Assignment = {
  handle: string
  role: TaskRow['role']
  family: NonNullable<TaskRow['leaseFamily']>
}
type BatchAssignment = {
  handle: string
  role?: TaskRow['role']
  family: NonNullable<TaskRow['leaseFamily']>
  limit: number
}
type ReleaseReason = NonNullable<TaskRow['releaseReason']>
export type ClaimedTask = {
  task: TaskRow['payload'] & { id: string; role: TaskRow['role'] }
  lease: string
  expires_at: Date
}

const readWrite = { accessMode: 'read write' } as const
const time = sql`statement_timestamp()`
const heartbeatExpiry = sql`${time} + interval '20 minutes'`

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

/**
 * Journal public (append-only) : chaque réservation et chaque libération devient un événement.
 * C'est la seule mémoire du parcours d'une tâche : la ligne `desk_task` ne garde que le dernier bail.
 * Le battement (`/desk/beat`) n'est pas journalisé.
 */
async function logDeskEvent(
  tx: Tx,
  type: 'desk.claimed' | 'desk.released',
  taskId: string,
  handle: string,
  payload: Record<string, unknown>,
) {
  await tx.insert(event).values({ type, actor: `github:${handle}`, subject: taskId, payload })
}

async function claimOneInTx(tx: Tx, assignment: Assignment): Promise<ClaimedTask | null> {
  const claimed = await reserveInTx(tx, assignment)
  if (claimed) {
    const unit = claimed.task.legal_units[0]
    await logDeskEvent(tx, 'desk.claimed', claimed.task.id, assignment.handle.toLowerCase(), {
      role: assignment.role,
      family: assignment.family,
      legiarti: unit?.legiarti ?? null,
      label: taskLabel(claimed.task),
    })
  }
  return claimed
}

async function reserveInTx(tx: Tx, { handle, role, family }: Assignment): Promise<ClaimedTask | null> {
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

    const spec = role === 'translate' ? frozenInterfaces().get(article.id) : undefined
    const path =
      spec && !spec.path
        ? catalaPath(
            article.textId,
            await sectionTitles(tx, article.sectionId),
            article.articleNumber,
            article.id,
          )
        : undefined
    const task = newDeskTask(article, role, path)
    const [row] = await tx
      .insert(deskTask)
      .values({ ...task, ...reservation })
      .onConflictDoNothing()
      .returning(returned)
    if (row?.expires_at)
      return { task: { ...row.payload, id: row.id, role }, lease, expires_at: row.expires_at }
  }
}

export async function claimTask(db: Db, assignment: Assignment): Promise<ClaimedTask | null> {
  return db.transaction((tx) => claimOneInTx(tx, assignment), readWrite)
}

/**
 * Calcule et attribue à la volée jusqu'à `limit` tâches (défaut 20).
 * Si `role` est omis, attribue d'abord des tâches `analyst`, puis complète avec `translate` s'il n'y en a plus.
 */
export async function claimTasks(
  db: Db,
  { handle, role, family, limit }: BatchAssignment,
): Promise<ClaimedTask[]> {
  return db.transaction(async (tx) => {
    const claimed: ClaimedTask[] = []
    const rolesToTry: TaskRow['role'][] = role ? [role] : ['analyst', 'translate']
    for (const currentRole of rolesToTry) {
      while (claimed.length < limit) {
        const next = await claimOneInTx(tx, { handle, role: currentRole, family })
        if (!next) break
        claimed.push(next)
      }
      if (claimed.length >= limit) break
    }
    return claimed
  }, readWrite)
}

export async function updateLease(db: Db, lease: string, reason?: ReleaseReason) {
  return db.transaction(async (tx) => {
    const leaseMatches = eq(deskTask.leaseDigest, sha256Hex(lease))
    const [current] = await tx
      .select({
        id: deskTask.id,
        role: deskTask.role,
        handle: deskTask.leaseHandle,
        family: deskTask.leaseFamily,
        payload: deskTask.payload,
      })
      .from(deskTask)
      .where(leaseMatches)
      .for('update')
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
    if (row && reason) {
      await logDeskEvent(tx, 'desk.released', current.id, current.handle ?? 'anonymous', {
        role: current.role,
        family: current.family,
        reason,
        legiarti: current.payload.legal_units[0]?.legiarti ?? null,
        label: taskLabel(current.payload),
      })
    }
    return row ?? null
  }, readWrite)
}
