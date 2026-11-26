<script lang="ts">
import { formatInt } from '#lib/format.ts'
import { cn } from '#lib/utils/cn.ts'

export interface FunnelStage {
  id: string
  label: string
  count: number
  sublabel: string
  detail: string
  tone: 'neutral' | 'cobalt' | 'amber' | 'emerald'
}

let {
  stages,
  tone = 'light',
}: {
  stages: FunnelStage[]
  tone?: 'light' | 'observatory'
} = $props()

let activeId = $state<string | null>(null)
let trackWidth = $state(280)
const active = $derived(
  (activeId ? stages.find((s) => s.id === activeId) : undefined) ?? stages[2] ?? stages[0],
)
const maxCount = $derived(Math.max(1, ...stages.map((s) => s.count)))
const barW = $derived(Math.max(120, Math.round(trackWidth)))

function barPx(count: number): number {
  if (count <= 0) return 8
  const ratio = Math.sqrt(count) / Math.sqrt(maxCount)
  return Math.max(14, Math.min(barW, Math.round(ratio * barW)))
}
</script>

<div class="space-y-5">
  <ol
    class={cn(
      'divide-y border-y',
      tone === 'observatory' ? 'divide-obs-line border-obs-line' : 'divide-line border-line',
    )}
    aria-label="Entonnoir du contrôle mécanique C0.2"
  >
    {#each stages as stage, index (stage.id)}
      {@const w = barPx(stage.count)}
      {@const isSelected = active?.id === stage.id}
      <li>
        <button
          type="button"
          onclick={() => (activeId = stage.id)}
          aria-pressed={isSelected}
          class={cn(
            'w-full px-3 py-4 text-left transition-colors cursor-pointer',
            tone === 'observatory'
              ? isSelected
                ? 'bg-obs-surface-2/80'
                : 'hover:bg-obs-surface/60'
              : isSelected
                ? 'bg-surface-2/85'
                : 'hover:bg-surface-2/40',
          )}
        >
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <div class="flex items-baseline gap-2.5">
              <span class="text-xs font-bold opacity-50 tabular">0{index + 1}</span>
              <span class="font-semibold text-sm">{stage.label}</span>
            </div>
            <span class="font-serif text-2xl font-semibold tabular">{formatInt(stage.count)}</span>
          </div>
          <p class={cn('mt-1 text-xs', tone === 'observatory' ? 'text-obs-muted' : 'text-muted')}>
            {stage.sublabel}
          </p>
          <div class="mt-3" bind:clientWidth={trackWidth}>
            <svg viewBox="0 0 {barW} 6" width={barW} height="6" class="block h-[6px] w-full" aria-hidden="true">
              <rect
                x="0"
                y="0"
                width={barW}
                height="6"
                rx="3"
                fill={tone === 'observatory' ? 'var(--obs-line)' : 'var(--surface-2)'}
              />
              <rect
                x="0"
                y="0"
                width={w}
                height="6"
                rx="3"
                fill={stage.tone === 'emerald'
                  ? 'var(--brand)'
                  : stage.tone === 'amber'
                    ? 'var(--notice-line)'
                    : stage.tone === 'cobalt'
                      ? 'var(--info)'
                      : 'var(--line-strong)'}
              />
            </svg>
          </div>
        </button>
      </li>
    {/each}
  </ol>

  {#if active}
    <div
      class={cn(
        'rounded-[var(--radius)] p-4 text-sm leading-relaxed',
        tone === 'observatory'
          ? 'bg-obs-surface text-obs-muted'
          : 'bg-surface-2/75 text-muted',
      )}
    >
      <p class={cn('font-semibold text-xs uppercase tracking-wider', tone === 'observatory' ? 'text-obs-ink' : 'text-ink')}>
        Étape sélectionnée · {active.label}
      </p>
      <p class="mt-1.5">{active.detail}</p>
    </div>
  {/if}
</div>
