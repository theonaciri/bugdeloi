import { deskTask } from '@bugdeloi/db'
import { error } from '@sveltejs/kit'
import { count, sql } from 'drizzle-orm'
import { isLegiarti } from '#lib/ids.ts'
import { db } from '#lib/server/db.ts'
import { CACHE } from '#lib/server/http.ts'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, setHeaders }) => {
  if (!/^[a-zA-Z0-9-]{1,39}$/.test(params.handle)) error(404, 'Profil introuvable')

  const handle = params.handle.toLowerCase()
  const matchesHandle = sql`lower(${deskTask.leaseHandle}) = ${handle}`
  const active = sql<boolean>`(${deskTask.completedAt} is null and coalesce(${deskTask.leaseExpiresAt} > transaction_timestamp(), false))`
  const [byFamily, recent] = await db().transaction(
    (tx) =>
      Promise.all([
        tx
          .select({
            family: deskTask.leaseFamily,
            total: count(),
            completed: count(deskTask.completedAt),
            active: sql<number>`count(*) filter (where ${active})`.mapWith(Number),
          })
          .from(deskTask)
          .where(matchesHandle)
          .groupBy(deskTask.leaseFamily),
        tx
          .select({
            id: deskTask.id,
            role: deskTask.role,
            node: sql<string | null>`${deskTask.payload}->>'node'`,
            legiarti: sql<string | null>`${deskTask.payload}->'legal_units'->0->>'legiarti'`,
            startedAt: deskTask.leaseStartedAt,
            completedAt: deskTask.completedAt,
            active,
          })
          .from(deskTask)
          .where(matchesHandle)
          .orderBy(sql`${deskTask.leaseStartedAt} desc nulls last`, deskTask.id)
          .limit(50),
      ]),
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )

  const counts = { total: 0, completed: 0, active: 0 }
  const families: string[] = []
  for (const row of byFamily) {
    counts.total += row.total
    counts.completed += row.completed
    counts.active += row.active
    if (row.family) families.push(row.family)
  }

  setHeaders({ 'cache-control': CACHE.live })
  return {
    handle,
    counts,
    families: families.sort(),
    tasks: recent.map(({ id, role, node, legiarti, startedAt, completedAt, active }) => ({
      id,
      role,
      node,
      legiarti: legiarti && isLegiarti(legiarti) ? legiarti : null,
      startedAt: startedAt?.toISOString() ?? null,
      status: completedAt ? 'Déposée' : active ? 'En cours' : 'Libérée',
    })),
  }
}
