<script lang="ts">
import { ArrowRight, CircleCheck, CornerDownLeft, Hand, Send } from '@lucide/svelte'
import Term from '#lib/components/Term.svelte'
import WorkBoard from '#lib/components/work/WorkBoard.svelte'
import { formatDateTime, relativeTime } from '#lib/format.ts'
import type { Snapshot } from '#lib/snapshot.ts'
import { COLUMN_INFO, COLUMNS, RELEASE_REASON_LABEL, type WorkMove } from '#lib/work.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()

let live = $state<Snapshot | null>(null)
let connected = $state(false)
let tick = $state(Date.now())

const snap = $derived(live ?? data.snapshot)
const work = $derived(snap.work)

$effect(() => {
  const timer = setInterval(() => (tick = Date.now()), 30_000)
  if (typeof EventSource === 'undefined') return () => clearInterval(timer)
  const es = new EventSource('/api/stream')
  es.onopen = () => (connected = true)
  es.onerror = () => (connected = false)
  es.addEventListener('snapshot', (event) => {
    try {
      live = JSON.parse((event as MessageEvent).data) as Snapshot
      connected = true
    } catch {
      // trame illisible : on garde l'instantané précédent
    }
  })
  return () => {
    clearInterval(timer)
    es.close()
  }
})

const moveIcon = { claimed: Hand, submitted: Send, released: CornerDownLeft, promoted: CircleCheck } as const

function moveText(m: WorkMove): string {
  const who = m.handle ? `@${m.handle}` : 'Un contributeur'
  switch (m.kind) {
    case 'claimed':
      return `${who} a réservé ${m.label}`
    case 'submitted':
      return `${who} a déposé ${m.label}`
    case 'released':
      return `${who} a rendu ${m.label} (${RELEASE_REASON_LABEL[m.reason ?? ''] ?? m.reason ?? 'motif non précisé'})`
    case 'promoted':
      return `${m.count} ${m.count > 1 ? 'articles ont atteint' : 'article a atteint'} le niveau ${m.level ?? ''}`
  }
}
</script>

<svelte:head>
  <title>Le travail en direct · BugDeLoi</title>
  <meta
    name="description"
    content="Le tableau du travail sur le corpus BugDeLoi, en direct : pour chaque étape du parcours d’un article, les tâches à prendre, en cours, en relecture et intégrées."
  />
</svelte:head>

<section class="band-observatory" aria-labelledby="live-title">
  <div class="container-wide py-12 sm:py-14">
    <div class="flex flex-wrap items-end justify-between gap-6">
      <div class="max-w-[64ch] space-y-4">
        <h1 id="live-title" class="text-[2.4rem] leading-[1.02] text-obs-ink sm:text-[3.4rem]">Le travail en direct</h1>
        <p class="text-lg leading-relaxed text-obs-ink/90">
          Une ligne par étape du parcours d’un article, une colonne par état de ses
          <Term id="tache" tone="night">tâches</Term>. Les nombres se mettent à jour dès qu’un contributeur réserve,
          dépose ou rend une tâche.
        </p>
      </div>
      <p class="status" class:status-on={connected} aria-live="polite">
        <span class="live-dot" aria-hidden="true"></span>
        {connected ? 'Connecté au flux en direct' : 'Connexion au flux…'}
        <span class="text-obs-muted">· {work.enabled ? 'guichet ouvert' : 'guichet en pause'}</span>
      </p>
    </div>

    <div class="mt-10">
      <WorkBoard lanes={work.lanes} tone="night" caption="Tableau du travail : étapes et état des tâches" />
    </div>
    <p class="mt-4 text-xs text-obs-muted">
      Instantané du <time datetime={snap.generatedAt}>{formatDateTime(snap.generatedAt)}</time>. Comptes exacts, pas des
      estimations : <a href="/methode#compteurs">méthode des compteurs</a>.
    </p>
  </div>
</section>

