<script lang="ts">
import CallToAction from '#lib/components/CallToAction.svelte'
import EmptyState from '#lib/components/EmptyState.svelte'
import EventList from '#lib/components/EventList.svelte'
import LevelBar from '#lib/components/LevelBar.svelte'
import LevelSwatch from '#lib/components/LevelSwatch.svelte'
import ProgressBar from '#lib/components/ProgressBar.svelte'
import { formatDateTime, formatInt, formatShare, plural } from '#lib/format.ts'
import { addCounts, emptyLevelCounts, LEVEL_INFO, LEVELS, levelName } from '#lib/levels.ts'
import type { Snapshot } from '#lib/snapshot.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()

/** Dernier instantané reçu en direct ; à défaut, celui rendu par le serveur. */
let live = $state<Snapshot | null>(null)
let mode = $state<'ssr' | 'live' | 'polling'>('ssr')
const snap = $derived(live ?? data.snapshot)

const totals = $derived.by(() => {
  const t = emptyLevelCounts()
  for (const c of snap?.codes ?? []) addCounts(t, c.byLevel)
  return t
})
const inForceTotal = $derived((snap?.codes ?? []).reduce((s, c) => s + c.inForce, 0))
const ingestedCodes = $derived((snap?.codes ?? []).filter((c) => c.ingested))

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
    mode = 'polling'
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
        mode = 'live'
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
  <title>BugDeLoi — le droit calculable, formalisé et rejouable</title>
  <meta
    name="description"
    content="Projet citoyen indépendant : formaliser le droit calculable français en Catala, détecter des anomalies et publier des résultats que chacun peut rejouer."
  />
</svelte:head>

<section class="border-b border-line bg-surface">
  <div class="container-page py-10 sm:py-14">
    <p class="kicker">Jalon J0 · fondations en cours</p>
    <h1 class="mt-2 max-w-3xl text-3xl font-semibold sm:text-5xl">
      Le droit calculable français, formalisé et rejouable par tous.
    </h1>
    <p class="mt-4 max-w-2xl text-lg text-muted">
      BugDeLoi traduit les textes de loi en code <a href="https://catala-lang.org">Catala</a>, cherche les anomalies et
      publie chaque résultat avec un certificat que n’importe qui peut rejouer. Des agents IA proposent, le compilateur,
      des sources indépendantes et des relecteurs humains jugent.
    </p>
    <p class="mt-3 max-w-2xl">
      <strong>Où en est-on vraiment ?</strong> Au tout début. Aucun article n’est encore formalisé par le projet. Les chiffres
      ci-dessous sont lus en base à chaque visite, même quand ils valent zéro.
    </p>
    <div class="mt-6"><CallToAction /></div>
  </div>
</section>

