<script lang="ts">
import { ChevronDown } from '@lucide/svelte'
import {
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
  Accordion as UiAccordion,
} from '@ui-sdk/svelte/accordion'
import type { Snippet } from 'svelte'
import { cn } from '#lib/utils/cn.ts'

export interface AccordionEntry {
  value: string
  title: string
  meta?: string
  content?: string
}

let {
  items,
  defaultValue,
  multiple = false,
  collapsible = true,
  tone = 'light',
  class: className = '',
  renderItem,
}: {
  items: AccordionEntry[]
  defaultValue?: string[]
  multiple?: boolean
  collapsible?: boolean
  tone?: 'light' | 'observatory'
  class?: string
  renderItem?: Snippet<[AccordionEntry]>
} = $props()
</script>

<UiAccordion
  {defaultValue}
  {multiple}
  {collapsible}
  class={cn(
    'divide-y rounded-[var(--radius-lg)] border',
    tone === 'observatory'
      ? 'divide-obs-line border-obs-line bg-obs-surface text-obs-ink'
      : 'divide-line border-line bg-surface text-ink',
    className,
  )}
>
  {#each items as entry (entry.value)}
    <AccordionItem value={entry.value} class="group">
      <AccordionHeader>
        <AccordionTrigger
          class={cn(
            'flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium transition-colors cursor-pointer',
            tone === 'observatory' ? 'hover:bg-obs-surface-2/60' : 'hover:bg-surface-2/60',
          )}
        >
          <span class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span class="font-semibold">{entry.title}</span>
            {#if entry.meta}
              <span class={cn('mono text-xs', tone === 'observatory' ? 'text-obs-muted' : 'text-muted')}>
                {entry.meta}
              </span>
            {/if}
          </span>
          <ChevronDown
            class={cn(
              'size-4 shrink-0 transition-transform duration-200 group-data-[open]:rotate-180',
              tone === 'observatory' ? 'text-obs-muted' : 'text-muted',
            )}
            aria-hidden="true"
          />
        </AccordionTrigger>
      </AccordionHeader>
      <AccordionPanel class="px-5 pb-4.5 pt-0.5 text-sm leading-relaxed">
        {#if renderItem}
          {@render renderItem(entry)}
        {:else if entry.content}
          <p class={tone === 'observatory' ? 'text-obs-muted' : 'text-muted'}>{entry.content}</p>
        {/if}
      </AccordionPanel>
    </AccordionItem>
  {/each}
</UiAccordion>
