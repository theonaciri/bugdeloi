<script lang="ts">
/**
 * Alternative accessible de la treemap : arbre de navigation (motif « Navigation Treeview » de
 * l'APG WAI-ARIA). Sans JavaScript, c'est une simple liste de liens imbriqués, entièrement
 * dépliée. Une fois le script chargé : tabulation unique (roving tabindex), flèches pour se
 * déplacer, → / ← pour déplier / replier, Début / Fin, Entrée pour suivre le lien.
 */
import { onMount } from 'svelte'
import { plural } from '#lib/format.ts'
import { describeCounts, levelName, totalOf } from '#lib/levels.ts'
import { nodeHref } from '#lib/map-links.ts'
import type { MapNode } from '#lib/map-tree.ts'
import LevelSwatch from './LevelSwatch.svelte'

let { root, code, label }: { root: MapNode; code: string; label: string } = $props()

let enhanced = $state(false)
let expanded = $state<Record<string, boolean>>({})
let current = $state<string | null>(null)
let container: HTMLUListElement | undefined = $state()

onMount(() => {
  enhanced = true
})

interface Item {
  node: MapNode
  level: number
  parent: string | null
}

/** Éléments visibles, dans l'ordre d'affichage (pour la navigation au clavier). */
const visible = $derived.by(() => {
  const out: Item[] = []
  const walk = (nodes: MapNode[], level: number, parent: string | null) => {
    for (const node of nodes) {
      out.push({ node, level, parent })
      if (node.children.length && (!enhanced || expanded[node.path]))
        walk(node.children, level + 1, node.path)
    }
  }
  walk(root.children, 1, null)
  return out
})
const focusable = $derived(current ?? visible[0]?.node.path ?? null)

function focusPath(path: string) {
  current = path
  queueMicrotask(() => container?.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`)?.focus())
}

function onkeydown(e: KeyboardEvent) {
  if (!enhanced) return
  const idx = visible.findIndex((i) => i.node.path === (e.target as HTMLElement).dataset.path)
  const item = visible[idx]
  if (!item) return
  const has = item.node.children.length > 0
  const go = (i: number) => {
    const target = visible[i]
    if (target) focusPath(target.node.path)
  }
  switch (e.key) {
    case 'ArrowDown':
      go(idx + 1)
      break
    case 'ArrowUp':
      go(idx - 1)
      break
    case 'Home':
      go(0)
      break
    case 'End':
      go(visible.length - 1)
      break
    case 'ArrowRight':
      if (has && !expanded[item.node.path]) expanded[item.node.path] = true
      else if (has) go(idx + 1)
      else return
      break
    case 'ArrowLeft':
      if (has && expanded[item.node.path]) expanded[item.node.path] = false
      else if (item.parent) focusPath(item.parent)
      else return
      break
    case '*':
      for (const i of visible)
        if (i.level === item.level && i.node.children.length) expanded[i.node.path] = true
      break
    default:
      return
  }
  e.preventDefault()
}

function toggle(e: MouseEvent, node: MapNode) {
  e.preventDefault()
  expanded[node.path] = !expanded[node.path]
  current = node.path
}

function summary(node: MapNode): string {
  if (node.kind === 'article') return node.level ? levelName(node.level) : ''
  return `${plural(totalOf(node.counts), 'article en vigueur', 'articles en vigueur')} — ${describeCounts(node.counts)}`
}
</script>

{#snippet branch(nodes: MapNode[], level: number)}
  {#each nodes as node, i (node.path)}
    {@const has = node.children.length > 0}
    {@const open = !enhanced || !!expanded[node.path]}
    <li role={enhanced ? 'none' : undefined} class="my-0.5">
      <div class="flex items-start gap-1">
        {#if has}
          <button
            type="button"
            tabindex="-1"
            class="mt-0.5 w-6 shrink-0 rounded text-center text-muted hover:bg-surface-2"
            class:invisible={!enhanced}
            aria-hidden="true"
            onclick={(e) => toggle(e, node)}>{open ? '▾' : '▸'}</button
          >
        {:else}
          <span class="w-6 shrink-0"></span>
        {/if}
        <a
          href={nodeHref(code, node)}
          data-path={node.path}
          role={enhanced ? 'treeitem' : undefined}
          aria-level={enhanced ? level : undefined}
          aria-setsize={enhanced ? nodes.length : undefined}
          aria-posinset={enhanced ? i + 1 : undefined}
          aria-expanded={enhanced && has ? open : undefined}
          tabindex={enhanced ? (focusable === node.path ? 0 : -1) : undefined}
          onfocus={() => (current = node.path)}
          class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 rounded px-1 py-0.5 no-underline hover:bg-surface-2"
        >
          {#if node.kind === 'article' && node.level}<LevelSwatch level={node.level} size={14} />{/if}
          <span class="underline">{node.label}</span>
          <span class="text-sm text-muted">{summary(node)}</span>
          {#if node.flags?.includes('contested')}<span class="text-sm font-semibold">· contesté</span>{/if}
        </a>
      </div>
      {#if has && open}
        <ul role={enhanced ? 'group' : undefined} class="ml-6 border-l border-line pl-2">
          {@render branch(node.children, level + 1)}
        </ul>
      {/if}
    </li>
  {/each}
{/snippet}

{#if root.children.length === 0}
  <p class="text-muted">Cette section ne contient aucune sous-section ni aucun article en vigueur.</p>
{:else}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <ul bind:this={container} role={enhanced ? 'tree' : undefined} aria-label={label} {onkeydown}>
    {@render branch(root.children, 1)}
  </ul>
{/if}
