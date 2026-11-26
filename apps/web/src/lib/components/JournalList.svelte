<script lang="ts">
import { eventHref, journalGroupLabel } from '#lib/events.ts'
import { formatDateTime, formatInt, formatLegiDate, formatParisDay, formatTime } from '#lib/format.ts'
import type { JournalEntry } from '#lib/snapshot.ts'
import EmptyState from './EmptyState.svelte'

let { entries }: { entries: JournalEntry[] } = $props()
</script>

{#if entries.length === 0}
  <EmptyState title="Aucune activité enregistrée.">Les opérations apparaîtront ici au fur et à mesure.</EmptyState>
{:else}
  <ol class="divide-y divide-line border-y border-line">
    {#each entries as entry (entry.id)}
      {@const latest = entry.events[0]}
      {@const earliest = entry.events.at(-1)}
      {#if latest && earliest}
        <li class="grid gap-x-5 gap-y-1 py-3 sm:grid-cols-[11rem_1fr]">
          {#if entry.events.length > 1}
            {@const start = formatTime(earliest.ts)}
            {@const end = formatTime(latest.ts)}
            <time datetime={formatParisDay(latest.ts)} class="text-sm text-muted">{formatLegiDate(formatParisDay(latest.ts))}</time>
            <details>
              <summary class="cursor-pointer font-semibold">
                {formatInt(entry.events.length)} {journalGroupLabel(entry.type)} {start === end ? `à ${end}` : `entre ${start} et ${end}`}
              </summary>
              <ul class="mt-2 space-y-1.5 pl-5">
                {#each entry.events as event (event.id)}
                  <li>
                    <a href={eventHref(event.id)} class="font-medium">{event.headline}</a>
                    <span class="text-xs text-muted"> · <time datetime={event.ts}>{formatTime(event.ts)}</time></span>
                  </li>
                {/each}
              </ul>
            </details>
          {:else}
            <time datetime={latest.ts} class="text-sm text-muted">{formatDateTime(latest.ts)}</time>
            <div>
              <a href={eventHref(latest.id)} class="font-semibold">
                {latest.headline}
              </a>
              {#if latest.detail}
                <p class="mt-0.5 text-sm text-muted">{latest.detail}</p>
              {/if}
            </div>
          {/if}
        </li>
      {/if}
    {/each}
  </ol>
{/if}
