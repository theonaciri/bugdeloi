import { joinText } from '#lib/join-text.ts'
import { CACHE } from '#lib/server/http.ts'
import type { RequestHandler } from './$types'

/** Instructions en texte brut pour les agents de code (brouillon, jalon J3). */
export const GET: RequestHandler = ({ url }) =>
  new Response(joinText(url.origin), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': CACHE.editorial },
  })
