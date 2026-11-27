import { CACHE } from '#lib/server/http.ts'
import { getLevelCounts } from '#lib/server/queries.ts'
import type { PageServerLoad } from './$types'

/** Page éditoriale + compteurs par niveau de preuve (cache 60 s) pour les liens vers /travail. */
export const load: PageServerLoad = async ({ setHeaders }) => {
  setHeaders({ 'cache-control': CACHE.data })
  const counts = await getLevelCounts()
  return { counts }
}
