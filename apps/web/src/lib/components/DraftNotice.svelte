<script lang="ts">
import type { Snippet } from 'svelte'

let { milestone = 'J3', children }: { milestone?: string; children?: Snippet } = $props()
</script>

<div class="rounded-lg border-2 border-dashed border-notice-line bg-notice p-4 text-notice-ink" role="note">
  <p class="font-bold">Pas encore ouvert — jalon {milestone}</p>
  {#if children}<div class="mt-1">{@render children()}</div>{/if}
</div>
