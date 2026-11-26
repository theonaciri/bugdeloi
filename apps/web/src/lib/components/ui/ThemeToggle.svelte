<script lang="ts">
import { Monitor, Moon, Sun } from '@lucide/svelte'
import { Button as UiButton } from '@ui-sdk/svelte/button'
import { cn } from '#lib/utils/cn.ts'

type Theme = 'system' | 'light' | 'dark'

const KEY = 'bugdeloi-theme'
const ORDER: Theme[] = ['system', 'light', 'dark']
const LABELS: Record<Theme, string> = {
  system: 'Thème système',
  light: 'Thème clair',
  dark: 'Thème sombre',
}

let theme = $state<Theme>('system')

function apply(next: Theme) {
  theme = next
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (next === 'system') {
    delete root.dataset.theme
  } else {
    root.dataset.theme = next
  }
  try {
    if (next === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, next)
  } catch {
    // stockage local indisponible
  }
}

$effect(() => {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') {
      apply(saved)
    }
  } catch {
    // stockage local indisponible
  }
})

function cycle() {
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length] ?? 'system'
  apply(next)
}

let { class: className = '' }: { class?: string } = $props()
</script>

<UiButton
  type="button"
  aria-label={`${LABELS[theme]} (cliquer pour changer)`}
  title={LABELS[theme]}
  onclick={cycle}
  class={cn(
    'inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-medium text-ink transition-colors hover:bg-surface-2 hover:border-line-strong cursor-pointer',
    className,
  )}
>
  {#if theme === 'dark'}
    <Moon class="size-3.5" aria-hidden="true" />
    <span class="hidden sm:inline">Sombre</span>
  {:else if theme === 'light'}
    <Sun class="size-3.5" aria-hidden="true" />
    <span class="hidden sm:inline">Clair</span>
  {:else}
    <Monitor class="size-3.5" aria-hidden="true" />
    <span class="hidden sm:inline">Auto</span>
  {/if}
</UiButton>
