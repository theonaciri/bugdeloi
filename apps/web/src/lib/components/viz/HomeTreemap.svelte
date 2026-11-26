<script lang="ts">
import { ArrowUpRight, Search, Sparkles } from '@lucide/svelte'
import { SegmentedControl, Switch } from '#lib/components/ui/index.ts'
import { formatInt, plural } from '#lib/format.ts'
import { describeCounts, dominantLevel, levelName, levelSlug, patternUrl, totalOf } from '#lib/levels.ts'
import { nodeHref } from '#lib/map-links.ts'
import {
  buildMapTree,
  groupHeader,
  layoutTreemap,
  levelBands,
  type MapArticleRow,
  type MapCountRow,
  type MapSectionRow,
  type TreemapRect,
} from '#lib/map-tree.ts'

export interface CodeMapPreview {
  code: string
  codeTitle: string
  inForce: number
  refCount: number
  focus: { id: string; path: string; title: string; isRoot: boolean }
  sections: MapSectionRow[]
  counts: MapCountRow[]
  articles: MapArticleRow[]
}

let {
  previews,
  onOpenSearch,
}: {
  previews: CodeMapPreview[]
  onOpenSearch?: () => void
} = $props()

let selectedCode = $state<string | undefined>(undefined)
let highlightRef = $state(false)
let width = $state(1240)
let active = $state<TreemapRect | null>(null)

const activeCode = $derived(selectedCode ?? previews[0]?.code ?? 'CGI')
const current = $derived(previews.find((p) => p.code === activeCode) ?? previews[0])
const tree = $derived(
  current ? buildMapTree(current.focus, current.sections, current.counts, current.articles) : null,
)
const W = $derived(Math.max(300, Math.round(width)))
const H = $derived(Math.round(Math.max(360, Math.min(580, W * 0.44))))
const rects = $derived(tree ? layoutTreemap(tree, W, H) : [])

const CHAR = 6.5
function fit(text: string, px: number): string {
  const max = Math.floor((px - 10) / CHAR)
  if (max < 3) return ''
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}
const rw = (r: TreemapRect) => r.x1 - r.x0
const rh = (r: TreemapRect) => r.y1 - r.y0
const hasRef = (r: TreemapRect) => (r.node.counts.REF ?? 0) > 0
</script>

