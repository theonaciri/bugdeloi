<script lang="ts">
import type { Snippet } from 'svelte'
import { LEVEL_INFO, type Level, type LevelCounts, levelName } from '#lib/levels.ts'

/**
 * Hémicycle du corpus : un siège par article en vigueur, coloré par son niveau de preuve.
 * Les sièges sont rangés par angle, de gauche à droite : la part formalisée commence au pied
 * gauche et grandit vers la droite. Le canevas dessine les sièges ; un SVG de secteurs
 * proportionnels sert de repli (sans JS, impression) et de base accessible. Les nombres exacts
 * sont dans le décompte (`LevelTally`) placé sous la figure.
 */
let {
  counts,
  selected = $bindable(null),
  center,
  footNote,
  label,
  perSeat = $bindable(10),
}: {
  counts: LevelCounts
  selected?: Level | null
  center?: Snippet
  /** Légende posée à gauche du pied de l'arc, là où commence la part formalisée (grands écrans). */
  footNote?: Snippet
  label: string
  /** Nombre d'articles représentés par un siège (calculé selon la largeur, exposé à la page). */
  perSeat?: number
} = $props()

const ORDER: Level[] = ['REF', 'N5', 'N4', 'N3', 'N2', 'N1', 'N0']
const INNER = 0.54
const PAD = 6

let wrap = $state<HTMLDivElement>()
let canvas = $state<HTMLCanvasElement>()
let width = $state(0)
let painted = $state(false)
let hovered = $state<Level | null>(null)

const total = $derived(ORDER.reduce((n, l) => n + counts[l], 0))

/**
 * Sièges par niveau : un siège pour `perSeat` articles, au moins un siège pour tout niveau non vide,
 * N0 reçoit le reste. Les nombres exacts restent dans le décompte sous la figure.
 */
const seats = $derived.by(() => {
  const out = {} as Record<Level, number>
  const totalSeats = Math.max(1, Math.round(total / perSeat))
  let used = 0
  for (const l of ORDER) {
    if (l === 'N0') continue
    out[l] = counts[l] > 0 ? Math.max(1, Math.round(counts[l] / perSeat)) : 0
    used += out[l]
  }
  out.N0 = Math.max(0, totalSeats - used)
  return out
})
const seatTotal = $derived(ORDER.reduce((n, l) => n + seats[l], 0))

/** Secteurs proportionnels (angles en radians, π à gauche, 0 à droite). */
const sectors = $derived.by(() => {
  let start = Math.PI
  return ORDER.filter((l) => counts[l] > 0).map((level) => {
    const sweep = total > 0 ? (counts[level] / total) * Math.PI : 0
    const s = { level, a0: start, a1: start - sweep }
    start -= sweep
    return s
  })
})

function arcPath(a0: number, a1: number, r0: number, r1: number) {
  const p = (a: number, r: number) => `${(r * Math.cos(a)).toFixed(4)} ${(-r * Math.sin(a)).toFixed(4)}`
  const large = Math.abs(a0 - a1) > Math.PI ? 1 : 0
  return `M ${p(a0, r1)} A ${r1} ${r1} 0 ${large} 1 ${p(a1, r1)} L ${p(a1, r0)} A ${r0} ${r0} 0 ${large} 0 ${p(a0, r0)} Z`
}

type Seat = { a: number; r: number }
function seatLayout(n: number): { seats: Seat[]; dot: number } {
  if (n <= 0) return { seats: [], dot: 0 }
  const rows = Math.max(1, Math.round(Math.sqrt((2 * n * (1 - INNER)) / (Math.PI * (1 + INNER)))))
  const d = (1 - INNER) / rows
  const radii = Array.from({ length: rows }, (_, i) => INNER + (i + 0.5) * d)
  const raw = radii.map((r) => (Math.PI * r) / d)
  const sum = raw.reduce((a, b) => a + b, 0)
  const perRow = raw.map((v) => Math.floor((v * n) / sum))
  let rest = n - perRow.reduce((a, b) => a + b, 0)
  for (let i = rows - 1; rest > 0; i = (i - 1 + rows) % rows) {
    perRow[i] = (perRow[i] ?? 0) + 1
    rest--
  }
  const seats: Seat[] = []
  radii.forEach((r, i) => {
    const k = perRow[i] ?? 0
    for (let j = 0; j < k; j++) seats.push({ a: Math.PI * (1 - (j + 0.5) / k), r })
  })
  seats.sort((p, q) => q.a - p.a || p.r - q.r)
  return { seats, dot: d * 0.36 }
}

const layout = $derived(seatLayout(seatTotal))

/** Niveau de chaque siège, dans l'ordre des sièges. */
const seatLevels = $derived.by(() => {
  const out: Level[] = []
  for (const l of ORDER) for (let i = 0; i < seats[l]; i++) out.push(l)
  return out
})

const reduceMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

let drawnOnce = false
let raf = 0

function colors(el: HTMLElement): Record<Level, string> {
  const cs = getComputedStyle(el)
  const out = {} as Record<Level, string>
  for (const l of ORDER) out[l] = cs.getPropertyValue(LEVEL_INFO[l].colorToken).trim() || '#888'
  return out
}