{#if data.dbError || !snap}
  <div class="container-page mt-8">
    <EmptyState title="La base de données ne répond pas pour le moment.">
      Les compteurs ne peuvent pas être affichés : nous préférons ne rien montrer plutôt qu’un chiffre faux. Voir
      <a href="/status">l’état du service</a>.
    </EmptyState>
  </div>
{:else}
  <div class="container-page mt-10 space-y-12">
    <section aria-labelledby="avancement">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="avancement" class="text-2xl font-semibold">Avancement par code</h2>
        <p class="text-sm text-muted" aria-live="off">
          {#if mode === 'live'}<span class="font-semibold text-ok">● En direct</span>{:else if mode === 'polling'}Mise à
            jour toutes les 30 s{/if}
          · instantané du {formatDateTime(snap.generatedAt)}
        </p>
      </div>
      <p class="mt-1 text-muted">
        Part des articles en vigueur ayant atteint au moins le niveau <strong>N2 Compilé</strong>.
        <a href="/methode#compteur-avancement">Méthode</a>
      </p>
      <ul class="mt-4 grid gap-4 md:grid-cols-3">
        {#each snap.codes as code (code.id)}
          <li class="card p-4">
            <p class="flex items-baseline justify-between gap-2">
              <span class="text-lg font-semibold">{code.short}</span>
              <span class="mono text-xs text-muted">{code.id}</span>
            </p>
            <p class="text-sm text-muted">{code.title}</p>
            {#if !code.ingested}
              <p class="mt-3 font-medium">Pas encore ingéré.</p>
              <p class="text-sm text-muted">Le texte officiel de ce code n’est pas encore chargé depuis LEGI.</p>
            {:else}
              <div class="mt-3"><ProgressBar value={code.atLeastN2} max={code.inForce} /></div>
              <p class="mt-2">
                <strong>{formatShare(code.atLeastN2, code.inForce) ?? '—'}</strong>
                — {formatInt(code.atLeastN2)} sur {plural(code.inForce, 'article')} en vigueur au niveau N2 ou plus.
              </p>
              {#if code.atLeastN2 === 0}
                <p class="text-sm text-muted">Aucun article de ce code n’est encore compilé en Catala par le projet.</p>
              {/if}
              <p class="mt-1 text-sm text-muted">{plural(code.versions, 'version ingérée', 'versions ingérées')} (tous états).</p>
            {/if}
          </li>
        {/each}
      </ul>
    </section>

    <section aria-labelledby="compteurs">
      <h2 id="compteurs" class="text-2xl font-semibold">Compteurs</h2>
      <p class="mt-1 text-muted">
        <strong>Un compte, pas une probabilité.</strong> Chaque nombre est le résultat d’une requête documentée.
        <a href="/methode#compteurs">Comment ils sont calculés</a>
      </p>
      <dl class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="card p-4">
          <dt class="text-sm text-muted">Articles en vigueur ingérés</dt>
          <dd class="mt-1 text-3xl font-semibold">{formatInt(inForceTotal)}</dd>
          <dd class="mt-1 text-sm text-muted">
            {#if ingestedCodes.length === 0}Aucun code encore ingéré.{:else}Dans {ingestedCodes.map((c) => c.short).join(', ')}.{/if}
            <a href="/methode#compteur-articles">Méthode</a>
          </dd>
        </div>
        <div class="card p-4">
          <dt class="text-sm text-muted">Anomalies qualifiées par un humain</dt>
          <dd class="mt-1 text-3xl font-semibold">{formatInt(snap.findings.public)}</dd>
          <dd class="mt-1 text-sm text-muted">
            Les candidats non qualifiés ne sont jamais comptés. <a href="/methode#compteur-anomalies">Méthode</a>
          </dd>
        </div>
        <div class="card p-4">
          <dt class="text-sm text-muted">Rejeux de référence réussis</dt>
          <dd class="mt-1 text-3xl font-semibold">
            {formatInt(snap.replications.passed)}<span class="text-lg font-normal text-muted"> / {formatInt(snap.replications.total)}</span>
          </dd>
          <dd class="mt-1 text-sm text-muted">
            Suites de tests de chercheurs rejouées chez nous (réussis / terminés).
            <a href="/methode#compteur-rejeux">Méthode</a>
          </dd>
        </div>
        <div class="card p-4">
          <dt class="text-sm text-muted">Identifiants d’articles cités par la recherche</dt>
          <dd class="mt-1 text-3xl font-semibold">{formatInt(snap.coverage.cited)}</dd>
          <dd class="mt-1 text-sm text-muted">
            {#if snap.coverage.cited === 0}Pas encore relevé.{:else}Identifiants cités par {plural(snap.coverage.sources, 'formalisation')}
              de référence, dont {formatInt(snap.coverage.matched)} présents dans notre base.{/if}
            <a href="/methode#compteur-couverture">Méthode</a>
          </dd>
        </div>
      </dl>
    </section>

    <section aria-labelledby="niveaux">
      <h2 id="niveaux" class="text-2xl font-semibold">Répartition par niveau de preuve</h2>
      <p class="mt-1 text-muted">
        Articles en vigueur, tous codes confondus. Un article ingéré est au niveau N0 tant qu’aucun contrôle
        supplémentaire n’a réussi. <a href="/methode#niveaux">Ce que garantit chaque niveau</a>
      </p>
      {#if inForceTotal === 0}
        <div class="mt-4">
          <EmptyState title="Aucun article en vigueur en base.">
            La répartition apparaîtra après la première ingestion des textes officiels (jalon J1).
          </EmptyState>
        </div>
      {:else}
        <div class="mt-4"><LevelBar counts={totals} /></div>
      {/if}
      <div class="mt-4 overflow-x-auto">
        <table class="w-full min-w-[32rem] border-collapse text-left">
          <caption class="sr-only">Nombre d’articles en vigueur par niveau de preuve et par code</caption>
          <thead>
            <tr class="border-b border-line-strong">
              <th scope="col" class="py-2 pr-4">Niveau</th>
              {#each snap.codes as code (code.id)}<th scope="col" class="py-2 pr-4 text-right">{code.short}</th>{/each}
              <th scope="col" class="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {#each LEVELS as level (level)}
              <tr class="border-b border-line">
                <th scope="row" class="py-2 pr-4 font-normal">
                  <span class="inline-flex items-center gap-2" title={LEVEL_INFO[level].meaning}>
                    <LevelSwatch {level} />
                    {levelName(level)}
                  </span>
                </th>
                {#each snap.codes as code (code.id)}
                  <td class="py-2 pr-4 text-right tabular-nums">{code.ingested ? formatInt(code.byLevel[level]) : '—'}</td>
                {/each}
                <td class="py-2 text-right font-semibold tabular-nums">{formatInt(totals[level])}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="mt-2 text-sm text-muted">« — » : code pas encore ingéré.</p>
    </section>

    <section aria-labelledby="journal">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="journal" class="text-2xl font-semibold">Derniers événements</h2>
        <a href="/feed.atom" class="text-sm">S’abonner (Atom)</a>
      </div>
      <p class="mb-4 mt-1 text-muted">Journal public, en ajout seul : rien n’y est réécrit ni effacé.</p>
      <EventList events={snap.events} />
    </section>
  </div>
{/if}

<section class="container-page mt-12" aria-labelledby="aider">
  <div class="card grid gap-4 p-6 md:grid-cols-[1fr_auto] md:items-center">
    <div>
      <h2 id="aider" class="text-2xl font-semibold">Deux façons d’aider</h2>
      <p class="mt-1 text-muted">
        Faire tourner un agent IA sur votre machine, avec votre propre abonnement, pour traduire, tester ou contredire.
        Ou soutenir les frais du projet. Ni l’un ni l’autre n’est encore ouvert : les pages expliquent ce qui est prévu.
      </p>
    </div>
    <CallToAction />
  </div>
</section>