{#if current && tree}
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <SegmentedControl
        value={activeCode}
        onchange={(next) => (selectedCode = next)}
        ariaLabel="Choisir un code à explorer sur la carte"
        tone="observatory"
        size="sm"
        options={previews.map((p) => ({
          value: p.code,
          label: p.code,
          badge: formatInt(p.inForce),
        }))}
      />

      <div class="flex flex-wrap items-center gap-4">
        <Switch bind:checked={highlightRef} tone="observatory" label="Mettre en avant les ★" />
        {#if onOpenSearch}
          <button
            type="button"
            onclick={onOpenSearch}
            class="inline-flex h-9 items-center gap-2 rounded-full bg-obs-surface px-4 text-xs text-obs-muted transition-colors hover:bg-obs-surface-2 hover:text-obs-ink cursor-pointer"
          >
            <Search class="size-3.5" aria-hidden="true" />
            <span>Trouver un article…</span>
            <kbd class="mono rounded bg-obs-bg px-1.5 py-0.5 text-[0.65rem] text-obs-ink">/</kbd>
          </button>
        {/if}
        <a
          href={`/carte?code=${current.code}`}
          class="inline-flex items-center gap-1.5 text-sm font-semibold text-obs-emerald no-underline hover:underline"
        >
          Ouvrir en plein écran
          <ArrowUpRight class="size-4" aria-hidden="true" />
        </a>
      </div>
    </div>

    <div class="relative overflow-hidden rounded-[var(--radius-lg)] bg-obs-surface p-2" bind:clientWidth={width}>
      <svg
        viewBox="0 0 {W} {H}"
        width={W}
        height={H}
        class="block h-auto max-w-full select-none"
        role="img"
        aria-label={`Carte interactive du ${current.codeTitle} : ${formatInt(current.inForce)} articles en vigueur dont ${formatInt(current.refCount)} marqués ★ Référence.`}
      >
        {#each rects as r (r.node.path)}
          {#if !r.leaf}
            <a
              href={nodeHref(current.code, r.node)}
              class="bdl-tile"
              onpointerenter={() => (active = r)}
              onfocus={() => (active = r)}
            >
              <rect
                x={r.x0}
                y={r.y0}
                width={rw(r)}
                height={rh(r)}
                class="bdl-frame"
                opacity={highlightRef && !hasRef(r) ? 0.3 : 1}
              />
              <text
                x={r.x0 + 6}
                y={r.y0 + groupHeader(r.depth) - 5}
                class="bdl-text"
                font-size={r.depth === 1 ? 11.5 : 10.5}
                font-weight={r.depth === 1 ? 600 : 500}
                opacity={highlightRef && !hasRef(r) ? 0.4 : 0.95}
              >
                {fit(`${r.node.label} · ${formatInt(totalOf(r.node.counts))}`, rw(r))}
              </text>
              <rect
                x={r.x0}
                y={r.y0}
                width={rw(r)}
                height={rh(r)}
                class="bdl-tile-hl"
                class:is-active={active === r}
                fill="none"
              />
            </a>
          {:else}
            {@const dom = levelSlug(dominantLevel(r.node.counts))}
            {@const dimmed = highlightRef && !hasRef(r)}
            <a
              href={nodeHref(current.code, r.node)}
              class="bdl-tile"
              onpointerenter={() => (active = r)}
              onfocus={() => (active = r)}
            >
              <g opacity={dimmed ? 0.2 : 1}>
                {#each levelBands(r.x0, r.y0, rw(r), rh(r), r.node.counts) as b (b.level)}
                  <rect x={b.x} y={b.y} width={b.width} height={b.height} class="lvl-fill-{levelSlug(b.level)}" />
                  {#if patternUrl(b.level)}
                    <rect x={b.x} y={b.y} width={b.width} height={b.height} fill={patternUrl(b.level)} />
                  {/if}
                {/each}
                <rect x={r.x0} y={r.y0} width={rw(r)} height={rh(r)} fill="none" class="bdl-tile-stroke" stroke-width="1" />
                {#if highlightRef && hasRef(r)}
                  <rect
                    x={r.x0 + 1.5}
                    y={r.y0 + 1.5}
                    width={Math.max(0, rw(r) - 3)}
                    height={Math.max(0, rh(r) - 3)}
                    fill="none"
                    stroke="var(--obs-amber)"
                    stroke-width="2"
                  />
                {/if}
                {#if rw(r) > 48 && rh(r) > 22}
                  <text x={r.x0 + 6} y={r.y0 + 16} font-size="11.5" font-weight="600" class="tile-label lvl-ink-{dom} lvl-halo-{dom}">
                    {fit(r.node.label, rw(r))}
                  </text>
                  {#if rh(r) > 38}
                    <text x={r.x0 + 6} y={r.y0 + 31} font-size="10.5" class="tile-label lvl-ink-{dom} lvl-halo-{dom}">
                      {fit(
                        r.node.counts.REF > 0
                          ? `${formatInt(totalOf(r.node.counts))} · ${r.node.counts.REF} ★`
                          : formatInt(totalOf(r.node.counts)),
                        rw(r),
                      )}
                    </text>
                  {/if}
                {/if}
                <rect
                  x={r.x0}
                  y={r.y0}
                  width={rw(r)}
                  height={rh(r)}
                  class="bdl-tile-hl"
                  class:is-active={active === r}
                  fill="none"
                />
              </g>
            </a>
          {/if}
        {/each}
      </svg>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-4 pt-1 text-sm">
      {#if active}
        <div class="min-w-0">
          <p class="font-semibold text-obs-ink truncate">{active.node.label}</p>
          <p class="text-xs text-obs-muted">
            {#if active.node.kind === 'article' && active.node.level}
              {levelName(active.node.level)} · cliquer pour ouvrir l’article
            {:else}
              {plural(totalOf(active.node.counts), 'article en vigueur', 'articles en vigueur')} ({describeCounts(active.node.counts)}) · cliquer pour explorer cette section
            {/if}
          </p>
        </div>
      {:else}
        <p class="text-xs text-obs-muted">
          <strong class="text-obs-ink">{current.codeTitle}.</strong> Survolez une section pour voir le détail, cliquez pour plonger dans les articles.
        </p>
      {/if}
      <span class="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-obs-amber tabular">
        <Sparkles class="size-3.5" aria-hidden="true" />
        {formatInt(current.refCount)} ★ sur {formatInt(current.inForce)} articles
      </span>
    </div>
  </div>
{/if}
