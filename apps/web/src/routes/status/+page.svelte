<script lang="ts">
import EmptyState from '#lib/components/EmptyState.svelte'
import { formatDateTime, formatInt } from '#lib/format.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()
const h = $derived(data.health)
const sweepTotal = $derived(Object.values(h.lastSweep?.articlesChecked ?? {}).reduce((a, b) => a + b, 0))
const runLabel: Record<string, string> = {
  running: 'en cours',
  success: 'réussie',
  passed: 'réussi',
  failed: 'en échec',
  error: 'erreur',
}
</script>

<svelte:head>
  <title>État du service · BugDeLoi</title>
</svelte:head>

<div class="container-page mt-8 max-w-3xl">
  <p class="kicker">État du service</p>
  <h1 class="text-3xl font-semibold">État du service</h1>
  <p class="mt-2 text-muted">Relevé du {formatDateTime(data.generatedAt)}. Version lisible par une machine : <a href="/api/status.json">/api/status.json</a>.</p>

  <dl class="mt-6 grid gap-4">
    <div class="card p-4">
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

    <div class="card p-4">
      <dt class="font-semibold">Dernière ingestion des textes officiels</dt>
      <dd class="mt-1">
        {#if h.lastIngest}
          <p>
            <span class="font-semibold">{runLabel[h.lastIngest.status] ?? h.lastIngest.status}</span>
            · source {h.lastIngest.source} · démarrée le {formatDateTime(h.lastIngest.startedAt)}
            {#if h.lastIngest.finishedAt}, terminée le {formatDateTime(h.lastIngest.finishedAt)}{/if}
          </p>
          <p class="mono break-all text-xs text-muted">{h.lastIngest.archive}</p>
          {#if Object.keys(h.lastIngest.stats).length}
            <ul class="mt-1 flex flex-wrap gap-x-4 text-sm text-muted">
              {#each Object.entries(h.lastIngest.stats) as [k, v] (k)}<li><span class="mono">{k}</span> : {formatInt(v)}</li>{/each}
            </ul>
          {/if}
        {:else if h.database.ok}
          <EmptyState title="Aucune ingestion enregistrée." />
        {:else}
          <span class="text-muted">Inconnue (base injoignable).</span>
        {/if}
      </dd>
    </div>

    <div class="card p-4">
      <dt class="font-semibold">Dernier rejeu de référence</dt>
      <dd class="mt-1">
        {#if h.lastReplication}
          <p>
            <span class="font-semibold">{runLabel[h.lastReplication.status] ?? h.lastReplication.status}</span>
            · {h.lastReplication.kind} · démarré le {formatDateTime(h.lastReplication.startedAt)}
          </p>
          <p class="mono break-all text-xs text-muted">{h.lastReplication.subject}</p>
        {:else if h.database.ok}
          <EmptyState title="Aucun rejeu enregistré." />
        {:else}
          <span class="text-muted">Inconnu (base injoignable).</span>
        {/if}
      </dd>
    </div>

    <div class="card p-4">
      <dt class="font-semibold">Dernier balayage mécanique</dt>
      <dd class="mt-1">
        {#if h.lastSweep}
          <p>
            <span class="font-semibold">{runLabel[h.lastSweep.status] ?? h.lastSweep.status}</span>
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
            Les résultats de ce balayage sont des candidats non qualifiés : ils ne figurent dans aucun compteur public.
          </p>
        {:else if h.database.ok}
          <EmptyState title="Aucun balayage enregistré." />
        {:else}
          <span class="text-muted">Inconnu (base injoignable).</span>
        {/if}
      </dd>
    </div>

    <div class="card p-4">
      <dt class="font-semibold">Flux temps réel</dt>
      <dd class="mt-1 text-sm">
        Écoute Postgres : {data.stream.listening ? 'active' : 'inactive (démarre à la première connexion)'} · clients connectés
        à ce process : {formatInt(data.stream.clients)}
      </dd>
    </div>
  </dl>
</div>
