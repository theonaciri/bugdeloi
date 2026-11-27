import { deskTask } from '@bugdeloi/db'
import { and, asc, count, desc, eq, gt, isNotNull, isNull, or } from 'drizzle-orm'
import { db } from '#lib/server/db.ts'
import { CACHE } from '#lib/server/http.ts'
import { getLevelCounts } from '#lib/server/queries.ts'
import type { PageServerLoad } from './$types'

const PAGE_SIZE = 100
type TaskStateFilter = 'all' | 'leased' | 'completed'
const DESK_ROLES = [
  'analyst',
  'translate',
  'oracle',
  'redteam',
  'backtranslate',
  'judge',
  'doctrine',
  'reduce',
] as const
type DeskRole = (typeof DESK_ROLES)[number]

function parseState(raw: string | null): TaskStateFilter {
  if (raw === 'leased' || raw === 'completed') return raw
  return 'all'
}

function parseRole(raw: string | null): DeskRole | 'all' {
  if (raw && (DESK_ROLES as readonly string[]).includes(raw)) return raw as DeskRole
  return 'all'
}

export const load: PageServerLoad = async ({ url, setHeaders }) => {
  setHeaders({ 'cache-control': CACHE.data })

  const etat = parseState(url.searchParams.get('etat'))
  const role = parseRole(url.searchParams.get('role'))
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE
  const now = new Date()

  // Réserve vivante calculée à la volée (N0 restants à analyser, N1 restants à traduire)
  const levelCounts = await getLevelCounts()

  // On ne compte que les tâches actives (en cours) ou soumises — les baux expirés ne sont plus une file séparée
  const activeOrCompleted = or(
    isNotNull(deskTask.completedAt),
    and(isNull(deskTask.completedAt), gt(deskTask.leaseExpiresAt, now)),
  )

  const stateRows = await db()
    .select({
      role: deskTask.role,
      completed: isNotNull(deskTask.completedAt),
      total: count(),
    })
    .from(deskTask)
    .where(activeOrCompleted)
    .groupBy(deskTask.role, isNotNull(deskTask.completedAt))

  const stateCounts: Record<TaskStateFilter, number> = { all: 0, leased: 0, completed: 0 }
  const roleCounts = new Map<string, number>()

  for (const row of stateRows) {
    const n = Number(row.total)
    const st: 'leased' | 'completed' = row.completed ? 'completed' : 'leased'
    if (role === 'all' || row.role === role) {
      stateCounts[st] += n
      stateCounts.all += n
    }
    if (etat === 'all' || etat === st) {
      roleCounts.set(row.role, (roleCounts.get(row.role) ?? 0) + n)
    }
  }

  const conditions = [activeOrCompleted]
  if (role !== 'all') {
    conditions.push(eq(deskTask.role, role))
  }
  if (etat === 'completed') {
    conditions.push(isNotNull(deskTask.completedAt))
  } else if (etat === 'leased') {
    conditions.push(and(isNull(deskTask.completedAt), gt(deskTask.leaseExpiresAt, now)))
  }

  const rows = await db()
    .select({
      id: deskTask.id,
      role: deskTask.role,
      payload: deskTask.payload,
      leaseHandle: deskTask.leaseHandle,
      leaseFamily: deskTask.leaseFamily,
      leaseStartedAt: deskTask.leaseStartedAt,
      leaseExpiresAt: deskTask.leaseExpiresAt,
      releaseReason: deskTask.releaseReason,
      completedAt: deskTask.completedAt,
    })
    .from(deskTask)
    .where(and(...conditions))
    .orderBy(desc(deskTask.completedAt), desc(deskTask.leaseStartedAt), asc(deskTask.id))
    .limit(PAGE_SIZE)
    .offset(offset)

  const items = rows.map((r) => {
    const p = r.payload && typeof r.payload === 'object' ? (r.payload as Record<string, unknown>) : null
    const rawUnits = Array.isArray(p?.legal_units) ? p.legal_units : []
    const firstUnit = typeof rawUnits[0] === 'string' ? rawUnits[0] : null
    const legiarti = firstUnit ? (/LEGIARTI\d{12}/.exec(firstUnit)?.[0] ?? null) : null
    const node = typeof p?.node === 'string' ? p.node : null
    const state: 'leased' | 'completed' = r.completedAt ? 'completed' : 'leased'
    return {
      id: r.id,
      role: r.role,
      state,
      node,
      legiarti,
      leaseHandle: r.leaseHandle,
      leaseFamily: r.leaseFamily,
      leaseExpiresAt: r.leaseExpiresAt ? r.leaseExpiresAt.toISOString() : null,
      releaseReason: r.releaseReason,
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    }
  })

  const totalMatching = stateCounts[etat]
  const roles = [...roleCounts.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    etat,
    role,
    page,
    totalMatching,
    totalPages: Math.max(1, Math.ceil(totalMatching / PAGE_SIZE)),
    stateCounts,
    roles,
    items,
    pool: {
      analystRemaining: levelCounts.N0,
      translateRemaining: levelCounts.N1,
    },
  }
}
