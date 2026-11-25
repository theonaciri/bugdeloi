<script lang="ts">
import { type Level, levelSlug, patternUrl } from '#lib/levels.ts'

let { level, size = 18 }: { level: Level; size?: number } = $props()
const slug = $derived(levelSlug(level))
const pattern = $derived(patternUrl(level))
</script>

<svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true" focusable="false" class="inline-block shrink-0 align-[-0.2em]">
  <rect x="0.5" y="0.5" width="17" height="17" rx="3" class="lvl-fill-{slug} bdl-stroke" />
  {#if pattern}
    <rect x="0.5" y="0.5" width="17" height="17" rx="3" fill={pattern} />
  {/if}
</svg>
