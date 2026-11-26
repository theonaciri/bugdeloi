<script lang="ts">
import { scaleLinear } from 'd3-scale'

export interface SparkPoint {
  day: string
  count: number
}

let {
  points,
  label = 'Activité sur 14 jours',
  tone = 'light',
  height = 42,
}: {
  points: SparkPoint[]
  label?: string
  tone?: 'light' | 'observatory'
  height?: number
} = $props()

const W = 224
const H = $derived(height)
const maxVal = $derived(Math.max(1, ...points.map((p) => p.count)))
const yScale = $derived(
  scaleLinear()
    .domain([0, maxVal])
    .range([3, H - 4]),
)
const step = $derived(points.length > 0 ? W / points.length : W)
const barWidth = $derived(Math.max(4, step - 4))
let active = $state<SparkPoint | null>(null)
const total = $derived(points.reduce((sum, p) => sum + p.count, 0))
</script>

<div class="inline-flex flex-col gap-1">
  <div class="flex items-baseline justify-between gap-3 text-[0.7rem]">
    <span class={tone === 'observatory' ? 'mono text-obs-muted' : 'mono text-muted'}>
      {#if active}
        {active.day} · <strong class={tone === 'observatory' ? 'text-obs-ink' : 'text-ink'}>{active.count}</strong>
      {:else}
        {label}
      {/if}
    </span>
    <span class="mono tabular font-semibold {tone === 'observatory' ? 'text-obs-emerald' : 'text-brand-strong'}">
      {total} évts
    </span>
  </div>
  <svg
    viewBox="0 0 {W} {H}"
    width={W}
    height={H}
    class="block h-auto w-full max-w-[14rem] overflow-visible"
    role="img"
    aria-label={`${label} : ${total} événements au total`}
  >
    <line
      x1="0"
      y1={H - 1}
      x2={W}
      y2={H - 1}
      stroke={tone === 'observatory' ? 'var(--obs-line)' : 'var(--line)'}
      stroke-width="1"
    />
    {#each points as point, index (point.day)}
      {@const h = point.count > 0 ? yScale(point.count) : 2}
      {@const x = index * step + 2}
      {@const y = H - 1 - h}
      <rect
        {x}
        {y}
        width={barWidth}
        height={h}
        rx="2"
        fill={point.count > 0
          ? tone === 'observatory'
            ? active === point
              ? 'var(--obs-amber)'
              : 'var(--obs-emerald)'
            : active === point
              ? 'var(--focus)'
              : 'var(--brand)'
          : tone === 'observatory'
            ? 'var(--obs-line)'
            : 'var(--line)'}
        opacity={point.count > 0 ? (active && active !== point ? 0.55 : 1) : 0.6}
        role="presentation"
        onpointerenter={() => (active = point)}
        onpointerleave={() => (active = null)}
      >
        <title>{point.day} : {point.count} événement{point.count > 1 ? 's' : ''}</title>
      </rect>
    {/each}
  </svg>
</div>
