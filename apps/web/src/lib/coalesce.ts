/**
 * Coalescence : transforme une rafale de signaux (NOTIFY Postgres) en au plus un appel par
 * intervalle. Le premier signal après une période calme part immédiatement (latence minimale) ;
 * les suivants sont fusionnés en un seul appel à la fin de l'intervalle (aucun signal perdu).
 *
 * L'horloge et les minuteries sont injectables pour les tests.
 */

export interface Clock {
  now(): number
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
}

export class Coalescer {
  #last = Number.NEGATIVE_INFINITY
  #timer: unknown = null
  #pending = 0
  #stopped = false
  readonly #flush: (signals: number) => void
  readonly #intervalMs: number
  readonly #clock: Clock

  constructor(flush: (signals: number) => void, intervalMs = 1000, clock: Clock = systemClock) {
    this.#flush = flush
    this.#intervalMs = intervalMs
    this.#clock = clock
  }

  /** Signale un changement. Retourne immédiatement. */
  signal(): void {
    if (this.#stopped) return
    this.#pending++
    if (this.#timer !== null) return
    const wait = this.#last + this.#intervalMs - this.#clock.now()
    if (wait <= 0) this.#fire()
    else this.#timer = this.#clock.setTimeout(() => this.#fire(), wait)
  }

  #fire(): void {
    this.#timer = null
    if (this.#stopped || this.#pending === 0) return
    const n = this.#pending
    this.#pending = 0
    this.#last = this.#clock.now()
    this.#flush(n)
  }

  get pending(): number {
    return this.#pending
  }

  stop(): void {
    this.#stopped = true
    if (this.#timer !== null) this.#clock.clearTimeout(this.#timer)
    this.#timer = null
    this.#pending = 0
  }
}

/** Encode un message SSE (une ligne `data:` par ligne de contenu). */
export function sseMessage(event: string, data: string, id?: string | number): string {
  let out = ''
  if (id !== undefined) out += `id: ${id}\n`
  out += `event: ${event}\n`
  for (const line of data.split('\n')) out += `data: ${line}\n`
  return `${out}\n`
}

/** Commentaire SSE (ignoré par EventSource) : sert de battement pour garder la connexion ouverte. */
export function sseComment(text: string): string {
  return `: ${text.replace(/\n/g, ' ')}\n\n`
}
