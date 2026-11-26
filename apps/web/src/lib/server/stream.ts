/**
 * Temps réel : un seul `LISTEN bugdeloi_event` pour tout le process, diffusé à tous les
 * clients SSE de /api/stream.
 *
 * - Le trigger Postgres (migration 0001) notifie `{id, type}` à chaque insertion dans `event`.
 * - Les notifications sont coalescées (≤ 1 instantané par seconde) ; l'instantané est calculé
 *   **une fois** puis envoyé à chaque client : la charge base ne dépend pas du nombre de visiteurs.
 * - Battement (commentaire SSE) toutes les 15 s pour que Cloudflare et les proxys gardent la
 *   connexion ouverte.
 * - À la déconnexion d'un client, son minuteur et son abonnement sont retirés.
 */
import { Coalescer, sseComment, sseMessage } from '../coalesce.ts'
import type { Snapshot } from '../snapshot.ts'
import { conn } from './db.ts'
import { snapshot } from './queries.ts'

export const CHANNEL = 'bugdeloi_event'
export const HEARTBEAT_MS = 15_000
export const COALESCE_MS = 1_000

type Send = (chunk: string) => void

interface HubState {
  clients: Set<Send>
  /** Fermeture de chaque flux ouvert (arrêt du serveur). */
  closers: Set<() => void>
  listening: Promise<void> | null
  listenOk: boolean
  /** Le LISTEN a déjà réussi une fois : les appels suivants de `onlisten` sont des reconnexions. */
  everListened: boolean
  coalescer: Coalescer
  lastEventId: number
  notifications: number
  broadcasts: number
}

const g = globalThis as typeof globalThis & { __bugdeloiHub?: HubState }

function hub(): HubState {
  if (!g.__bugdeloiHub) {
    const state: HubState = {
      clients: new Set(),
      closers: new Set(),
      listening: null,
      listenOk: false,
      everListened: false,
      lastEventId: 0,
      notifications: 0,
      broadcasts: 0,
      coalescer: new Coalescer(() => void broadcast(), COALESCE_MS),
    }
    g.__bugdeloiHub = state
  }
  return g.__bugdeloiHub
}

/** Déclenche une diffusion immédiate (coalescée ≤ 1/s) vers tous les clients SSE connectés. */
export function notifyDeskUpdate(): void {
  hub().coalescer.signal()
}

async function broadcast(): Promise<void> {
  const h = hub()
  if (h.clients.size === 0) return
  let snap: Snapshot
  try {
    snap = await snapshot()
  } catch {
    return // base indisponible : les clients gardent le dernier état et le battement continue
  }
  h.broadcasts++
  const msg = sseMessage('snapshot', JSON.stringify(snap), h.lastEventId || undefined)
  for (const send of h.clients) send(msg)
}

function ensureListening(): void {
  const h = hub()
  if (h.listening) return
  h.listening = conn()
    .sql.listen(
      CHANNEL,
      (payload) => {
        h.notifications++
        try {
          const data = JSON.parse(payload) as { id?: unknown }
          if (typeof data.id === 'number' && data.id > h.lastEventId) h.lastEventId = data.id
        } catch {
          // charge utile inattendue : on rafraîchit quand même
        }
        h.coalescer.signal()
      },
      () => {
        // Appelé à chaque (re)connexion du LISTEN. Après une coupure, des événements ont pu être
        // manqués : on rafraîchit les clients. (Pas à la première connexion : chaque client reçoit
        // déjà un instantané à l'ouverture.)
        h.listenOk = true
        if (h.everListened) h.coalescer.signal()
        h.everListened = true
      },
    )
    .then(() => undefined)
    .catch(() => {
      h.listenOk = false
      h.listening = null // nouvel essai à la prochaine connexion d'un client
    })
}

/** Statistiques pour /status. */
export function hubStats() {
  const h = hub()
  return {
    clients: h.clients.size,
    listening: h.listenOk,
    notifications: h.notifications,
    broadcasts: h.broadcasts,
  }
}

/**
 * Ouvre un flux SSE pour un client. Le premier instantané est envoyé tout de suite ; ensuite
 * seulement quand un événement arrive (coalescé) ; un battement toutes les 15 s.
 */
export function openStream(signal: AbortSignal): ReadableStream<Uint8Array> {
  const h = hub()
  const encoder = new TextEncoder()
  let send: Send | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null

  let close: (() => void) | null = null
  const cleanup = () => {
    if (send) h.clients.delete(send)
    if (close) h.closers.delete(close)
    if (heartbeat) clearInterval(heartbeat)
    send = null
    close = null
    heartbeat = null
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      send = (chunk) => {
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          cleanup()
        }
      }
      // `retry` : délai de reconnexion conseillé au navigateur.
      send(`retry: 5000\n${sseComment('bugdeloi')}`)
      h.clients.add(send)
      heartbeat = setInterval(() => send?.(sseComment(`ping ${new Date().toISOString()}`)), HEARTBEAT_MS)
      close = () => {
        cleanup()
        try {
          controller.close()
        } catch {
          // déjà fermé
        }
      }
      h.closers.add(close)
      signal.addEventListener('abort', close)
      ensureListening()
      try {
        const snap = await snapshot()
        send?.(sseMessage('snapshot', JSON.stringify(snap), h.lastEventId || undefined))
      } catch {
        send?.(sseComment('base indisponible'))
      }
    },
    cancel() {
      cleanup()
    },
  })
}

/**
 * Arrêt du serveur (SIGTERM / SIGINT) : on ferme tous les flux SSE tout de suite, sinon
 * `server.close()` d'adapter-node attend leur fin jusqu'à SHUTDOWN_TIMEOUT (30 s). Les navigateurs
 * se reconnecteront à l'instance suivante (`retry: 5000`).
 */
export function closeAllStreams(): void {
  const h = hub()
  h.coalescer.stop()
  for (const close of [...h.closers]) close()
}
