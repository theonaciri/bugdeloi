<script lang="ts">
import EmptyState from '#lib/components/EmptyState.svelte'
import EventList from '#lib/components/EventList.svelte'
import { replayStatus } from '#lib/events.ts'
import { formatDateTime, formatInt } from '#lib/format.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()
const h = $derived(data.health)
const sweepTotal = $derived(Object.values(h.lastSweep?.articlesChecked ?? {}).reduce((a, b) => a + b, 0))
const runLabel: Record<string, string> = {
  running: 'en cours',
  success: 'terminé avec succès',
  failed: 'en échec',
  error: 'interrompu par une erreur',
}
</script>

<svelte:head>
  <title>État du service · BugDeLoi</title>
</svelte:head>

<div class="container-page mt-8 max-w-3xl">
  <h1 class="text-3xl font-semibold">État du service</h1>
  <p class="mt-2 text-muted">Relevé du {formatDateTime(data.generatedAt)}. Version lisible par une machine : <a href="/api/status.json">/api/status.json</a>.</p>

  <dl class="mt-6 divide-y divide-line border-y border-line">
    <div class="py-4">
      <dt class="font-semibold">Base de données</dt>
      <dd class="mt-1">
        {#if h.database.ok}
          <span class="font-semibold text-ok">● Joignable</span>
          <span class="text-muted">· réponse en {h.database.latencyMs} ms</span>
        {:else}
          <span class="font-semibold text-ko">● Injoignable</span>
          <span class="block text-sm text-muted">Les pages de données affichent un message d’erreur plutôt que des chiffres.</span>
        {/if}
      </dd>
    </div>

    <div class="py-4">
      <dt class="font-semibold">Dernier chargement des textes officiels</dt>
      <dd class="mt-1">
        {#if h.lastIngest}
          <p>
            <span class="font-semibold">{runLabel[h.lastIngest.status] ?? 'Résultat non renseigné'}</span> <code class="text-xs text-muted">{h.lastIngest.status}</code>
            · source {h.lastIngest.source} · démarré le {formatDateTime(h.lastIngest.startedAt)}
            {#if h.lastIngest.finishedAt}, terminé le {formatDateTime(h.lastIngest.finishedAt)}{/if}
          </p>
          <p class="mono break-all text-xs text-muted">{h.lastIngest.archive}</p>
          {#if Object.keys(h.lastIngest.stats).length}
            <ul class="mt-1 flex flex-wrap gap-x-4 text-sm text-muted">
              {#each Object.entries(h.lastIngest.stats) as [k, v] (k)}<li><span class="mono">{k}</span> : {formatInt(v)}</li>{/each}
            </ul>
          {/if}
        {:else if h.database.ok}
          <EmptyState title="Aucun chargement enregistré." />
        {:else}
          <span class="text-muted">Inconnue (base injoignable).</span>
        {/if}
      </dd>
    </div>

    <div class="py-4">
      <dt class="font-semibold">Dernière exécution des tests de référence</dt>
      <dd class="mt-1">
        {#if h.lastReplication}
          <p>
            <span class="font-semibold">{replayStatus(h.lastReplication.status)}</span>
            · démarré le {formatDateTime(h.lastReplication.startedAt)}
          </p>
          <p class="mono break-all text-xs text-muted">{h.lastReplication.status} · {h.lastReplication.subject}</p>
        {:else if h.database.ok}
          <EmptyState title="Aucune exécution enregistrée." />
        {:else}
          <span class="text-muted">Inconnu (base injoignable).</span>
        {/if}
      </dd>
    </div>

    <div class="py-4">
      <dt class="font-semibold">Dernier contrôle automatique des textes</dt>
      <dd class="mt-1">
        {#if h.lastSweep}
          <p>
            <span class="font-semibold">{runLabel[h.lastSweep.status] ?? 'Résultat non renseigné'}</span> <code class="text-xs text-muted">{h.lastSweep.status}</code>
            · démarré le {formatDateTime(h.lastSweep.startedAt)}
            {#if h.lastSweep.finishedAt}, terminé le {formatDateTime(h.lastSweep.finishedAt)}{/if}
          </p>
          <p class="mt-1 text-sm">
            {formatInt(sweepTotal)} articles en vigueur contrôlés
            <span class="text-muted">
              ({#each h.lastSweep.codes as code, i (code)}{i > 0 ? ', ' : ''}{code} {formatInt(h.lastSweep.articlesChecked[code] ?? 0)}, projection au {h.lastSweep.asOf[code] ?? '?'}{/each})
            </span>
          </p>
          <ul class="mt-1 flex flex-wrap gap-x-4 text-sm text-muted">
            {#each Object.entries(h.lastSweep.detectors) as [name, version] (name)}<li class="mono">{name}@{version}</li>{/each}
          </ul>
          <p class="mt-1 text-xs text-muted">
            Les signalements de ce contrôle passent par une reproduction indépendante et une relecture humaine avant qualification.
          </p>
        {:else if h.database.ok}
          <EmptyState title="Aucun contrôle automatique enregistré." />
        {:else}
          <span class="text-muted">Inconnu (base injoignable).</span>
        {/if}
      </dd>
    </div>

    <div class="py-4">
      <dt class="font-semibold">Flux temps réel</dt>
      <dd class="mt-1 text-sm">
        {data.stream.listening ? 'Le service surveille les nouvelles entrées.' : 'Le service attend une première connexion pour surveiller le journal.'}
        Connexions ouvertes · {formatInt(data.stream.clients)}
      </dd>
    </div>
  </dl>

  {#if h.database.ok}
    <section class="mt-10" aria-labelledby="journal">
      <h2 id="journal" class="mb-3 text-2xl font-semibold">Derniers événements</h2>
      <EventList events={data.events} />
    </section>
  {/if}
</div>
