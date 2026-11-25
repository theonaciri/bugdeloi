import { CACHE } from '#lib/server/http.ts'
import { health } from '#lib/server/queries.ts'
import { hubStats } from '#lib/server/stream.ts'
import type { RequestHandler } from './$types'

/** Santé du service, lisible par une machine. 503 si la base est injoignable. */
export const GET: RequestHandler = async () => {
  const h = await health()
  return Response.json(
    { ok: h.database.ok, generatedAt: new Date().toISOString(), ...h, stream: hubStats() },
    {
      status: h.database.ok ? 200 : 503,
      headers: { 'cache-control': h.database.ok ? CACHE.live : 'no-store' },
    },
  )
}
