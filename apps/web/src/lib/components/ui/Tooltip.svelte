<script lang="ts">
import { TooltipContent, TooltipTrigger, Tooltip as UiTooltip } from '@ui-sdk/svelte/tooltip'
import type { Snippet } from 'svelte'
import { cn } from '#lib/utils/cn.ts'

let {
  text,
  side = 'top',
  children,
  class: className = '',
}: {
  text: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  children: Snippet
  class?: string
} = $props()
</script>

<UiTooltip delay={220}>
  <TooltipTrigger class="inline-flex items-center">
    {@render children()}
  </TooltipTrigger>
  <TooltipContent
    {side}
    sideOffset={6}
    class={cn(
      'z-50 max-w-xs rounded-[var(--radius-sm)] border border-obs-line-strong bg-obs-bg px-2.5 py-1.5 text-xs font-medium text-obs-ink shadow-[var(--shadow)]',
      className,
    )}
  >
    {text}
  </TooltipContent>
</UiTooltip>
