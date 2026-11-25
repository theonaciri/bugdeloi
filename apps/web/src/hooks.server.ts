import type { Handle, HandleServerError } from '@sveltejs/kit/hooks'
import { closeDb } from '#lib/server/db.ts'
import { guardDesk } from '#lib/server/desk-http.ts'
import { CACHE, SECURITY_HEADERS } from '#lib/server/http.ts'
import { closeAllStreams } from '#lib/server/stream.ts'
import { dev } from '$app/env'

/**
 * Arrêt propre en production (adapter-node) : flux SSE fermés dès le signal, puis connexions
 * Postgres (dont le LISTEN) fermées quand le serveur HTTP a fini — sinon le process ne s'arrête
 * jamais et systemd doit le tuer. Pas en dev : Vite gère ses propres signaux.
 */
if (!dev) {
  const proc = process as NodeJS.EventEmitter
  proc.once('SIGTERM', closeAllStreams)
  proc.once('SIGINT', closeAllStreams)
  proc.once('sveltekit:shutdown', () => {
    void closeDb()
  })
}

/**
 * - En-têtes de sécurité sur toutes les réponses (la CSP est posée par SvelteKit, voir vite.config.ts).
 * - `Cache-Control` explicite partout : une route qui n'en fixe pas reçoit une valeur selon son
 *   statut (jamais de mise en cache d'une erreur serveur par Cloudflare).
 */
export const handle: Handle = async ({ event, resolve }) => {
  const isDesk = event.url.pathname.startsWith('/desk/') || event.url.pathname === '/desk'
  const deskResponse = isDesk ? guardDesk(event.getClientAddress) : null
  let response = deskResponse ?? (await resolve(event))
  try {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) response.headers.set(k, v)
  } catch {
    // En-têtes immuables : on recopie la réponse.
    response = new Response(response.body, response)
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) response.headers.set(k, v)
  }
  if (isDesk) {
    response.headers.set('cache-control', CACHE.none)
  } else if (!response.headers.has('cache-control')) {
    const s = response.status
    response.headers.set(
      'cache-control',
      s >= 500 ? CACHE.none : s === 404 || s === 410 ? CACHE.notFound : s >= 400 ? CACHE.none : CACHE.data,
    )
  }
  return response
}

/** Erreurs inattendues : journalisées côté serveur, message générique côté public. */
export const handleError: HandleServerError = ({ kind, error }) => {
  if (kind === 'unknown') {
    console.error('[bugdeloi-web]', error)
    return { message: 'Erreur du serveur' }
  }
  if (kind === 'framework' && error.status === 404) return { message: 'Page introuvable' }
}
