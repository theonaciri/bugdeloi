<script lang="ts">
import { Button as UiButton } from '@ui-sdk/svelte/button'
import type { Snippet } from 'svelte'
import { tv, type VariantProps } from 'tailwind-variants'
import { cn } from '#lib/utils/cn.ts'

export const buttonVariants = tv({
  base: [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold',
    'rounded-full border transition-colors duration-150 cursor-pointer no-underline select-none',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:size-4 [&_svg]:shrink-0',
  ],
  variants: {
    variant: {
      primary: 'border-transparent bg-brand text-brand-ink hover:bg-brand-strong shadow-xs',
      ink: 'border-transparent bg-ink text-bg hover:opacity-90 shadow-xs',
      secondary: 'border-line bg-surface text-ink hover:bg-surface-2 hover:border-line-strong shadow-xs',
      outline: 'border-line-strong bg-transparent text-ink hover:bg-surface-2',
      ghost: 'border-transparent bg-transparent text-ink hover:bg-surface-2',
      soft: 'border-brand-line bg-brand-soft text-brand-strong hover:brightness-95',
      observatory: 'border-obs-emerald/40 bg-obs-emerald text-obs-bg hover:brightness-110 font-bold',
      observatoryOutline:
        'border-obs-line-strong bg-obs-surface text-obs-ink hover:bg-obs-surface-2 hover:border-obs-muted',
      observatoryGhost: 'border-transparent bg-transparent text-obs-ink hover:bg-obs-surface-2',
      destructive: 'border-transparent bg-ko text-white hover:opacity-90',
    },
    size: {
      xs: 'h-7 px-2.5 text-xs',
      sm: 'h-8.5 px-3.5 text-xs',
      md: 'h-10 px-4.5 text-sm',
      lg: 'h-11 px-6 text-sm',
      icon: 'size-9 p-0',
      iconSm: 'size-8 p-0',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
})

type Variants = VariantProps<typeof buttonVariants>

let {
  variant = 'primary',
  size = 'md',
  href,
  rel,
  target,
  type = 'button',
  disabled = false,
  class: className = '',
  ariaLabel,
  title,
  onclick,
  children,
}: {
  variant?: Variants['variant']
  size?: Variants['size']
  href?: string
  rel?: string
  target?: string
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  class?: string
  ariaLabel?: string
  title?: string
  onclick?: (event: MouseEvent) => unknown
  children: Snippet
} = $props()

const classes = $derived(cn(buttonVariants({ variant, size }), className))
</script>

{#if href}
  <a
    {href}
    {rel}
    {target}
    aria-label={ariaLabel}
    {title}
    class={classes}
    {onclick}
  >
    {@render children()}
  </a>
{:else}
  <UiButton
    {type}
    {disabled}
    aria-label={ariaLabel}
    {title}
    class={classes}
    onclick={(event) => onclick?.(event)}
  >
    {@render children()}
  </UiButton>
{/if}
