<script lang="ts">
import type { Snippet } from 'svelte'

let { title, children }: { title: string; children?: Snippet } = $props()
</script>

<div class="rounded-xl border border-dashed border-line bg-surface/70 px-5 py-4">
  <p class="font-semibold text-ink">{title}</p>
  {#if children}<div class="mt-1.5 text-sm leading-relaxed text-muted">{@render children()}</div>{/if}
</div>
