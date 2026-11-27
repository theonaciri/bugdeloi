<script lang="ts">
import { plural } from '#lib/format.ts'
import { describeCounts, dominantLevel, levelName, levelSlug, patternUrl, totalOf } from '#lib/levels.ts'
import { nodeHref } from '#lib/map-links.ts'
import { groupHeader, layoutTreemap, levelBands, type MapNode, type TreemapRect } from '#lib/map-tree.ts'

let { root, code }: { root: MapNode; code: string } = $props()

// Rendu serveur à 1000 px de large ; côté navigateur, on recalcule à la largeur réelle pour garder
// des étiquettes lisibles sur mobile (le SVG n'est pas étiré).
let width = $state(1000)
const W = $derived(Math.max(280, Math.round(width)))
const H = $derived(Math.round(Math.max(360, Math.min(680, W * 0.62))))
const rects = $derived(layoutTreemap(root, W, H))
let active = $state<TreemapRect | null>(null)

const CHAR = 6.6
function fit(text: string, px: number): string {
  const max = Math.floor((px - 10) / CHAR)
  if (max < 3) return ''
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}
const w = (r: TreemapRect) => r.x1 - r.x0
const h = (r: TreemapRect) => r.y1 - r.y0
</script>

<div class="relative" bind:clientWidth={width}>
  <svg viewBox="0 0 {W} {H}" width={W} height={H} class="block h-auto max-w-full select-none" aria-hidden="true" focusable="false">
    {#each rects as r (r.node.path)}
      {#if !r.leaf}
        <a href={nodeHref(code, r.node)} tabindex="-1" class="bdl-tile" onpointerenter={() => (active = r)}>
          <rect x={r.x0} y={r.y0} width={w(r)} height={h(r)} class="bdl-frame" />
          <text x={r.x0 + 5} y={r.y0 + groupHeader(r.depth) - 5} class="bdl-text" font-size={r.depth === 1 ? 12 : 11} font-weight={r.depth === 1 ? 600 : 500}>
            {fit(`${r.node.label} · ${totalOf(r.node.counts)}`, w(r))}
          </text>
          <rect x={r.x0} y={r.y0} width={w(r)} height={h(r)} class="bdl-tile-hl" class:is-active={active === r} fill="none" />
        </a>
      {:else}
        {@const dom = levelSlug(dominantLevel(r.node.counts))}
        <a href={nodeHref(code, r.node)} tabindex="-1" class="bdl-tile" onpointerenter={() => (active = r)}>
          {#each levelBands(r.x0, r.y0, w(r), h(r), r.node.counts) as b (b.level)}
            <rect x={b.x} y={b.y} width={b.width} height={b.height} class="lvl-fill-{levelSlug(b.level)}" />
            {#if patternUrl(b.level)}
              <rect x={b.x} y={b.y} width={b.width} height={b.height} fill={patternUrl(b.level)} />
            {/if}
          {/each}
          <rect x={r.x0} y={r.y0} width={w(r)} height={h(r)} fill="none" class="bdl-tile-stroke" stroke-width="1" />
          {#if r.node.flags?.includes('contested')}
            <rect x={r.x0 + 2} y={r.y0 + 2} width={Math.max(0, w(r) - 4)} height={Math.max(0, h(r) - 4)} class="bdl-contested" />
          {/if}
          {#if w(r) > 44 && h(r) > 22}
            <text x={r.x0 + 5} y={r.y0 + 15} font-size="12" font-weight="600" class="tile-label lvl-ink-{dom} lvl-halo-{dom}">
              {fit(r.node.label, w(r))}
            </text>
            {#if h(r) > 40}
              <text x={r.x0 + 5} y={r.y0 + 31} font-size="11" class="tile-label lvl-ink-{dom} lvl-halo-{dom}">
                {fit(r.node.kind === 'article' && r.node.level ? levelName(r.node.level) : String(totalOf(r.node.counts)), w(r))}
              </text>
            {/if}
          {/if}
          <rect x={r.x0} y={r.y0} width={w(r)} height={h(r)} class="bdl-tile-hl" class:is-active={active === r} fill="none" />
        </a>
      {/if}
    {/each}
  </svg>

  <div class="mt-2 min-h-[3.5rem] rounded-md border border-line bg-surface px-3 py-2 text-sm" aria-hidden="true">
    {#if active}
      <p class="font-semibold">{active.node.label}</p>
      <p class="text-muted">
        {#if active.node.kind === 'article' && active.node.level}
          {levelName(active.node.level)}{active.node.flags?.includes('contested') ? ' · contesté' : ''} · cliquez pour consulter l’article
        {:else}
          {plural(totalOf(active.node.counts), 'article en vigueur', 'articles en vigueur')} : {describeCounts(active.node.counts)}
          · cliquez pour ouvrir cette section
        {/if}
      </p>
    {:else}
      <p class="text-muted">Survolez une tuile pour afficher le détail. Cliquez pour ouvrir la section ou l’article.</p>
    {/if}
  </div>
</div>
