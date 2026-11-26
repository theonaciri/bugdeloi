<script lang="ts">
import { Check, Copy } from '@lucide/svelte'
import { Button as UiButton } from '@ui-sdk/svelte/button'
import { cn } from '#lib/utils/cn.ts'

let {
  text,
  label = 'Copier',
  copiedLabel = 'Copié',
  tone = 'light',
  size = 'sm',
  class: className = '',
}: {
  text: string
  label?: string
  copiedLabel?: string
  tone?: 'light' | 'observatory'
  size?: 'xs' | 'sm' | 'md'
  class?: string
} = $props()

let copied = $state(false)
let timer: ReturnType<typeof setTimeout> | null = null

async function copy() {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return
  try {
    await navigator.clipboard.writeText(text)
    copied = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      copied = false
    }, 2000)
  } catch {
    // presse-papiers indisponible dans le contexte navigateur
  }
}

const toneClasses = $derived(
  tone === 'observatory'
    ? 'border-obs-line-strong bg-obs-surface-2 text-obs-ink hover:border-obs-emerald/60 hover:text-obs-emerald'
    : 'border-line bg-surface text-ink hover:bg-surface-2 hover:border-line-strong',
)

const sizeClasses = $derived(
  size === 'xs'
    ? 'h-7 px-2.5 text-xs gap-1.5'
    : size === 'md'
      ? 'h-9 px-3.5 text-sm gap-2'
      : 'h-8 px-3 text-xs gap-1.5',
)
</script>

<UiButton
  type="button"
  aria-label={copied ? copiedLabel : label}
  onclick={copy}
  class={cn(
    'inline-flex items-center justify-center rounded-full border font-mono font-medium transition-colors cursor-pointer select-none',
    toneClasses,
    sizeClasses,
    copied && (tone === 'observatory' ? 'border-obs-emerald text-obs-emerald' : 'border-brand text-brand-strong bg-brand-soft'),
    className,
  )}
>
  {#if copied}
    <Check class="size-3.5" aria-hidden="true" />
    <span>{copiedLabel}</span>
  {:else}
    <Copy class="size-3.5" aria-hidden="true" />
    <span>{label}</span>
  {/if}
</UiButton>
