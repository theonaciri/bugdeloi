import { deskTask } from '@bugdeloi/db'
import { and, asc, count, desc, eq, gt, isNotNull, isNull, lte, or, sql } from 'drizzle-orm'
import { db } from '#lib/server/db.ts'
import { CACHE } from '#lib/server/http.ts'
import type { PageServerLoad } from './$types'

const PAGE_SIZE = 100
type TaskStateFilter = 'all' | 'open' | 'leased' | 'completed'
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
  if (raw === 'open' || raw === 'leased' || raw === 'completed') return raw
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

  // Compteurs globaux par état et par rôle
  const stateRows = await db()
    .select({
      role: deskTask.role,
      state: sql<string>`case
        when ${deskTask.completedAt} is not null then 'completed'
        when ${deskTask.leaseExpiresAt} is not null and ${deskTask.leaseExpiresAt} > now() then 'leased'
        else 'open'
      end`,
      total: count(),
    })
    .from(deskTask)
    .groupBy(
      deskTask.role,
      sql`case
        when ${deskTask.completedAt} is not null then 'completed'
        when ${deskTask.leaseExpiresAt} is not null and ${deskTask.leaseExpiresAt} > now() then 'leased'
        else 'open'
      end`,
    )

  const stateCounts: Record<TaskStateFilter, number> = { all: 0, open: 0, leased: 0, completed: 0 }
  const roleCounts = new Map<string, number>()

  for (const row of stateRows) {
    const n = Number(row.total)
    const st = row.state as 'open' | 'leased' | 'completed'
    if (role === 'all' || row.role === role) {
      stateCounts[st] += n
      stateCounts.all += n
    }
    if (etat === 'all' || etat === st) {
      roleCounts.set(row.role, (roleCounts.get(row.role) ?? 0) + n)
    }
  }

  const conditions = []
  if (role !== 'all') {
    conditions.push(eq(deskTask.role, role))
  }
  if (etat === 'completed') {
    conditions.push(isNotNull(deskTask.completedAt))
  } else if (etat === 'leased') {
    conditions.push(and(isNull(deskTask.completedAt), gt(deskTask.leaseExpiresAt, now)))
  } else if (etat === 'open') {
    conditions.push(
      and(
        isNull(deskTask.completedAt),
        or(isNull(deskTask.leaseExpiresAt), lte(deskTask.leaseExpiresAt, now)),
      ),
    )
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
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(deskTask.completedAt), desc(deskTask.leaseStartedAt), asc(deskTask.id))
    .limit(PAGE_SIZE)
    .offset(offset)

  const items = rows.map((r) => {
    const p = r.payload && typeof r.payload === 'object' ? (r.payload as Record<string, unknown>) : null
    const rawUnits = Array.isArray(p?.legal_units) ? p.legal_units : []
    const firstUnit = typeof rawUnits[0] === 'string' ? rawUnits[0] : null
    const legiarti = firstUnit ? (/LEGIARTI\d{12}/.exec(firstUnit)?.[0] ?? null) : null
    const node = typeof p?.node === 'string' ? p.node : null
    const state: 'open' | 'leased' | 'completed' = r.completedAt
      ? 'completed'
      : r.leaseExpiresAt && r.leaseExpiresAt > now
        ? 'leased'
        : 'open'
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
  }
}
