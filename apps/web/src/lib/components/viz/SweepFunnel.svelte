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
const active = $derived(
  (activeId ? stages.find((s) => s.id === activeId) : undefined) ?? stages[2] ?? stages[0],
)
const maxCount = $derived(Math.max(1, ...stages.map((s) => s.count)))

function barPercent(count: number): number {
  if (count <= 0) return 4
  // Échelle racine pour rester lisible quand les ordres de grandeur vont de 10^4 à 10^0
  const ratio = Math.sqrt(count) / Math.sqrt(maxCount)
  return Math.max(8, Math.min(100, Math.round(ratio * 100)))
}
</script>

<div class="space-y-4">
  <ol class="space-y-2.5" aria-label="Entonnoir du contrôle mécanique C0.2">
    {#each stages as stage, index (stage.id)}
      {@const pct = barPercent(stage.count)}
      {@const isSelected = active?.id === stage.id}
      <li>
        <button
          type="button"
          onclick={() => (activeId = stage.id)}
          aria-pressed={isSelected}
          class={cn(
            'w-full rounded-[var(--radius)] border p-3.5 text-left transition-colors cursor-pointer',
            tone === 'observatory'
              ? isSelected
                ? 'border-obs-emerald/70 bg-obs-surface-2'
                : 'border-obs-line bg-obs-surface hover:border-obs-line-strong'
              : isSelected
                ? 'border-brand bg-brand-soft/45'
                : 'border-line bg-surface hover:border-line-strong',
          )}
        >
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <div class="flex items-baseline gap-2.5">
              <span class="mono text-[0.7rem] font-bold opacity-60">0{index + 1}</span>
              <span class="font-semibold text-sm">{stage.label}</span>
            </div>
            <span class="mono text-lg font-bold tabular">{formatInt(stage.count)}</span>
          </div>
          <p class={cn('mt-1 text-xs', tone === 'observatory' ? 'text-obs-muted' : 'text-muted')}>
            {stage.sublabel}
          </p>
          <div class={cn('mt-2.5 h-2 w-full overflow-hidden rounded-full', tone === 'observatory' ? 'bg-obs-bg' : 'bg-surface-2')}>
            <svg viewBox="0 0 100 8" preserveAspectRatio="none" class="block h-full w-full" aria-hidden="true">
              <rect
                x="0"
                y="0"
                width={pct}
                height="8"
                rx="4"
                class={cn(
                  stage.tone === 'emerald'
                    ? 'fill-brand'
                    : stage.tone === 'amber'
                      ? 'fill-notice-line'
                      : stage.tone === 'cobalt'
                        ? 'fill-info'
                        : 'fill-line-strong',
                )}
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
        'rounded-[var(--radius)] border p-3.5 text-xs leading-relaxed',
        tone === 'observatory'
          ? 'border-obs-line bg-obs-surface text-obs-muted'
          : 'border-line bg-surface-2/70 text-muted',
      )}
    >
      <p class={cn('font-semibold', tone === 'observatory' ? 'text-obs-ink' : 'text-ink')}>
        Étape sélectionnée · {active.label}
      </p>
      <p class="mt-1">{active.detail}</p>
    </div>
  {/if}
</div>
