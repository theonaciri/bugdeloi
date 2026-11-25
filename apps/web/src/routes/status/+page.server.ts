import { CACHE } from '#lib/server/http.ts'
import { health, latestEvents } from '#lib/server/queries.ts'
import { hubStats } from '#lib/server/stream.ts'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ setHeaders }) => {
  const h = await health()
  setHeaders({ 'cache-control': h.database.ok ? CACHE.live : 'no-store' })
  return {
    health: h,
    events: h.database.ok ? await latestEvents() : [],
    stream: hubStats(),
    generatedAt: new Date().toISOString(),
  }
}
