import { CACHE } from '#lib/server/http.ts'
import { rejectedFindings } from '#lib/server/queries.ts'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ setHeaders }) => {
  setHeaders({ 'cache-control': CACHE.data })
  return { findings: await rejectedFindings() }
}
