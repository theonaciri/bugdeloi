import { describe, expect, test } from 'bun:test'
import { type Clock, Coalescer, sseComment, sseMessage } from './coalesce.ts'

/** Horloge simulée : on avance le temps à la main. */
function fakeClock() {
  let now = 0
  let seq = 0
  const timers = new Map<number, { at: number; fn: () => void }>()
  const clock: Clock = {
    now: () => now,
    setTimeout: (fn, ms) => {
      const id = ++seq
      timers.set(id, { at: now + ms, fn })
      return id
    },
    clearTimeout: (h) => {
      timers.delete(h as number)
    },
  }
  const advance = (ms: number) => {
    const target = now + ms
    for (;;) {
      const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0]
      if (!next || next[1].at > target) break
      timers.delete(next[0])
      now = next[1].at
      next[1].fn()
    }
    now = target
  }
  return { clock, advance, timers }
}

describe('Coalescer', () => {
  test('le premier signal part immédiatement', () => {
    const { clock } = fakeClock()
    const calls: number[] = []
    const c = new Coalescer((n) => calls.push(n), 1000, clock)
    c.signal()
    expect(calls).toEqual([1])
  })

  test('une rafale donne au plus un envoi par seconde, sans perte', () => {
    const { clock, advance } = fakeClock()
    const calls: Array<[number, number]> = []
    const c = new Coalescer((n) => calls.push([clock.now(), n]), 1000, clock)
    for (let i = 0; i < 50; i++) {
      c.signal()
      advance(20) // 50 signaux en 1 s
    }
    advance(5000)
    expect(calls[0]).toEqual([0, 1])
    // Tous les signaux sont livrés, et jamais deux envois à moins d'une seconde d'écart.
    expect(calls.reduce((s, [, n]) => s + n, 0)).toBe(50)
    for (let i = 1; i < calls.length; i++) {
      expect(
        (calls[i] as [number, number])[0] - (calls[i - 1] as [number, number])[0],
      ).toBeGreaterThanOrEqual(1000)
    }
    expect(calls.length).toBe(2)
  })

  test('après une période calme, le signal repart immédiatement', () => {
    const { clock, advance } = fakeClock()
    const calls: number[] = []
    const c = new Coalescer(() => calls.push(clock.now()), 1000, clock)
    c.signal()
    advance(3000)
    c.signal()
    expect(calls).toEqual([0, 3000])
  })

  test('stop annule l’envoi en attente', () => {
    const { clock, advance, timers } = fakeClock()
    const calls: number[] = []
    const c = new Coalescer((n) => calls.push(n), 1000, clock)
    c.signal()
    c.signal()
    expect(timers.size).toBe(1)
    c.stop()
    expect(timers.size).toBe(0)
    advance(2000)
    c.signal()
    expect(calls).toEqual([1])
  })
})

describe('encodage SSE', () => {
  test('message multi-lignes', () => {
    expect(sseMessage('snapshot', 'a\nb', 7)).toBe('id: 7\nevent: snapshot\ndata: a\ndata: b\n\n')
  })
  test('commentaire de battement', () => {
    expect(sseComment('ping\n1')).toBe(': ping 1\n\n')
  })
})
