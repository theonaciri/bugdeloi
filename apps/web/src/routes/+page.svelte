<script lang="ts">
import CallToAction from '#lib/components/CallToAction.svelte'
import EmptyState from '#lib/components/EmptyState.svelte'
import JournalList from '#lib/components/JournalList.svelte'
import LevelBar from '#lib/components/LevelBar.svelte'
import ProgressBar from '#lib/components/ProgressBar.svelte'
import { formatDateTime, formatInt, formatLegiDate, plural } from '#lib/format.ts'
import { addCounts, emptyLevelCounts } from '#lib/levels.ts'
import type { Snapshot } from '#lib/snapshot.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()

let live = $state<Snapshot | null>(null)
const snap = $derived(live ?? data.snapshot)
const example = $derived(snap?.referenceExample)
const totals = $derived.by(() => {
  const counts = emptyLevelCounts()
  for (const code of snap?.codes ?? []) addCounts(counts, code.byLevel)
  return counts
})
const inForceTotal = $derived((snap?.codes ?? []).reduce((total, code) => total + code.inForce, 0))
const otherReferences = $derived(totals.REF - (example ? 1 : 0))
const referenceLinkLabel = $derived(
  example
    ? otherReferences === 1
      ? 'l’autre article'
      : `les ${plural(otherReferences, 'autre article', 'autres articles')}`
    : otherReferences === 1
      ? 'l’article'
      : `les ${plural(otherReferences, 'article')}`,
)

// Abonnement temps réel (SSE) avec repli en polling toutes les 30 s.
$effect(() => {
  let es: EventSource | null = null
  let poll: ReturnType<typeof setInterval> | null = null
  const refresh = async () => {
    try {
      const r = await fetch('/api/snapshot.json', { headers: { accept: 'application/json' } })
      if (r.ok) live = (await r.json()) as Snapshot
    } catch {
      // réseau indisponible : on réessaie au prochain tour
    }
  }
  const startPolling = () => {
    poll ??= setInterval(refresh, 30_000)
  }
  const stopPolling = () => {
    if (poll) clearInterval(poll)
    poll = null
  }
  if (typeof EventSource === 'undefined') {
    startPolling()
  } else {
    es = new EventSource('/api/stream')
    es.addEventListener('snapshot', (e) => {
      try {
        live = JSON.parse((e as MessageEvent<string>).data) as Snapshot
        stopPolling()
      } catch {
        // message illisible : ignoré
      }
    })
    es.onerror = () => startPolling()
  }
  return () => {
    es?.close()
    stopPolling()
  }
})
</script>

<svelte:head>
  <title>BugDeLoi — des textes de loi aux règles de calcul</title>
  <meta name="description" content="Découvrez un article de loi, le programme qui applique sa règle et les résultats des tests relancés par BugDeLoi." />
</svelte:head>

