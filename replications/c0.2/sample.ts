/**
 * Tirage de l'échantillon de triage (graine fixée) : même graine + même base = mêmes candidats.
 * Les candidats d'une strate sont triés par empreinte, puis mélangés par un PRNG (mulberry32).
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Item {
  fingerprint: string
  stratum: string
}

/** `quotas` : strate → effectif ; une strate trop petite est prise en entier. */
export function drawSample<T extends Item>(items: T[], quotas: Record<string, number>, seed: number): T[] {
  const rnd = mulberry32(seed)
  const out: T[] = []
  for (const [stratum, n] of Object.entries(quotas).sort(([a], [b]) => a.localeCompare(b))) {
    const pool = items
      .filter((i) => i.stratum === stratum)
      .sort((a, b) => a.fingerprint.localeCompare(b.fingerprint))
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j] as T, pool[i] as T]
    }
    out.push(...pool.slice(0, n))
  }
  return out
}
