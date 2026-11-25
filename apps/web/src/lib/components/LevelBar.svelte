<script lang="ts">
/** Barre empilée de la répartition par niveau (décorative ; le tableau voisin porte les valeurs). */
import { LEVELS, type LevelCounts, levelSlug, patternUrl, totalOf } from '#lib/levels.ts'

let { counts }: { counts: LevelCounts } = $props()
const segments = $derived.by(() => {
  const total = totalOf(counts)
  let x = 0
  return LEVELS.filter((l) => counts[l] > 0).map((level) => {
    const w = total > 0 ? (counts[level] / total) * 100 : 0
    const seg = { level, x, w, slug: levelSlug(level), pattern: patternUrl(level) }
    x += w
    return seg
  })
})
</script>

<svg class="block h-5 w-full" aria-hidden="true" focusable="false" preserveAspectRatio="none">
  <rect x="0" y="0" width="100%" height="100%" class="bdl-track" />
  {#each segments as s (s.level)}
    <rect x="{s.x}%" y="0" width="{s.w}%" height="100%" class="lvl-fill-{s.slug}" />
    {#if s.pattern}<rect x="{s.x}%" y="0" width="{s.w}%" height="100%" fill={s.pattern} />{/if}
  {/each}
</svg>
