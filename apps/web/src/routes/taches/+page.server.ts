import { CODES } from '@bugdeloi/core/legi'
import { CACHE } from '#lib/server/http.ts'
import { getLevelCounts } from '#lib/server/level-counts.ts'
import { availableByRole, availableTasks, type DeskRole } from '#lib/server/work.ts'
import type { PageServerLoad } from './$types'

const PAGE_SIZE = 40
type CodeKey = keyof typeof CODES

function parseRole(raw: string | null): DeskRole {
  return raw === 'translate' ? 'translate' : 'analyst'
}

function parseCode(raw: string | null): CodeKey | null {
  return raw && Object.hasOwn(CODES, raw) ? (raw as CodeKey) : null
}

/** Numéro d'article : lettres, chiffres, tirets, espaces (« L821-2 », « 278 bis »). */
function parseQuery(raw: string | null): string | null {
  const q = raw?.trim() ?? ''
  return /^[\p{L}\d][\p{L}\d .-]{0,23}$/u.test(q) ? q : null
}

export const load: PageServerLoad = async ({ url, setHeaders }) => {
  setHeaders({ 'cache-control': CACHE.live })
  const role = parseRole(url.searchParams.get('role'))
  const code = parseCode(url.searchParams.get('code'))
  const q = parseQuery(url.searchParams.get('q'))
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)

  const [byRole, list, levels] = await Promise.all([
    availableByRole(),
    availableTasks({ role, code: code ? CODES[code].id : null, q }, page, PAGE_SIZE),
    getLevelCounts(),
  ])

  return {
    role,
    code,
    q,
    page,
    pageSize: PAGE_SIZE,
    total: list.total,
    totalPages: Math.max(1, Math.ceil(list.total / PAGE_SIZE)),
    items: list.items,
    byRole,
    /** Articles au niveau N1 (analysés), pour expliquer une liste de traductions vide. */
    analysed: levels.N1,
    enabled: process.env.DESK_ENABLED === '1',
  }
}
