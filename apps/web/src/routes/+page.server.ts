import { CACHE } from '#lib/server/http.ts'
import { snapshot } from '#lib/server/queries.ts'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ setHeaders }) => {
  try {
    const snap = await snapshot()
    setHeaders({ 'cache-control': CACHE.live })
    return { snapshot: snap, dbError: false }
  } catch (e) {
    console.error('[accueil] base injoignable', e)
    setHeaders({ 'cache-control': 'no-store' })
    return { snapshot: null, dbError: true }
  }
}
