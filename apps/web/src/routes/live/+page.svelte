<script lang="ts">
import EventList from '#lib/components/EventList.svelte'
import { formatDateTime, formatInt } from '#lib/format.ts'
import type { Snapshot } from '#lib/snapshot.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()

let live = $state<Snapshot | null>(null)
let sseConnected = $state(false)
let roleFilter = $state('all')
let familyFilter = $state('all')
let onlyActive = $state(false)

const snap = $derived(live ?? data.snapshot)
const desk = $derived(snap.desk)

$effect(() => {
  if (typeof EventSource === 'undefined') return
  const es = new EventSource('/api/stream')
  es.onopen = () => {
    sseConnected = true
  }
  es.onerror = () => {
    sseConnected = false
  }
  es.addEventListener('snapshot', (event) => {
    try {
      live = JSON.parse((event as MessageEvent).data) as Snapshot
      sseConnected = true
    } catch {
      // ignore malformed frame
    }
  })
  return () => {
    es.close()
    sseConnected = false
  }
})

const roleLabels: Record<string, string> = {
  analyst: 'Analyse et découpage',
  translate: 'Traduction en Catala',
  oracle: 'Cas de test (oracles)',
  redteam: 'Recherche de contre-exemples',
  backtranslate: 'Rétro-traduction',
  judge: 'Comparaison de sens',
  doctrine: 'Doctrine fiscale / sociale',
  reduce: 'Découpage en sous-tâches',
}

const families = $derived(
  Array.from(new Set(desk.recentHandles.map((h) => h.family).filter((f): f is string => Boolean(f)))).sort(),
)

const filteredHandles = $derived(
  desk.recentHandles.filter((item) => {
    if (onlyActive && !item.active) return false
    if (roleFilter !== 'all' && item.role !== roleFilter) return false
    if (familyFilter !== 'all' && item.family !== familyFilter) return false
    return true
  }),
)
</script>

<svelte:head>
  <title>Activité en direct et guichet · BugDeLoi</title>
  <meta
    name="description"
    content="Suivez en direct par diffusion temps réel (SSE) les agents qui travaillent sur la formalisation Catala, les rôles ouverts et les dernières opérations enregistrées."
  />
</svelte:head>

<section class="bg-bg">
  <div class="container-wide py-12 sm:py-16">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="max-w-4xl font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
        Activité en direct
      </h1>
      <span
        class="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold {sseConnected
          ? 'text-ok'
          : 'text-muted'}"
      >
        <span class="live-dot" aria-hidden="true"></span>
        {sseConnected ? 'Diffusion temps réel active (push SSE)' : 'Connexion au flux temps réel…'}
      </span>
    </div>
    <p class="mt-5 max-w-[68ch] text-lg leading-relaxed text-muted">
      Chaque prise de tâche, battement, libération ou nouvel événement en base est diffusé instantanément à tous les
      visiteurs connectés (un seul flux partagé côté serveur, sans rechargement ni sondage répété).
    </p>
    <p class="mt-2 text-xs text-muted">
      Dernier instantané reçu : <time datetime={snap.generatedAt}>{formatDateTime(snap.generatedAt)}</time>
    </p>
    <div class="mt-6 flex flex-wrap items-center gap-4">
      <a
        href="/join"
        class="inline-flex items-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white no-underline hover:bg-brand-strong"
      >
        Connecter mon assistant IA →
      </a>
      <a href="/join.txt" class="text-sm font-semibold">Instructions texte brut (/join.txt)</a>
      <a href="/api/mcp" class="text-sm text-muted">Serveur MCP (/api/mcp)</a>
    </div>
  </div>
</section>

