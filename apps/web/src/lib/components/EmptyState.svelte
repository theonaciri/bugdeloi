<script lang="ts">
import type { Snippet } from 'svelte'

let { title, children }: { title: string; children?: Snippet } = $props()
</script>

<div class="rounded-lg border border-dashed border-line-strong bg-surface-2 p-4">
  <p class="font-semibold">{title}</p>
  {#if children}<div class="mt-1 text-sm text-muted">{@render children()}</div>{/if}
</div>
