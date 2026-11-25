import { isIP } from 'node:net'
import { json } from '@sveltejs/kit'

const WINDOW_MS = 60_000
const MAX_REQUESTS = 30
const MAX_CLIENTS = 4096

export function deskError(status: number, error: string, headers?: HeadersInit) {
  return json({ error }, { status, headers })
}

export function deskUnavailable() {
  return process.env.DESK_ENABLED !== '1'
}

export function createDeskRateLimiter() {
  const requests = new Map<string, number>()
  let windowEnd = 0

  return (address: string, now = Date.now()) => {
    if (now >= windowEnd) {
      requests.clear()
      windowEnd = now + WINDOW_MS
    }
    const ip = isIP(address) ? address : ''
    const count = requests.get(ip)
    if ((count ?? 0) >= MAX_REQUESTS || (count === undefined && requests.size >= MAX_CLIENTS)) {
      return deskError(429, 'rate_limited', { 'retry-after': String(Math.ceil((windowEnd - now) / 1000)) })
    }
    requests.set(ip, (count ?? 0) + 1)
    return null
  }
}

const limitDesk = createDeskRateLimiter()

export function guardDesk(getClientAddress: () => string) {
  if (deskUnavailable()) return deskError(503, 'desk_unavailable')

  let address = ''
  try {
    address = getClientAddress()
  } catch {
    // Sans adresse fournie par l'adaptateur, les requêtes partagent le même quota.
  }
  return limitDesk(address)
}
