<script lang="ts">
import type { Snippet } from 'svelte'
import { tv, type VariantProps } from 'tailwind-variants'
import { cn } from '#lib/utils/cn.ts'

export const cardVariants = tv({
  base: 'rounded-[var(--radius-lg)] border transition-colors',
  variants: {
    variant: {
      editorial: 'border-line bg-surface text-ink shadow-xs',
      subtle: 'border-line bg-surface-2/75 text-ink',
      tinted: 'border-brand-line bg-brand-soft/60 text-ink',
      amber: 'border-notice-line/50 bg-notice/70 text-notice-ink',
      observatory: 'border-obs-line bg-obs-surface text-obs-ink',
      interactive: 'border-line bg-surface text-ink shadow-xs hover:border-line-strong hover:bg-surface-2/40',
    },
    padding: {
      none: 'p-0',
      sm: 'p-4',
      md: 'p-5 sm:p-6',
      lg: 'p-6 sm:p-8',
    },
  },
  defaultVariants: {
    variant: 'editorial',
    padding: 'md',
  },
})

type Variants = VariantProps<typeof cardVariants>

let {
  variant = 'editorial',
  padding = 'md',
  as = 'div',
  class: className = '',
  children,
}: {
  variant?: Variants['variant']
  padding?: Variants['padding']
  as?: 'div' | 'article' | 'section' | 'aside'
  class?: string
  children: Snippet
} = $props()
</script>

<svelte:element this={as} class={cn(cardVariants({ variant, padding }), className)}>
  {@render children()}
</svelte:element>
