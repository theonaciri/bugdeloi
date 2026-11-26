<script lang="ts">
import { SegmentedControlItem, SegmentedControl as UiSegmented } from '@ui-sdk/svelte/segmented-control'
import { cn } from '#lib/utils/cn.ts'

export interface SegmentOption {
  value: string
  label: string
  badge?: string | number
}

let {
  value = $bindable(),
  options,
  ariaLabel,
  tone = 'light',
  size = 'md',
  class: className = '',
  onchange,
}: {
  value?: string
  options: SegmentOption[]
  ariaLabel: string
  tone?: 'light' | 'observatory'
  size?: 'sm' | 'md'
  class?: string
  onchange?: (next: string) => void
} = $props()
</script>

<UiSegmented
  bind:value
  aria-label={ariaLabel}
  onValueChange={(next) => {
    if (next) onchange?.(next)
  }}
  class={cn(
    'inline-flex flex-wrap items-center gap-1 rounded-full border p-1',
    tone === 'observatory'
      ? 'border-obs-line bg-obs-surface'
      : 'border-line bg-surface-2/80',
    className,
  )}
>
  {#each options as opt (opt.value)}
    <SegmentedControlItem
      value={opt.value}
      class={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium transition-colors cursor-pointer select-none',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
        tone === 'observatory'
          ? 'text-obs-muted hover:text-obs-ink data-[checked]:bg-obs-ink data-[checked]:text-obs-bg'
          : 'text-muted hover:text-ink data-[checked]:bg-ink data-[checked]:text-bg shadow-none data-[checked]:shadow-xs',
      )}
    >
      <span>{opt.label}</span>
      {#if opt.badge !== undefined}
        <span class="mono text-[0.7rem] opacity-75 tabular">{opt.badge}</span>
      {/if}
    </SegmentedControlItem>
  {/each}
</UiSegmented>
