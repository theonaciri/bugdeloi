<script lang="ts">
import { eventHref } from '#lib/events.ts'
import { formatDateTime } from '#lib/format.ts'
import type { PublicEvent } from '#lib/snapshot.ts'
import EmptyState from './EmptyState.svelte'

let { events }: { events: PublicEvent[] } = $props()
</script>

{#if events.length === 0}
  <EmptyState title="Aucune activité enregistrée.">
    Le journal affichera les opérations au fur et à mesure.
  </EmptyState>
{:else}
  <ol class="divide-y divide-line border-y border-line">
    {#each events as e (e.id)}
      <li>
        <a href={eventHref(e.id)} class="group grid gap-x-5 gap-y-1 px-2 py-4 no-underline hover:bg-surface focus-visible:bg-surface sm:grid-cols-[10rem_1fr]">
          <time datetime={e.ts} class="text-sm text-muted">{formatDateTime(e.ts)}</time>
          <span>
            <span class="block font-semibold group-hover:underline group-focus-visible:underline">{e.headline}</span>
            {#if e.detail}<span class="block text-sm text-ink">{e.detail}</span>{/if}
          </span>
        </a>
      </li>
    {/each}
  </ol>
{/if}
