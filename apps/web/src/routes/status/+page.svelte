<script lang="ts">
import EmptyState from '#lib/components/EmptyState.svelte'
import EventList from '#lib/components/EventList.svelte'
import { replayStatus } from '#lib/events.ts'
import { formatDateTime, formatLegiDate, plural } from '#lib/format.ts'
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

<section class="bg-bg">
  <div class="container-wide space-y-4 py-12 sm:py-16">
    <h1 class="text-4xl tracking-tight sm:text-5xl">État du service</h1>
    <p class="text-lg font-semibold">{h.database.ok ? 'Tout fonctionne normalement' : 'La base des textes est temporairement inaccessible'}</p>
    <p class="text-sm text-muted">Relevé du <time datetime={data.generatedAt}>{formatDateTime(data.generatedAt)}</time> · <a href="/api/status.json">Données pour le suivi automatique</a></p>
  </div>
</section>

<section class="bg-surface border-t border-line" aria-label="Indicateurs du service">
  <div class="container-wide py-10 sm:py-14">
    <dl class="max-w-3xl divide-y divide-line border-y border-line">
      <div class="py-5">
        <dt class="font-semibold">Base de données des textes</dt>
        <dd class="mt-1">
          {#if h.database.ok}
            <span class="font-semibold text-ok">Joignable</span>
            <span class="text-muted">· réponse en {h.database.latencyMs} ms</span>
          {:else}
            <span class="font-semibold text-ko">Injoignable</span>
            <span class="block text-sm text-muted">Les données peuvent être temporairement indisponibles.</span>
          {/if}
        </dd>
      </div>

      <div class="py-5">
        <dt class="font-semibold">Dernière mise à jour des textes officiels</dt>
        <dd class="mt-1">
          {#if h.lastIngest}
            <p>
              <span class="font-semibold">{runLabel[h.lastIngest.status] ?? 'Résultat non renseigné'}</span>
              · source {h.lastIngest.source} · démarré le {formatDateTime(h.lastIngest.startedAt)}
              {#if h.lastIngest.finishedAt}, terminé le {formatDateTime(h.lastIngest.finishedAt)}{/if}
            </p>
            <p class="font-mono wrap-anywhere text-xs text-muted">{h.lastIngest.archive}</p>
            <ul class="mt-2 space-y-1 text-sm text-muted">
              {#each Object.entries(h.lastIngest.stats).filter(([key]) => key.endsWith('.active')) as [key, count] (key)}
                {@const code = key.split('.')[0]}
                {@const versions = h.lastIngest.stats[`${code}.versions`]}
                <li>{code} · {plural(count, 'article en vigueur', 'articles en vigueur')}{#if versions !== undefined} · {plural(versions, 'version enregistrée', 'versions enregistrées')}{/if}</li>
              {/each}
            </ul>
          {:else if h.database.ok}
            <EmptyState title="Aucun chargement enregistré." />
          {:else}
            <span class="text-muted">Inconnue (base injoignable).</span>
          {/if}
        </dd>
      </div>

      <div class="py-5">
        <dt class="font-semibold">Dernier rejeu des programmes de référence (Inria)</dt>
        <dd class="mt-1">
          {#if h.lastReplication}
            <p>
              <span class="font-semibold">{replayStatus(h.lastReplication.status)}</span>
              · démarré le {formatDateTime(h.lastReplication.startedAt)}
            </p>
            <p class="font-mono wrap-anywhere text-xs text-muted">{h.lastReplication.subject}</p>
          {:else if h.database.ok}
            <EmptyState title="Aucune exécution enregistrée." />
          {:else}
            <span class="text-muted">Inconnu (base injoignable).</span>
          {/if}
        </dd>
      </div>

      <div class="py-5">
        <dt class="font-semibold">Dernier contrôle automatique des articles</dt>
        <dd class="mt-1">
          {#if h.lastSweep}
            <p>
              <span class="font-semibold">{runLabel[h.lastSweep.status] ?? 'Résultat non renseigné'}</span>
              · démarré le {formatDateTime(h.lastSweep.startedAt)}
              {#if h.lastSweep.finishedAt}, terminé le {formatDateTime(h.lastSweep.finishedAt)}{/if}
            </p>
            <p class="mt-2 text-sm">{plural(sweepTotal, 'article en vigueur contrôlé', 'articles en vigueur contrôlés')}</p>
            <ul class="mt-1 space-y-1 text-sm text-muted">
              {#each h.lastSweep.codes as code (code)}
                {@const date = h.lastSweep.asOf[code]}
                <li>{code} · {plural(h.lastSweep.articlesChecked[code] ?? 0, 'article contrôlé', 'articles contrôlés')}{#if date} au {formatLegiDate(date)}{/if}</li>
              {/each}
            </ul>
            <ul class="mt-1 flex flex-wrap gap-x-4 text-sm text-muted">
              {#each Object.entries(h.lastSweep.detectors) as [name, version] (name)}<li class="font-mono">{name}@{version}</li>{/each}
            </ul>
            <p class="mt-1 text-xs text-muted">
              Les signalements doivent faire l’objet d’un contrôle indépendant et d’une relecture humaine avant qualification.
            </p>
          {:else if h.database.ok}
            <EmptyState title="Aucun contrôle automatique enregistré." />
          {:else}
            <span class="text-muted">Inconnu (base injoignable).</span>
          {/if}
        </dd>
      </div>

      <div class="py-5">
        <dt class="font-semibold">Mises à jour en direct</dt>
        <dd class="mt-1 text-sm">
          {data.stream.listening ? 'Le service surveille les nouvelles entrées' : 'Le service attend une première connexion pour surveiller le journal'}
          · {plural(data.stream.clients, 'connexion ouverte', 'connexions ouvertes')}
        </dd>
      </div>
    </dl>
  </div>
</section>

<section class="bg-bg border-t border-line" aria-labelledby="journal">
  <div class="container-wide space-y-5 py-12 sm:py-16">
    <h2 id="journal" class="text-2xl sm:text-3xl">Dernières opérations enregistrées</h2>
    {#if h.database.ok}
      <EventList events={data.events} />
    {:else}
      <p class="text-muted">Le journal est temporairement indisponible.</p>
    {/if}
  </div>
</section>
