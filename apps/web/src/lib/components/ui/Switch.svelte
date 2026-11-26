<script lang="ts">
import { SwitchThumb, Switch as UiSwitch } from '@ui-sdk/svelte/switch'
import { cn } from '#lib/utils/cn.ts'

let {
  checked = $bindable(false),
  label,
  description,
  disabled = false,
  tone = 'light',
  class: className = '',
  onchange,
}: {
  checked?: boolean
  label: string
  description?: string
  disabled?: boolean
  tone?: 'light' | 'observatory'
  class?: string
  onchange?: (value: boolean) => void
} = $props()

const id = $props.id()
</script>

<div class={cn('inline-flex items-center gap-3', className)}>
  <UiSwitch
    {id}
    bind:checked
    {disabled}
    aria-label={label}
    onCheckedChange={(value) => onchange?.(value)}
    class={cn(
      'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 transition-colors cursor-pointer',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      tone === 'observatory'
        ? 'border-obs-line-strong bg-obs-surface-2 data-[checked]:bg-obs-emerald data-[checked]:border-obs-emerald'
        : 'border-line-strong bg-surface-2 data-[checked]:bg-brand data-[checked]:border-brand',
    )}
  >
    <SwitchThumb
      class={cn(
        'block size-4.5 rounded-full shadow-xs transition-transform duration-150 translate-x-0 data-[checked]:translate-x-5',
        tone === 'observatory' ? 'bg-obs-ink data-[checked]:bg-obs-bg' : 'bg-surface',
      )}
    />
  </UiSwitch>
  <label for={id} class="cursor-pointer select-none">
    <span class={cn('block text-sm font-medium', tone === 'observatory' ? 'text-obs-ink' : 'text-ink')}>
      {label}
    </span>
    {#if description}
      <span class={cn('block text-xs', tone === 'observatory' ? 'text-obs-muted' : 'text-muted')}>
        {description}
      </span>
    {/if}
  </label>
</div>
