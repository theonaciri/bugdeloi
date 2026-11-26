<script lang="ts">
import { HoverCardContent, HoverCardTrigger, HoverCard as UiHoverCard } from '@ui-sdk/svelte/hover-card'
import type { Snippet } from 'svelte'
import { cn } from '#lib/utils/cn.ts'

let {
  side = 'top',
  trigger,
  content,
  class: className = '',
}: {
  side?: 'top' | 'bottom' | 'left' | 'right'
  trigger: Snippet
  content: Snippet
  class?: string
} = $props()
</script>

<UiHoverCard delay={180} closeDelay={140}>
  <HoverCardTrigger
    class="inline-flex items-baseline border-b border-dotted border-brand/70 font-medium text-ink decoration-none cursor-help"
  >
    {@render trigger()}
  </HoverCardTrigger>
  <HoverCardContent
    {side}
    sideOffset={8}
    class={cn(
      'z-50 w-72 rounded-[var(--radius)] border border-line bg-surface p-3.5 text-sm text-ink shadow-[var(--shadow-lg)]',
      className,
    )}
  >
    {@render content()}
  </HoverCardContent>
</UiHoverCard>
