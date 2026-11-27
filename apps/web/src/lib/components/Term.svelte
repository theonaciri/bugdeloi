<script lang="ts">
import { HoverCardContent, HoverCardTrigger, HoverCard as UiHoverCard } from '@ui-sdk/svelte/hover-card'
import type { Snippet } from 'svelte'
import { glossary } from '#lib/glossary.ts'

/**
 * Terme défini au glossaire unique (`lib/glossary.ts`). Lien vers /methode#g-<id> ;
 * la définition s'ouvre au survol ou au focus clavier. Sans JS, le lien reste utile.
 */
let { id, children, tone = 'paper' }: { id: string; children?: Snippet; tone?: 'paper' | 'night' } = $props()
const entry = $derived(glossary(id))
</script>

<UiHoverCard delay={160} closeDelay={140}>
  <HoverCardTrigger
    href={`/methode#g-${id}`}
    class={tone === 'night'
      ? 'term term-night cursor-help text-inherit no-underline'
      : 'term cursor-help text-inherit no-underline'}
  >
    {#if children}{@render children()}{:else}{entry.term}{/if}
  </HoverCardTrigger>
  <HoverCardContent
    side="top"
    sideOffset={8}
    class="z-50 w-[min(20rem,calc(100vw-2rem))] rounded-[var(--radius-lg)] border border-line bg-surface p-4 text-left text-sm font-normal normal-case tracking-normal text-ink shadow-[var(--shadow-lg)]"
  >
    <p class="font-display text-[0.95rem] font-bold [font-stretch:110%]">{entry.term}</p>
    <p class="mt-1.5 leading-relaxed text-ink">{entry.short}</p>
    {#if entry.more}<p class="mt-2 text-xs leading-relaxed text-muted">{entry.more}</p>{/if}
    {#if entry.technical}
      <p class="mt-2 text-xs text-subtle">Dans le code : <code class="text-ink">{entry.technical}</code></p>
    {/if}
  </HoverCardContent>
</UiHoverCard>

<style>
  :global(.term) {
    text-decoration-line: underline;
    text-decoration-style: dotted;
    text-decoration-thickness: 1.5px;
    text-underline-offset: 0.22em;
    text-decoration-color: color-mix(in oklab, var(--brand) 70%, transparent);
  }
  :global(.term:hover) {
    text-decoration-style: solid;
    text-decoration-color: var(--brand);
  }
  :global(.term-night) {
    text-decoration-color: color-mix(in oklab, var(--obs-cobalt) 80%, transparent);
  }
</style>
