import { getAnalysesSummary } from '#lib/server/analyses.ts'
import { CACHE } from '#lib/server/http.ts'
import { getLevelCounts } from '#lib/server/queries.ts'
import type { PageServerLoad } from './$types'

/** Page éditoriale + compteurs par niveau de preuve (cache 60 s) et analyses pré-N1. */
export const load: PageServerLoad = async ({ setHeaders }) => {
  setHeaders({ 'cache-control': CACHE.data })
  const counts = await getLevelCounts()
  const a = getAnalysesSummary()
  return {
    counts,
    analyses: { total: a.total, byCategory: a.byCategory },
  }
}
