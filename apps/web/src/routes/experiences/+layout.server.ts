import { CACHE } from '#lib/server/http.ts'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = ({ setHeaders }) => {
  setHeaders({ 'cache-control': CACHE.editorial })
}
