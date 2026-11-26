<script lang="ts">
import type { Snippet } from 'svelte'

let { milestone = 'J3', children }: { milestone?: string; children?: Snippet } = $props()
</script>

<div class="rounded-xl border border-notice-line/50 bg-notice/60 px-5 py-4 text-notice-ink" role="note">
  <p class="font-semibold">Pas encore ouvert (étape prévue : {milestone})</p>
  {#if children}<div class="mt-1.5 text-sm leading-relaxed">{@render children()}</div>{/if}
</div>
