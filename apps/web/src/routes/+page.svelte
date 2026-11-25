<script lang="ts">
import CallToAction from '#lib/components/CallToAction.svelte'
import EmptyState from '#lib/components/EmptyState.svelte'
import EventList from '#lib/components/EventList.svelte'
import GlossaryTerm from '#lib/components/GlossaryTerm.svelte'
import LevelBar from '#lib/components/LevelBar.svelte'
import LevelSwatch from '#lib/components/LevelSwatch.svelte'
import ProgressBar from '#lib/components/ProgressBar.svelte'
import { findingSteps } from '#lib/finding-guide.ts'
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
const compiledTotal = $derived(totals.N2 + totals.N3 + totals.N4 + totals.N5)

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
  <div class="container-page py-9 sm:py-12">
    <h1 class="max-w-3xl text-4xl font-semibold sm:text-5xl">Du texte de loi au constat public</h1>
    <p class="mt-4 max-w-[66ch] text-lg text-muted">
      BugDeLoi travaille sur les règles que l’on peut écrire sous forme de calcul. Le projet cherche aussi les
      incohérences dans les textes officiels, par exemple un renvoi vers un article abrogé.
    </p>
    <p class="mt-4"><a href="/methode">Lire la méthode et le détail des compteurs</a></p>

    <ol class="mt-8 max-w-4xl list-decimal divide-y divide-line border-y border-line">
      <li class="ml-6 py-4 pl-2">
        <h2 class="text-xl font-semibold">Rassembler les textes officiels</h2>
        <p class="mt-1 max-w-[65ch]">Le projet charge les versions datées diffusées par la Direction de l’information légale et administrative.</p>
        {#if snap}
          <p class="mt-2">
            <strong>{plural(inForceTotal, 'article en vigueur', 'articles en vigueur')}</strong> dans les codes suivis.
            <a href="/methode#compteur-articles">Calcul</a> · <a href="/carte">Explorer les articles</a>
          </p>
        {/if}
      </li>
      <li class="ml-6 py-4 pl-2">
        <h2 class="text-xl font-semibold">Traduire les règles et contrôler les textes</h2>
        <p class="mt-1 max-w-[65ch]">
          Le projet écrit les règles de calcul en code Catala. D’autres programmes examinent les textes pour repérer
          des cas à relire, qu’on appelle des candidats.
        </p>
        {#if snap}
          <p class="mt-2">
            <strong>{plural(compiledTotal, 'article au niveau N2 à N5', 'articles aux niveaux N2 à N5')}</strong> parmi les travaux du projet.
            <a href="/methode#compteur-formalisations">Calcul</a>
          </p>
          <p class="mt-1">
            Pour les travaux de référence, <strong>{formatInt(snap.replications.passed)} sur {formatInt(snap.replications.total)}</strong> suites de tests rejouées avec succès.
            <a href="/methode#compteur-rejeux">Calcul</a>
          </p>
        {/if}
      </li>
      <li class="ml-6 py-4 pl-2">
        <h2 class="text-xl font-semibold">Faire relire le constat avant publication</h2>
        <p class="mt-1 max-w-[65ch]">
          Une chaîne indépendante refait le contrôle. Un humain examine ensuite le constat et consigne son verdict.
        </p>
        {#if snap}
          <p class="mt-2">
            <strong>{plural(snap.findings.public, 'anomalie qualifiée', 'anomalies qualifiées')}</strong> par un humain.
            <a href="/methode#compteur-anomalies">Calcul</a> · <a href="/anomalies">Consulter les anomalies</a>
          </p>
        {/if}
      </li>
    </ol>

    <p class="mt-4 max-w-[65ch] text-sm text-muted">Un compte, pas une probabilité. Ces chiffres décrivent les textes chargés et les contrôles effectués.</p>
  </div>
</section>

{#if data.dbError || !snap}
  <div class="container-page mt-8">
    <EmptyState title="La base de données ne répond pas pour le moment.">
      Les chiffres seront disponibles au retour de la base. Voir
      <a href="/status">l’état du service</a>.
    </EmptyState>
  </div>
{:else}
  <div class="container-page mt-10 space-y-12">
    <section aria-labelledby="journal">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="journal" class="text-2xl font-semibold">Derniers événements</h2>
        <a href="/feed.atom" class="text-sm">S’abonner (Atom)</a>
      </div>
      <p class="mb-4 mt-1 text-muted">Choisissez un événement pour voir ce qui s’est passé, à quoi cela sert et ce qui vient ensuite.</p>
      <EventList events={snap.events} />
    </section>

    <section aria-labelledby="statuts">
      <h2 id="statuts" class="text-2xl font-semibold">Les étapes d’un constat</h2>
      <p class="mt-2 max-w-[65ch] text-muted">Un verdict humain peut aussi écarter le constat. Les rejets motivés figurent dans le <a href="/anomalies/cimetiere">cimetière</a>.</p>
      <ol class="mt-3 flex flex-wrap items-start gap-x-5 gap-y-2">
        {#each findingSteps as step (step.status)}
          <li><GlossaryTerm term={step.term} definition={step.definition} href="/methode#cycle" /></li>
        {/each}
      </ol>
    </section>

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
        Part des articles en vigueur aux niveaux N2 à N5 ou portant le marqueur ★.
        <a href="/methode#compteur-avancement">Méthode</a>
      </p>
      <ul class="mt-4 divide-y divide-line border-y border-line">
        {#each snap.codes as code (code.id)}
          <li class="py-4">
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
                — {formatInt(code.atLeastN2)} sur {plural(code.inForce, 'article')} en vigueur aux niveaux N2 à N5 ou avec le marqueur ★.
              </p>
              {#if code.atLeastN2 === 0}
                <p class="text-sm text-muted">Aucun article de ce code dans ces catégories.</p>
              {/if}
              <p class="mt-1 text-sm text-muted">{plural(code.versions, 'version ingérée', 'versions ingérées')} (tous états).</p>
            {/if}
          </li>
        {/each}
      </ul>
    </section>

    <section aria-labelledby="niveaux">
      <h2 id="niveaux" class="text-2xl font-semibold">Répartition par niveau de preuve</h2>
      <p class="mt-1 text-muted">
        Articles en vigueur, tous codes confondus. Un article ingéré est au niveau N0 tant qu’aucun contrôle
        supplémentaire n’a réussi. <a href="/methode#niveaux">Ce que garantit chaque niveau</a>
      </p>
      <p class="mt-2 text-sm text-muted">
        Les travaux de référence citent {plural(snap.coverage.cited, 'identifiant')} de version, dont {formatInt(snap.coverage.matched)} en base.
        <a href="/methode#compteur-couverture">Calcul</a>
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
                  <LevelSwatch {level} />
                  <GlossaryTerm term={levelName(level)} definition={LEVEL_INFO[level].meaning} href="/methode#niveaux" />
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
      <p class="mt-2 text-sm text-muted">Un tiret indique que le code n’a pas encore été chargé.</p>
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
