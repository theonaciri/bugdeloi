import { joinText } from '#lib/join-text.ts'
import { deskUnavailable } from '#lib/server/desk-http.ts'
import { CACHE } from '#lib/server/http.ts'
import type { RequestHandler } from './$types'

/** Instructions en texte brut pour les agents de code. */
export const GET: RequestHandler = ({ url }) =>
  new Response(joinText(url.origin, !deskUnavailable()), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': CACHE.editorial },
  })
