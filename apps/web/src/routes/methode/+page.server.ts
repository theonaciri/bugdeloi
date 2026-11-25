import { CACHE } from '#lib/server/http.ts'
import type { PageServerLoad } from './$types'

/** Page éditoriale : aucune donnée, seulement l'en-tête de cache. */
export const load: PageServerLoad = ({ setHeaders }) => {
  setHeaders({ 'cache-control': CACHE.editorial })
}
