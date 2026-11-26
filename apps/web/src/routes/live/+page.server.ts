import { CACHE } from '#lib/server/http.ts'
import { snapshot } from '#lib/server/queries.ts'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ setHeaders }) => {
  setHeaders({ 'cache-control': CACHE.live })
  return { snapshot: await snapshot() }
}
