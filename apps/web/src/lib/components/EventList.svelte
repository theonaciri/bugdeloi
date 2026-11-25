<script lang="ts">
import { eventLabel, formatDateTime } from '#lib/format.ts'
import { isLegiarti } from '#lib/ids.ts'
import type { PublicEvent } from '#lib/snapshot.ts'
import EmptyState from './EmptyState.svelte'

let { events }: { events: PublicEvent[] } = $props()
</script>

{#if events.length === 0}
  <EmptyState title="Aucun événement pour l’instant.">
    Le journal public se remplira à la première ingestion des textes officiels et au premier rejeu des tests de
    référence.
  </EmptyState>
{:else}
  <ol class="divide-y divide-line rounded-lg border border-line bg-surface">
    {#each events as e (e.id)}
      <li class="grid gap-x-4 gap-y-0.5 px-4 py-3 sm:grid-cols-[11rem_1fr]">
        <time datetime={e.ts} class="text-sm text-muted">{formatDateTime(e.ts)}</time>
        <div>
          <p class="font-medium">
            {eventLabel(e.type)}
            {#if e.subject}
              ·
              {#if isLegiarti(e.subject)}
                <a href="/article/{e.subject}" class="mono text-sm">{e.subject}</a>
              {:else}
                <span class="mono text-sm">{e.subject}</span>
              {/if}
            {/if}
          </p>
          {#if e.summary}<p class="text-sm text-muted">{e.summary}</p>{/if}
          <p class="text-xs text-muted">par <span class="mono">{e.actor}</span> · <span class="mono">{e.type}</span></p>
        </div>
      </li>
    {/each}
  </ol>
{/if}
