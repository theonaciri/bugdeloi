import { error } from '@sveltejs/kit'
import { CACHE } from '#lib/server/http.ts'
import { taskJourney } from '#lib/server/work.ts'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, setHeaders, url }) => {
  const journey = await taskJourney(params.id)
  if (!journey)
    error(404, 'Tâche inconnue : vérifiez son identifiant (analyst-LEGIARTI… ou translate-LEGIARTI…-vN).')
  setHeaders({ 'cache-control': CACHE.live })
  return { journey, origin: url.origin }
}
