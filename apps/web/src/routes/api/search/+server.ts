import { CACHE } from '#lib/server/http.ts'
import { isCodeKey, isSearchQuery, SEARCH_LIMIT_MAX, searchCatalog } from '#lib/server/queries.ts'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ url }) => {
  const params = url.searchParams
  const query = params.get('q')
  const code = params.get('code')
  const limit = params.get('limit') ?? '10'
  const keys = new Set(params.keys())
  if (
    keys.size !== params.size ||
    [...keys].some((key) => !['q', 'code', 'limit'].includes(key)) ||
    !isSearchQuery(query) ||
    (code !== null && !isCodeKey(code)) ||
    !/^[1-9]\d?$/u.test(limit) ||
    Number(limit) > SEARCH_LIMIT_MAX
  ) {
    return Response.json(
      { error: 'invalid_parameters' },
      { status: 400, headers: { 'cache-control': CACHE.none } },
    )
  }

  return Response.json(await searchCatalog(query, { code: code ?? undefined, limit: Number(limit) }), {
    headers: { 'cache-control': 'public, s-maxage=30, stale-while-revalidate=60' },
  })
}