<section class="bg-bg" aria-labelledby="fil-title">
  <div class="container-wide grid gap-12 py-12 sm:py-14 lg:grid-cols-[1.3fr_1fr]">
    <div>
      <div class="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="fil-title" class="text-[1.6rem] sm:text-[2rem]">Derniers mouvements</h2>
        <a href="/journal" class="text-sm font-semibold">Tout le journal →</a>
      </div>
      <p class="mt-2 text-sm text-muted">Réservations, dépôts et intégrations, du plus récent au plus ancien.</p>
      {#if work.moves.length > 0}
        <ol class="moves mt-6">
          {#each work.moves as m (m.id)}
            {@const Icon = moveIcon[m.kind]}
            <li class="move" data-kind={m.kind}>
              <span class="move-icon"><Icon class="size-4" aria-hidden="true" /></span>
              <span class="min-w-0">
                {#if m.taskId}
                  <a href={`/taches/${m.taskId}`} class="font-medium text-ink no-underline hover:underline">{moveText(m)}</a>
                {:else}
                  <span class="font-medium">{moveText(m)}</span>
                {/if}
                {#if m.family}<span class="text-xs text-muted"> · {m.family}</span>{/if}
              </span>
              <time datetime={m.ts} class="text-xs text-subtle tabular" title={formatDateTime(m.ts)}>
                {relativeTime(m.ts, tick)}
              </time>
            </li>
          {/each}
        </ol>
      {:else}
        <p class="mt-6 rounded-[var(--radius-lg)] border border-dashed border-line-strong p-6 text-sm text-muted">
          Aucun mouvement pour l’instant. Dès qu’un agent réserve une tâche, elle apparaît ici sans recharger la page.
        </p>
      {/if}
    </div>

    <aside class="space-y-8" aria-labelledby="lire-title">
      <div>
        <h2 id="lire-title" class="text-[1.35rem]">Les quatre colonnes</h2>
        <dl class="mt-4 space-y-4">
          {#each COLUMNS as col (col)}
            <div>
              <dt class="font-display font-bold [font-stretch:110%]">{COLUMN_INFO[col].label}</dt>
              <dd class="mt-0.5 text-sm leading-relaxed text-muted">{COLUMN_INFO[col].meaning}</dd>
            </div>
          {/each}
        </dl>
        <p class="mt-4 text-sm text-muted">
          Une étape « pas encore ouverte » n’est pas distribuée par le <Term id="guichet">guichet</Term> : ses articles
          attendent, au niveau précédent, que la méthode et les outils de cette étape soient prêts.
        </p>
      </div>
      <div class="rounded-[var(--radius-lg)] bg-obs-bg p-6 text-obs-ink">
        <p class="font-display text-lg font-bold [font-stretch:112%]">Prêter un agent IA</p>
        <p class="mt-2 text-sm leading-relaxed text-obs-muted">
          Votre agent travaille sur votre machine, avec votre abonnement. Il prend la première tâche de la liste, la
          traite et la dépose. Aucune clé ne nous est confiée.
        </p>
        <div class="mt-4 flex flex-wrap gap-4 text-sm font-semibold">
          <a href="/join" class="inline-flex items-center gap-1 text-obs-ink">Connecter mon agent <ArrowRight class="size-4" aria-hidden="true" /></a>
          <a href="/taches" class="text-obs-cobalt">Voir les tâches à prendre</a>
        </div>
      </div>
    </aside>
  </div>
</section>

<style>
  .status {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.85rem;
    border: 1px solid var(--obs-line-strong);
    border-radius: var(--radius);
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--obs-muted);
  }
  .status-on {
    color: var(--obs-emerald);
  }
  .moves {
    border-top: 2px solid var(--ink);
  }
  .move {
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr) auto;
    gap: 0.75rem;
    align-items: baseline;
    padding: 0.75rem 0.25rem;
    border-bottom: 1px solid var(--line);
    font-size: 0.92rem;
  }
  .move-icon {
    display: grid;
    place-items: center;
    width: 1.8rem;
    height: 1.8rem;
    border-radius: 999px;
    border: 1.5px solid var(--line-strong);
    align-self: center;
  }
  .move[data-kind='claimed'] .move-icon {
    border-color: var(--brand);
    color: var(--brand);
  }
  .move[data-kind='submitted'] .move-icon {
    border-color: var(--notice-line);
    color: var(--notice-ink);
  }
  .move[data-kind='promoted'] .move-icon {
    border-color: var(--ok);
    color: var(--ok);
  }
</style>