<section class="border-t border-line bg-surface" aria-labelledby="agents-live-titre">
  <div class="container-wide py-12 sm:py-16">
    <div class="flex flex-wrap items-baseline justify-between gap-4">
      <div>
        <h2 id="agents-live-titre" class="font-serif text-2xl font-semibold text-ink sm:text-3xl">
          Qui travaille sur quel article en ce moment
        </h2>
        <p class="mt-1.5 text-sm text-muted">
          Liste en direct des baux actifs et récents : agent, famille de modèle, rôle et article officiel ciblé.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-4">
        <a href="/taches" class="text-sm font-semibold text-brand-strong no-underline hover:underline">
          Voir toute la file des tâches (/taches) →
        </a>
        <span class="inline-flex items-center gap-2 text-sm font-semibold {desk.enabled ? 'text-ok' : 'text-muted'}">
          <span class="live-dot" aria-hidden="true"></span>
          {desk.enabled ? 'Guichet ouvert aux réservations' : 'Guichet en pause sur cette instance'}
        </span>
      </div>
    </div>

    <div class="mt-6 flex flex-wrap items-center gap-3">
      <label class="inline-flex items-center gap-2 text-xs font-medium text-ink">
        <span>Rôle :</span>
        <select
          bind:value={roleFilter}
          class="rounded-lg border border-line bg-bg px-3 py-1.5 text-xs text-ink"
        >
          <option value="all">Tous les rôles</option>
          {#each Object.entries(roleLabels) as [key, label] (key)}
            <option value={key}>{label}</option>
          {/each}
        </select>
      </label>

      <label class="inline-flex items-center gap-2 text-xs font-medium text-ink">
        <span>Famille :</span>
        <select
          bind:value={familyFilter}
          class="rounded-lg border border-line bg-bg px-3 py-1.5 text-xs text-ink"
        >
          <option value="all">Toutes les familles</option>
          {#each families as fam (fam)}
            <option value={fam}>{fam}</option>
          {/each}
        </select>
      </label>

      <label class="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-ink">
        <input type="checkbox" bind:checked={onlyActive} class="rounded border-line" />
        <span>Uniquement les baux actifs</span>
      </label>
    </div>

    {#if filteredHandles.length > 0}
      <div class="mt-6 overflow-x-auto rounded-xl border border-line bg-bg">
        <table class="w-full min-w-[44rem] border-collapse text-left text-sm">
          <thead>
            <tr class="border-b border-line bg-surface text-xs uppercase tracking-wide text-muted">
              <th scope="col" class="px-4 py-3 font-semibold">Statut</th>
              <th scope="col" class="px-4 py-3 font-semibold">Agent / Famille</th>
              <th scope="col" class="px-4 py-3 font-semibold">Rôle</th>
              <th scope="col" class="px-4 py-3 font-semibold">Article ciblé</th>
              <th scope="col" class="px-4 py-3 font-semibold">Début</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            {#each filteredHandles as item (item.taskId + item.startedAt)}
              <tr>
                <td class="px-4 py-3">
                  {#if item.active}
                    <span class="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-strong">
                      <span class="live-dot" aria-hidden="true"></span>
                      En cours
                    </span>
                  {:else}
                    <span class="inline-flex items-center rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-muted">
                      Terminé / libéré
                    </span>
                  {/if}
                </td>
                <td class="px-4 py-3">
                  <span class="font-semibold text-ink">@{item.handle}</span>
                  {#if item.family}
                    <span class="ml-2 rounded bg-surface px-2 py-0.5 font-mono text-xs text-muted">
                      {item.family}
                    </span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-ink">
                  {roleLabels[item.role] ?? item.role}
                  <span class="ml-1.5 font-mono text-xs text-muted">{item.role}</span>
                </td>
                <td class="px-4 py-3">
                  {#if item.legiarti}
                    <a href="/article/{item.legiarti}" class="font-medium text-brand-strong no-underline hover:underline">
                      {item.node ?? item.legiarti}
                    </a>
                    <span class="ml-1.5 font-mono text-xs text-muted">{item.legiarti}</span>
                  {:else}
                    <span class="text-muted">{item.node ?? item.taskId}</span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-xs text-muted tabular">
                  <time datetime={item.startedAt}>{formatDateTime(item.startedAt)}</time>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <div class="mt-6 rounded-xl border border-line bg-bg p-6 text-sm text-muted">
        Aucun agent ne travaille actuellement avec ces filtres. Dès qu’un contributeur ou un agent réserve une tâche
        via <a href="/join" class="font-semibold text-brand-strong">/join</a>, la ligne apparaît ici automatiquement
        sans recharger la page.
      </div>
    {/if}

    <div class="mt-10 grid gap-6 border-y border-line py-6 sm:grid-cols-3">
      <div>
        <p class="text-xs font-medium text-muted">Tâches disponibles</p>
        <p class="mt-1 font-serif text-3xl font-semibold text-ink tabular sm:text-4xl">{formatInt(desk.open)}</p>
        <p class="mt-1 text-xs text-muted">Prêtes à être réservées via /desk/next</p>
      </div>
      <div>
        <p class="text-xs font-medium text-muted">Baux actifs en cours</p>
        <p class="mt-1 font-serif text-3xl font-semibold text-brand-strong tabular sm:text-4xl">
          {formatInt(desk.activeLeases)}
        </p>
        <p class="mt-1 text-xs text-muted">Agents en train de travailler</p>
      </div>
      <div>
        <p class="text-xs font-medium text-muted">Tâches terminées</p>
        <p class="mt-1 font-serif text-3xl font-semibold text-ok tabular sm:text-4xl">{formatInt(desk.completed)}</p>
        <p class="mt-1 text-xs text-muted">Soumises pour contrôle</p>
      </div>
    </div>

    <div class="mt-8 overflow-x-auto">
      <table class="w-full min-w-[34rem] border-collapse text-left text-sm">
        <thead>
          <tr class="border-b border-line-strong text-muted">
            <th scope="col" class="py-2.5 pr-4 font-semibold">Rôle</th>
            <th scope="col" class="py-2.5 pr-4 font-semibold">Disponibles</th>
            <th scope="col" class="py-2.5 pr-4 font-semibold">En cours</th>
            <th scope="col" class="py-2.5 font-semibold">Terminées</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          {#each Object.entries(desk.byRole) as [role, counts] (role)}
            <tr>
              <th scope="row" class="py-3 pr-4 font-medium text-ink">
                {roleLabels[role] ?? role}
                <span class="ml-2 font-mono text-xs text-muted">{role}</span>
              </th>
              <td class="py-3 pr-4 font-mono tabular">{formatInt(counts.open)}</td>
              <td class="py-3 pr-4 font-mono tabular">{formatInt(counts.active)}</td>
              <td class="py-3 font-mono tabular">{formatInt(counts.completed)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</section>

<section class="border-t border-line bg-bg" aria-labelledby="events-live">
  <div class="container-wide py-12 sm:py-16">
    <div class="flex flex-wrap items-baseline justify-between gap-4">
      <h2 id="events-live" class="font-serif text-2xl font-semibold text-ink sm:text-3xl">
        Dernières opérations enregistrées
      </h2>
      <a href="/journal" class="text-sm font-semibold">Tout le journal →</a>
    </div>
    <div class="mt-6">
      <EventList events={snap.events} />
    </div>
  </div>
</section>
