<script lang="ts">
import type { Snippet } from 'svelte'
import { tv, type VariantProps } from 'tailwind-variants'
import { cn } from '#lib/utils/cn.ts'

export const badgeVariants = tv({
  base: 'inline-flex items-center gap-1.5 rounded-full border font-mono text-[0.72rem] font-semibold tracking-tight leading-none whitespace-nowrap',
  variants: {
    variant: {
      default: 'border-line bg-surface-2 text-ink',
      brand: 'border-brand-line bg-brand-soft text-brand-strong',
      amber: 'border-notice-line/50 bg-notice text-notice-ink',
      danger: 'border-ko/30 bg-ko-soft text-ko',
      info: 'border-info/25 bg-info-soft text-info',
      outline: 'border-line-strong bg-transparent text-muted',
      observatory: 'border-obs-line-strong bg-obs-surface-2 text-obs-ink',
      observatoryEmerald: 'border-obs-emerald/35 bg-obs-emerald/12 text-obs-emerald',
      observatoryAmber: 'border-obs-amber/35 bg-obs-amber/12 text-obs-amber',
      observatoryCobalt: 'border-obs-cobalt/35 bg-obs-cobalt/12 text-obs-cobalt',
    },
    size: {
      sm: 'px-2 py-0.5 text-[0.68rem]',
      md: 'px-2.5 py-1 text-[0.72rem]',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
})

type Variants = VariantProps<typeof badgeVariants>

let {
  variant = 'default',
  size = 'md',
  pulse = false,
  class: className = '',
  children,
}: {
  variant?: Variants['variant']
  size?: Variants['size']
  pulse?: boolean
  class?: string
  children: Snippet
} = $props()
</script>

<span class={cn(badgeVariants({ variant, size }), className)}>
  {#if pulse}<span class="live-dot" aria-hidden="true"></span>{/if}
  {@render children()}
</span>
