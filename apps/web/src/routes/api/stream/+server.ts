import { CACHE } from '#lib/server/http.ts'
import { openStream } from '#lib/server/stream.ts'
import type { RequestHandler } from './$types'

/**
 * Flux SSE public : un message `snapshot` à l'ouverture puis à chaque nouvel événement
 * (coalescé, ≤ 1/s), un commentaire de battement toutes les 15 s.
 */
export const GET: RequestHandler = ({ request }) =>
  new Response(openStream(request.signal), {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': CACHE.stream,
      connection: 'keep-alive',
      // Désactive la mise en tampon des proxys de type nginx ; Cloudflare respecte `no-transform`.
      'x-accel-buffering': 'no',
    },
  })
