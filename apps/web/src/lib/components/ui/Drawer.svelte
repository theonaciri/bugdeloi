<script lang="ts">
import { X } from '@lucide/svelte'
import {
  DrawerBackdrop,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
  Drawer as UiDrawer,
} from '@ui-sdk/svelte/drawer'
import type { Snippet } from 'svelte'
import { cn } from '#lib/utils/cn.ts'

let {
  open = $bindable(false),
  side = 'right',
  title,
  description,
  trigger,
  children,
  class: className = '',
}: {
  open?: boolean
  side?: 'right' | 'left' | 'bottom'
  title: string
  description?: string
  trigger?: Snippet
  children: Snippet
  class?: string
} = $props()

const positionClasses = $derived(
  side === 'left'
    ? 'inset-y-0 left-0 h-full w-full max-w-md border-r'
    : side === 'bottom'
      ? 'inset-x-0 bottom-0 max-h-[85dvh] w-full border-t rounded-t-[var(--radius-xl)]'
      : 'inset-y-0 right-0 h-full w-full max-w-lg border-l',
)
</script>

<UiDrawer bind:open {side}>
  {#if trigger}
    <DrawerTrigger class="inline-flex">
      {@render trigger()}
    </DrawerTrigger>
  {/if}
  <DrawerBackdrop class="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px]" />
  <DrawerContent
    class={cn(
      'fixed z-50 flex flex-col border-line bg-surface text-ink shadow-[var(--shadow-lg)]',
      positionClasses,
      className,
    )}
  >
    <div class="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div class="min-w-0">
        <DrawerTitle class="font-display text-xl font-semibold tracking-tight">{title}</DrawerTitle>
        {#if description}
          <DrawerDescription class="mt-0.5 text-xs text-muted">{description}</DrawerDescription>
        {/if}
      </div>
      <DrawerClose
        aria-label="Fermer le panneau"
        class="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-line text-muted transition-colors hover:bg-surface-2 hover:text-ink cursor-pointer"
      >
        <X class="size-4" aria-hidden="true" />
      </DrawerClose>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      {@render children()}
    </div>
  </DrawerContent>
</UiDrawer>
