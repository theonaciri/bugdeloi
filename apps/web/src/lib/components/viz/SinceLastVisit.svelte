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

<article class="flex h-full flex-col justify-between rounded-[var(--radius-lg)] border border-line bg-surface p-5 shadow-xs">
  <div>
    <p class="kicker flex items-center gap-1.5">
      <Clock class="size-3.5 text-brand" aria-hidden="true" />
      Depuis votre dernière visite
    </p>
    {#if !hydrated || !previous}
      <p class="mt-3 font-serif text-lg leading-snug text-ink">
        C’est votre première visite sur ce navigateur. Dès la prochaine, cette carte résumera les nouvelles opérations vérifiées depuis aujourd’hui.
      </p>
    {:else if unseen.length === 0}
      <p class="mt-3 font-serif text-lg leading-snug text-ink">
        Aucun nouvel événement public depuis votre passage du <time datetime={previous.visitedAt}>{formatDateTime(previous.visitedAt)}</time>.
      </p>
    {:else}
      <p class="mt-3 font-serif text-lg leading-snug text-ink">
        <strong>{unseen.length}</strong> nouvel{unseen.length > 1 ? 'les entrées' : 'le entrée'} dans le journal depuis le
        <time datetime={previous.visitedAt}>{formatDateTime(previous.visitedAt)}</time>.
      </p>
      <ul class="mt-3 space-y-1.5 text-xs">
        {#each unseen.slice(0, 4) as ev (ev.id)}
          <li class="flex items-baseline justify-between gap-2 border-t border-line pt-1.5">
            <a href={`/evenement/${ev.id}`} class="font-medium text-ink no-underline hover:text-brand-strong hover:underline truncate">
              {explainEvent(ev.type).title}
            </a>
            <span class="mono shrink-0 text-[0.68rem] text-muted">#{ev.id}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
  <p class="mt-4 border-t border-line pt-3 text-[0.72rem] text-muted">
    Calculé localement dans votre navigateur (<code class="text-ink">localStorage</code>). Aucun cookie, aucun traceur.
  </p>
</article>
