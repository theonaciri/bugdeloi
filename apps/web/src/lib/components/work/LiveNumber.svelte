<script lang="ts">
import { formatInt } from '#lib/format.ts'

/**
 * Nombre qui change sous les yeux : quand la valeur évolue (flux temps réel), il défile
 * de l'ancienne à la nouvelle valeur et s'éclaire brièvement. Rien au premier affichage.
 */
let { value, class: className = '' }: { value: number; class?: string } = $props()

let shown = $state(0)
let flash = $state(false)
let first = $state(true)
let raf = 0

$effect(() => {
  const target = value
  if (first || typeof window === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    first = false
    shown = target
    return
  }
  const from = shown
  if (from === target) return
  flash = true
  const t0 = performance.now()
  cancelAnimationFrame(raf)
  const step = (t: number) => {
    const x = Math.min(1, (t - t0) / 700)
    const e = 1 - 2 ** (-10 * x)
    shown = Math.round(from + (target - from) * e)
    if (x < 1) raf = requestAnimationFrame(step)
    else setTimeout(() => (flash = false), 500)
  }
  raf = requestAnimationFrame(step)
  return () => cancelAnimationFrame(raf)
})
</script>

<span class="live-number tabular {className}" class:flash>{formatInt(first ? value : shown)}</span>

<style>
  .live-number {
    transition: background-color 600ms cubic-bezier(0.16, 1, 0.3, 1);
    border-radius: 2px;
  }
  .flash {
    background-color: var(--mark);
    color: var(--mark-ink);
  }
</style>