function draw(progress: number) {
  if (!canvas || width <= 0) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const R = width / 2 - PAD
  const h = R + PAD * 2
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(h * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, h)
  const pal = colors(canvas)
  const focus = selected ?? hovered
  const cx = width / 2
  const cy = R + PAD
  const dot = Math.max(0.6, layout.dot * R)
  const shown = Math.floor(progress * layout.seats.length)
  let current: Level | null = null
  for (let i = 0; i < shown; i++) {
    const s = layout.seats[i]
    const level = seatLevels[i]
    if (!s || !level) continue
    if (level !== current) {
      current = level
      ctx.fillStyle = pal[level]
      ctx.globalAlpha = focus && focus !== level ? 0.16 : 1
    }
    ctx.beginPath()
    ctx.arc(cx + s.r * Math.cos(s.a) * R, cy - s.r * Math.sin(s.a) * R, dot, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function animate() {
  cancelAnimationFrame(raf)
  if (drawnOnce || reduceMotion()) {
    draw(1)
    drawnOnce = true
    painted = true
    return
  }
  const t0 = performance.now()
  const D = 1400
  const step = (t: number) => {
    const x = Math.min(1, (t - t0) / D)
    draw(x === 1 ? 1 : 1 - 2 ** (-10 * x))
    painted = true
    if (x < 1) raf = requestAnimationFrame(step)
    else drawnOnce = true
  }
  raf = requestAnimationFrame(step)
}

$effect(() => {
  if (!wrap) return
  const ro = new ResizeObserver(([entry]) => {
    width = Math.round(entry?.contentRect.width ?? 0)
    perSeat = width < 640 ? 40 : 10
  })
  ro.observe(wrap)
  const mq = matchMedia('(prefers-color-scheme: dark)')
  const repaint = () => draw(1)
  mq.addEventListener('change', repaint)
  const mo = new MutationObserver(repaint)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] })
  return () => {
    ro.disconnect()
    mq.removeEventListener('change', repaint)
    mo.disconnect()
    cancelAnimationFrame(raf)
  }
})

$effect(() => {
  // Redessine quand la taille, les comptes ou la sélection changent.
  void width
  void seatLevels
  void selected
  void hovered
  if (width > 0) animate()
})

function levelAt(ev: MouseEvent): Level | null {
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  const R = width / 2 - PAD
  const x = ev.clientX - rect.left - width / 2
  const y = R + PAD - (ev.clientY - rect.top)
  const r = Math.hypot(x, y) / R
  if (y < -PAD || r < INNER - 0.03 || r > 1.03) return null
  const a = Math.atan2(Math.max(y, 0), x)
  return sectors.find((s) => a <= s.a0 && a >= s.a1)?.level ?? null
}

const focusLevel = $derived(selected ?? hovered)
</script>

<figure class="hemicycle" aria-label={label}>
  {#if focusLevel}
    <span class="sr-only" aria-live="polite">{levelName(focusLevel)} : {counts[focusLevel]} articles</span>
  {/if}

  <div bind:this={wrap} class="relative">
    <svg
      class="block h-auto w-full transition-opacity duration-500"
      class:opacity-0={painted}
      viewBox="-1.02 -1.02 2.04 1.04"
      aria-hidden="true"
      preserveAspectRatio="xMidYMin meet"
    >
      {#each sectors as s (s.level)}
        <path d={arcPath(s.a0, s.a1, INNER, 1)} class="lvl-fill-{s.level === 'REF' ? 'ref' : s.level.toLowerCase()}" />
      {/each}
    </svg>
    <canvas
      bind:this={canvas}
      class="absolute inset-x-0 top-0 block w-full"
      aria-hidden="true"
      onpointermove={(e) => (hovered = levelAt(e))}
      onpointerleave={() => (hovered = null)}
      onclick={(e) => {
        const l = levelAt(e)
        selected = l && l !== selected ? l : null
      }}
    ></canvas>
    {#if footNote}
      <div class="hemicycle-foot hemicycle-foot-side" aria-hidden="true">{@render footNote()}</div>
    {/if}
    {#if center}
      <div class="hemicycle-center">
        {@render center()}
      </div>
    {/if}
  </div>
  {#if footNote}
    <div class="hemicycle-foot hemicycle-foot-below">{@render footNote()}</div>
  {/if}
  <figcaption class="sr-only">
    {label} Répartition :
    {#each ORDER as l (l)}{levelName(l)} : {counts[l]} ; {/each}
  </figcaption>
</figure>

<style>
  .hemicycle {
    max-width: 64rem;
    margin-inline: auto;
  }
  .hemicycle-center {
    position: absolute;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: calc(var(--inner, 0.54) * 100% * 0.98);
    text-align: center;
  }
  .hemicycle-foot-side {
    position: absolute;
    right: calc(100% + 0.9rem);
    bottom: 0.2rem;
    width: 11.5rem;
    text-align: right;
    display: none;
  }
  .hemicycle-foot-side::after {
    content: '→';
    display: block;
    font-size: 1.4rem;
    line-height: 1;
    margin-top: 0.2rem;
  }
  .hemicycle-foot-below {
    margin-top: 0.4rem;
    max-width: 22rem;
  }
  @media (min-width: 80rem) {
    .hemicycle-foot-side {
      display: block;
    }
    .hemicycle-foot-below {
      display: none;
    }
  }
  canvas {
    cursor: crosshair;
    touch-action: manipulation;
  }
  @media (max-width: 47.99rem) {
    .hemicycle-center {
      position: static;
      transform: none;
      width: auto;
      margin-top: 1.25rem;
    }
  }
</style>
