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
  height = 36,
}: {
  points: SparkPoint[]
  label?: string
  tone?: 'light' | 'observatory'
  height?: number
} = $props()

const W = 210
const H = $derived(height)
const maxVal = $derived(Math.max(1, ...points.map((p) => p.count)))
const yScale = $derived(
  scaleLinear()
    .domain([0, maxVal])
    .range([4, H - 4]),
)
const step = $derived(points.length > 0 ? W / points.length : W)
const barWidth = $derived(Math.max(5, step - 5))
let active = $state<SparkPoint | null>(null)
const total = $derived(points.reduce((sum, p) => sum + p.count, 0))
</script>

<div class="inline-flex flex-col gap-1.5">
  <div class="flex items-baseline justify-between gap-3 text-xs">
    <span class={tone === 'observatory' ? 'text-obs-muted' : 'text-muted'}>
      {#if active}
        {active.day} · <strong class={tone === 'observatory' ? 'text-obs-ink' : 'text-ink'}>{active.count}</strong>
      {:else}
        {label}
      {/if}
    </span>
    <span class="tabular font-semibold {tone === 'observatory' ? 'text-obs-ink' : 'text-ink'}">
      {total} opérations
    </span>
  </div>
  <svg
    viewBox="0 0 {W} {H}"
    width={W}
    height={H}
    class="block h-[36px] w-[210px] max-w-full overflow-visible"
    role="img"
    aria-label={`${label} : ${total} opérations au total`}
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
      {@const x = index * step + 2.5}
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
        opacity={point.count > 0 ? (active && active !== point ? 0.45 : 0.9) : 0.65}
        role="presentation"
        onpointerenter={() => (active = point)}
        onpointerleave={() => (active = null)}
      >
        <title>{point.day} : {point.count} événement{point.count > 1 ? 's' : ''}</title>
      </rect>
    {/each}
  </svg>
</div>
