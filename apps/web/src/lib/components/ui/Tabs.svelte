<script lang="ts">
import { TabsList, TabsPanel, TabsTab, Tabs as UiTabs } from '@ui-sdk/svelte/tabs'
import type { Snippet } from 'svelte'
import { cn } from '#lib/utils/cn.ts'

export interface TabItem {
  value: string
  label: string
  badge?: string | number
  disabled?: boolean
}

let {
  value = $bindable<string | null | undefined>(undefined),
  defaultValue,
  items,
  ariaLabel,
  variant = 'editorial',
  tone = 'light',
  class: className = '',
  listClass = '',
  panelClass = '',
  onchange,
  panel,
}: {
  value?: string | null
  defaultValue?: string
  items: TabItem[]
  ariaLabel: string
  variant?: 'editorial' | 'pill'
  tone?: 'light' | 'observatory'
  class?: string
  listClass?: string
  panelClass?: string
  onchange?: (next: string | null) => void
  panel: Snippet<[string]>
} = $props()

const tabClasses = $derived(
  variant === 'pill'
    ? tone === 'observatory'
      ? 'inline-flex items-center gap-2 rounded-[var(--radius)] px-3.5 py-1.5 text-sm font-medium text-obs-muted transition-colors cursor-pointer hover:text-obs-ink data-[selected]:bg-obs-ink data-[selected]:text-obs-bg'
      : 'inline-flex items-center gap-2 rounded-[var(--radius)] px-3.5 py-1.5 text-sm font-medium text-muted transition-colors cursor-pointer hover:text-ink data-[selected]:bg-ink data-[selected]:text-bg'
    : tone === 'observatory'
      ? 'relative inline-flex items-center gap-2 px-1 py-2.5 text-sm font-semibold text-obs-muted transition-colors cursor-pointer border-b-2 border-transparent hover:text-obs-ink data-[selected]:text-obs-ink data-[selected]:border-obs-emerald'
      : 'relative inline-flex items-center gap-2 px-1 py-2.5 text-sm font-semibold text-muted transition-colors cursor-pointer border-b-2 border-transparent hover:text-ink data-[selected]:text-ink data-[selected]:border-brand',
)
</script>

<UiTabs
  bind:value
  {defaultValue}
  onValueChange={(next) => onchange?.(next)}
  class={cn('w-full', className)}
>
  <TabsList
    aria-label={ariaLabel}
    class={cn(
      variant === 'pill'
        ? cn(
            'inline-flex flex-wrap items-center gap-1 rounded-full border p-1',
            tone === 'observatory'
              ? 'border-obs-line bg-obs-surface'
              : 'border-line bg-surface-2/80',
          )
        : cn(
            'flex flex-wrap items-center gap-x-6 gap-y-1 border-b',
            tone === 'observatory' ? 'border-obs-line' : 'border-line',
          ),
      listClass,
    )}
  >
    {#each items as item (item.value)}
      <TabsTab value={item.value} disabled={item.disabled} class={tabClasses}>
        <span>{item.label}</span>
        {#if item.badge !== undefined}
          <span
            class={cn(
              'mono rounded-[var(--radius)] px-1.5 py-0.5 text-[0.68rem] leading-none tabular',
              tone === 'observatory' ? 'bg-obs-surface-2 text-obs-muted' : 'bg-surface-2 text-muted',
            )}
          >
            {item.badge}
          </span>
        {/if}
      </TabsTab>
    {/each}
  </TabsList>

  {#each items as item (item.value)}
    <TabsPanel value={item.value} class={cn('mt-5 outline-none', panelClass)}>
      {@render panel(item.value)}
    </TabsPanel>
  {/each}
</UiTabs>
