<script lang="ts">
import { Clock } from '@lucide/svelte'
import { explainEvent } from '#lib/events.ts'
import { formatDateTime } from '#lib/format.ts'
import type { PublicEvent } from '#lib/snapshot.ts'

const KEY = 'bugdeloi-last-visit-v1'

let {
  events,
}: {
  events: PublicEvent[]
} = $props()

interface VisitStamp {
  lastEventId: number
  visitedAt: string
}

let previous = $state<VisitStamp | null>(null)
let hydrated = $state(false)

$effect(() => {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<VisitStamp>
      if (typeof parsed.lastEventId === 'number' && typeof parsed.visitedAt === 'string') {
        previous = { lastEventId: parsed.lastEventId, visitedAt: parsed.visitedAt }
      }
    }
    const latestId = events[0]?.id ?? 0
    localStorage.setItem(KEY, JSON.stringify({ lastEventId: latestId, visitedAt: new Date().toISOString() }))
  } catch {
    // stockage local indisponible
  }
  hydrated = true
})

const unseen = $derived.by(() => {
  const prev = previous
  return prev ? events.filter((e) => e.id > prev.lastEventId) : []
})
</script>

<article class="flex h-full flex-col justify-between rounded-[var(--radius-xl)] bg-surface-2/70 p-7 sm:p-8">
  <div>
    <h2 class="flex items-center gap-2 font-serif text-2xl font-semibold text-ink">
      <Clock class="size-4.5 text-brand" aria-hidden="true" />
      Depuis votre dernière visite
    </h2>
    {#if !hydrated || !previous}
      <p class="mt-3 text-sm leading-relaxed text-muted">
        Première visite sur cet appareil. Dès votre prochain passage, cette zone listera les nouvelles opérations publiées depuis aujourd’hui.
      </p>
    {:else if unseen.length === 0}
      <p class="mt-3 text-sm leading-relaxed text-muted">
        Aucune nouvelle opération publique depuis le <time datetime={previous.visitedAt}>{formatDateTime(previous.visitedAt)}</time>.
      </p>
    {:else}
      <p class="mt-3 text-sm leading-relaxed text-muted">
        <strong class="text-ink">{unseen.length}</strong> nouvel{unseen.length > 1 ? 'les avancées' : 'le avancée'} depuis le
        <time datetime={previous.visitedAt}>{formatDateTime(previous.visitedAt)}</time>.
      </p>
      <ul class="mt-4 divide-y divide-line text-sm">
        {#each unseen.slice(0, 4) as ev (ev.id)}
          <li class="py-2">
            <a href={`/evenement/${ev.id}`} class="font-medium text-ink no-underline hover:text-brand-strong hover:underline">
              {explainEvent(ev.type).title}
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
  <p class="mt-6 text-xs text-muted">
    Mémorisé localement dans votre navigateur, sans cookie ni suivi.
  </p>
</article>