<section class="border-b border-line bg-surface" aria-labelledby="accueil">
  <div class="container-page py-8 sm:py-11">
    <h1 id="accueil" class="max-w-4xl text-4xl font-semibold sm:text-5xl">Que montre BugDeLoi aujourd’hui ?</h1>
    {#if snap}
      <div class="mt-5 max-w-[68ch] space-y-2 text-lg">
        <p>Nous avons chargé <strong class="font-semibold">{plural(inForceTotal, 'article en vigueur', 'articles en vigueur')}</strong> depuis les sources officielles.</p>
        {#if totals.REF}
          <p><strong class="font-semibold">{plural(totals.REF, 'article porte', 'articles portent')}</strong> une étoile ★ pour un lien avec des programmes de chercheurs ou d’une administration dont nous avons relancé les tests avec succès.</p>
        {:else}
          <p>L’étoile ★ signalera les articles reliés aux programmes de chercheurs ou d’une administration dont nous aurons relancé les tests avec succès.</p>
        {/if}
        <p>Nos contrôles ont signalé <strong class="font-semibold">{formatInt(snap.findings.pendingReview)} cas</strong> encore à examiner. Chaque publication exige une relecture humaine.</p>
      </div>
      <p class="mt-4 text-sm text-muted">Un compte, pas une probabilité. <a href="/methode#compteurs">Comment sont calculés ces chiffres ?</a></p>
    {:else}
      <div class="mt-5">
        <EmptyState title="Les chiffres sont temporairement indisponibles.">
          Consultez <a href="/status">l’état du service</a>.
        </EmptyState>
      </div>
    {/if}
  </div>
</section>

{#if snap}
  <div class="container-page mt-8 space-y-12 sm:mt-10">
    <section aria-labelledby="exemple">
      {#if example}
        <h2 id="exemple" class="text-3xl font-semibold">{example.title}</h2>
        <p class="mt-1 text-muted">{example.codeTitle} · <a href={`/article/${example.id}`}>Article {example.num ?? 'sans numéro'}</a></p>

        <div class="mt-4 grid divide-y divide-line overflow-hidden rounded-lg border border-line md:grid-cols-2 md:divide-x md:divide-y-0">
          <div class="bg-surface p-4 sm:p-5">
            <h3 class="font-semibold">Le texte officiel</h3>
            <blockquote cite={example.legifranceUrl} class="mt-2 border-l-2 border-line-strong pl-3 font-serif text-lg wrap-anywhere">
              {@html example.textHtml}
            </blockquote>
            <p class="mt-3 text-sm text-muted"><a href={example.legifranceUrl}>Lire sur Légifrance</a>{#if example.versionDate}{' · version du '}{formatLegiDate(example.versionDate)}{/if}</p>
          </div>
          <div class="p-4 sm:p-5">
            <h3 class="font-semibold">Le programme d’Inria, institut de recherche en informatique</h3>
            <p class="mt-2">{example.description}</p>
            <p class="mt-3 text-sm"><a href={example.sourceUrl}>Voir le fichier source sur GitHub</a></p>
          </div>
        </div>
        <p class="mt-4">
          <strong class="font-semibold">Rejeu réussi</strong> · {plural(example.tests, 'test de la suite relancé', 'tests de la suite relancés')} le
          <time datetime={example.replayDate}>{formatDateTime(example.replayDate)}</time>.
          <a class="text-sm" href="/methode#compteur-rejeux">Méthode</a>
        </p>
        <p class="mt-2">C’est ce que BugDeLoi veut faire pour tous les articles calculables.</p>
      {:else}
        <h2 id="exemple" class="text-2xl font-semibold">Un exemple de règle de calcul</h2>
        <p class="mt-2">Aucun exemple documenté n’est disponible pour le moment.</p>
      {/if}
      {#if otherReferences > 0}
        <p class="mt-3">
          <a href={example ? `/references?sauf=${example.id}` : '/references'}>
            Voir {referenceLinkLabel} ★
          </a>
        </p>
      {/if}
    </section>

    <section aria-labelledby="journal">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="journal" class="text-2xl font-semibold">Dernières nouvelles</h2>
        <a href="/journal">Voir tout le journal</a>
      </div>
      <div class="mt-3"><JournalList entries={snap.journal} /></div>
    </section>

    <section aria-labelledby="avancement">
      <h2 id="avancement" class="text-2xl font-semibold">Les programmes de référence par code</h2>
      <ul class="mt-3 divide-y divide-line border-y border-line">
        {#each snap.codes as code (code.id)}
          <li class="py-3">
            <p><strong>{code.title}</strong> · {#if code.ingested}
              {formatInt(code.byLevel.REF)} sur {plural(code.inForce, 'article en vigueur', 'articles en vigueur')} avec des tests relancés avec succès.
            {:else}
              Textes à charger.
            {/if}</p>
            {#if code.inForce}
              <div class="mt-2"><ProgressBar value={code.byLevel.REF} max={code.inForce} /></div>
            {/if}
          </li>
        {/each}
      </ul>
      <p class="mt-2 text-sm"><a href="/methode#compteur-avancement">Calcul de cette répartition</a> · <a href="/carte">Explorer les textes</a></p>
    </section>

    <section aria-labelledby="suivi">
      <h2 id="suivi" class="text-2xl font-semibold">Comment le projet avance</h2>
      <p class="mt-2"><a href="/methode#cycle">Du premier signalement à la décision humaine</a></p>
      {#if inForceTotal > 0}
        <details class="mt-3">
          <summary class="cursor-pointer font-medium">Répartition des articles selon les contrôles effectués</summary>
          <div class="mt-2"><LevelBar counts={totals} /></div>
          <p class="mt-2 text-sm"><a href="/methode#niveaux">Ce que signifie chaque niveau</a></p>
        </details>
      {/if}
    </section>
  </div>
{/if}

<section class="container-page mt-12" aria-labelledby="aider">
  <div class="card grid gap-4 p-6 md:grid-cols-[1fr_auto] md:items-center">
    <div>
      <h2 id="aider" class="text-2xl font-semibold">Aider le projet</h2>
      <p class="mt-1 text-muted">Découvrez comment contribuer aux travaux ou soutenir les frais du projet à l’ouverture des contributions.</p>
    </div>
    <CallToAction />
  </div>
</section>
