import { CACHE } from '#lib/server/http.ts'
import { snapshot } from '#lib/server/queries.ts'
import type { RequestHandler } from './$types'

/** Compteurs publics de l'accueil (même contenu que les messages `snapshot` de /api/stream). */
export const GET: RequestHandler = async () => {
  try {
    return Response.json(await snapshot(), {
      headers: { 'cache-control': CACHE.live, 'access-control-allow-origin': '*' },
    })
  } catch {
    return Response.json(
      { error: 'database_unavailable' },
      { status: 503, headers: { 'cache-control': 'no-store', 'retry-after': '30' } },
    )
  }
}
