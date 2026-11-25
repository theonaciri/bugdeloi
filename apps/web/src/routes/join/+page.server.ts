import { joinCommands } from '#lib/join-text.ts'
import { deskUnavailable } from '#lib/server/desk-http.ts'
import { CACHE } from '#lib/server/http.ts'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = ({ setHeaders, url }) => {
  setHeaders({ 'cache-control': CACHE.editorial })
  return { available: !deskUnavailable(), commands: joinCommands(url.origin) }
}
