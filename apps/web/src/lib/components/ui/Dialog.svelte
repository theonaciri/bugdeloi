<script lang="ts">
import { X } from '@lucide/svelte'
import {
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Dialog as UiDialog,
} from '@ui-sdk/svelte/dialog'
import type { Snippet } from 'svelte'
import { cn } from '#lib/utils/cn.ts'

let {
  open = $bindable(false),
  title,
  description,
  maxWidth = 'max-w-xl',
  trigger,
  children,
  class: className = '',
}: {
  open?: boolean
  title: string
  description?: string
  maxWidth?: string
  trigger?: Snippet
  children: Snippet
  class?: string
} = $props()
</script>

<UiDialog bind:open>
  {#if trigger}
    <DialogTrigger class="inline-flex">
      {@render trigger()}
    </DialogTrigger>
  {/if}
  <DialogBackdrop class="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px]" />
  <DialogContent
    class={cn(
      'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
      'max-h-[85dvh] overflow-y-auto rounded-[var(--radius-xl)] border border-line bg-surface p-6 text-ink shadow-[var(--shadow-lg)]',
      maxWidth,
      className,
    )}
  >
    <div class="flex items-start justify-between gap-4">
      <div>
        <DialogTitle class="font-display text-2xl font-semibold tracking-tight">{title}</DialogTitle>
        {#if description}
          <DialogDescription class="mt-1 text-sm text-muted">{description}</DialogDescription>
        {/if}
      </div>
      <DialogClose
        aria-label="Fermer la fenêtre"
        class="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-line text-muted transition-colors hover:bg-surface-2 hover:text-ink cursor-pointer"
      >
        <X class="size-4" aria-hidden="true" />
      </DialogClose>
    </div>
    <div class="mt-5">
      {@render children()}
    </div>
  </DialogContent>
</UiDialog>
