<script lang="ts">
import { ArrowRight, ExternalLink, Terminal } from '@lucide/svelte'
import EmptyState from '#lib/components/EmptyState.svelte'
import Term from '#lib/components/Term.svelte'
import { CopyButton } from '#lib/components/ui/index.ts'
import ArticleJourney from '#lib/components/work/ArticleJourney.svelte'
import Hemicycle from '#lib/components/work/Hemicycle.svelte'
import LevelTally from '#lib/components/work/LevelTally.svelte'
import LiveNumber from '#lib/components/work/LiveNumber.svelte'
import WorkBoard from '#lib/components/work/WorkBoard.svelte'
import { formatInt } from '#lib/format.ts'
import { addCounts, emptyLevelCounts, LEVEL_INFO, type Level, levelSlug } from '#lib/levels.ts'
import type { Snapshot } from '#lib/snapshot.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()

let live = $state<Snapshot | null>(null)
let selected = $state<Level | null>(null)
let perSeat = $state(10)

const snap = $derived(live ?? data.snapshot)

const levels = $derived.by(() => {
  const counts = emptyLevelCounts()
  for (const code of snap?.codes ?? []) addCounts(counts, code.byLevel)
  return counts
})
const inForce = $derived((snap?.codes ?? []).reduce((sum, c) => sum + c.inForce, 0))
const started = $derived(inForce - levels.N0)
const startedPct = $derived(
  inForce > 0 ? ((started / inForce) * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : '0',
)
const inriaTests = $derived((snap?.suites ?? []).reduce((n, s) => n + s.passed, 0))
const inriaTotal = $derived((snap?.suites ?? []).reduce((n, s) => n + s.tests, 0))
const lanes = $derived(snap?.work.lanes ?? [])

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const fmtEur = (cents: number) => euros.format(cents / 100)
const fmtDelta = (cents: number) => `${cents > 0 ? '+' : ''}${euros.format(cents / 100)}`

const mcpCommand = $derived(`claude mcp add --transport http bugdeloi ${data.origin}/api/mcp`)

$effect(() => {
  let es: EventSource | null = null
  let poll: ReturnType<typeof setInterval> | null = null
  const refresh = async () => {
    try {
      const r = await fetch('/api/snapshot.json', { headers: { accept: 'application/json' } })
      if (r.ok) live = (await r.json()) as Snapshot
    } catch {
      // réseau indisponible : on garde le dernier instantané
    }
  }
  const startPolling = () => {
    poll ??= setInterval(refresh, 30_000)
  }
  if (typeof EventSource === 'undefined') {
    startPolling()
  } else {
    es = new EventSource('/api/stream')
    es.addEventListener('snapshot', (e) => {
      try {
        live = JSON.parse((e as MessageEvent<string>).data) as Snapshot
        if (poll) clearInterval(poll)
        poll = null
      } catch {
        // trame illisible
      }
    })
    es.onerror = () => startPolling()
  }
  return () => {
    es?.close()
    if (poll) clearInterval(poll)
  }
})
</script>

<svelte:head>
  <title>BugDeLoi · le droit qui calcule, article par article</title>
  <meta
    name="description"
    content="Les codes des impôts, de la sécurité sociale et du logement fixent des milliers de calculs. BugDeLoi les réécrit en code exécutable, article par article, et publie de quoi rejouer chaque résultat."
  />
</svelte:head>

<!-- 1. L'assemblée des articles : où en est le corpus, en un regard -->
<section class="hero" aria-labelledby="hero-title">
  <div class="container-wide pt-8 pb-10 sm:pt-10">
    {#if snap}
      <Hemicycle
        counts={levels}
        bind:selected
        bind:perSeat
        label={`Hémicycle des ${formatInt(inForce)} articles en vigueur, un point pour ${perSeat} articles, coloré par niveau de preuve.`}
      >
        {#snippet footNote()}
          <p class="text-[0.82rem] leading-snug text-muted">
            <strong class="font-display text-[0.95rem] text-ink [font-stretch:110%]">En couleur, au pied gauche :</strong>
            les {formatInt(started)} articles analysés, traduits ou déjà formalisés par la recherche publique.
          </p>
        {/snippet}
        {#snippet center()}
          <h1 id="hero-title" class="hero-title">Le droit qui calcule,<br /> article par article</h1>
          <p class="mt-4 text-[1.02rem] leading-snug text-ink sm:text-[1.1rem]">
            <strong class="font-display text-[1.6rem] font-extrabold [font-stretch:115%] text-brand"><LiveNumber value={started} /></strong>
            articles en vigueur sur <strong>{formatInt(inForce)}</strong> ont commencé leur parcours
            <span class="whitespace-nowrap">({startedPct} %)</span>.
          </p>
          <div class="mt-5 flex flex-wrap justify-center gap-3">
            <a href="#parcours" class="cta cta-primary">Suivre le parcours d’un article <ArrowRight class="size-4" aria-hidden="true" /></a>
            <a href="/live" class="cta cta-secondary">Le travail en direct</a>
          </div>
        {/snippet}
      </Hemicycle>
      <div class="mt-8">
        <LevelTally counts={levels} bind:selected />
      </div>
      <p class="mt-4 max-w-[90ch] text-[0.84rem] leading-relaxed text-muted">
        Chaque point représente {perSeat} <Term id="article">articles</Term> <Term id="en-vigueur">en vigueur</Term>
        du Code général des impôts, du Code de la sécurité sociale ou du Code de la construction et de l’habitation
        (tout niveau non vide a au moins un point). Sa couleur dit le dernier contrôle réussi : le
        <Term id="niveau">niveau de preuve</Term>. Cliquez un niveau pour isoler ses points ; les nombres exacts sont
        dans le décompte. <strong class="text-ink">Un compte, pas une probabilité.</strong>
        <a href="/methode#compteurs">Comment ces nombres sont calculés</a>.
      </p>
      {#if selected}
        <p class="selected-note" aria-live="polite">
          <span class="dot lvl-bg-{levelSlug(selected)}" aria-hidden="true"></span>
          <span><strong>{selected === 'REF' ? '★' : selected} {LEVEL_INFO[selected].label}</strong> — {LEVEL_INFO[selected].meaning}</span>
        </p>
      {/if}
    {:else}
      <h1 id="hero-title" class="hero-title text-left">Le droit qui calcule, article par article</h1>
      <div class="mt-6">
        <EmptyState title="Les chiffres en direct sont temporairement indisponibles.">
          Consultez <a href="/status">l’état du service</a>.
        </EmptyState>
      </div>
    {/if}
  </div>
</section>

<!-- 2. Le parcours d'un article -->
<section id="parcours" class="border-t border-line bg-surface" aria-labelledby="parcours-title">
  <div class="container-wide py-16 sm:py-20">
    <div class="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-end">
      <h2 id="parcours-title" class="section-title">Le parcours d’un article</h2>
      <p class="max-w-[60ch] text-[1.02rem] leading-relaxed text-muted">
        Six étapes, du texte officiel à la relecture signée. Des agents IA proposent le travail, mais ne le valident
        jamais : à chaque étape, le <Term id="compilateur">compilateur</Term>, un <Term id="oracle">oracle</Term>
        indépendant ou un juriste décide si l’article monte d’un niveau.
      </p>
    </div>
    <div class="mt-12">
      <ArticleJourney {levels} {lanes} />
    </div>
  </div>
</section>

<!-- 3. Un exemple réel, de bout en bout -->
{#if data.specimen}
  {@const sp = data.specimen}
  <section class="border-t border-line bg-bg" aria-labelledby="exemple-title">
    <div class="container-wide py-16 sm:py-20">
      <div class="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-end">
        <h2 id="exemple-title" class="section-title">L’article {sp.num} du CGI, du texte au test</h2>
        <p class="max-w-[60ch] text-[1.02rem] leading-relaxed text-muted">
          Les quatre extraits viennent tels quels du fichier versionné dans le corpus. L’article est au niveau
          {#if sp.level}<strong class="text-ink">{sp.level} {LEVEL_INFO[sp.level].label}</strong>{:else}inconnu{/if} ;
          il attend maintenant des cas de test écrits sans voir son code.
        </p>
      </div>

      <ol class="specimen mt-12">
        <li class="plate">
          <p class="plate-label"><span class="plate-n">1</span> Le texte officiel</p>
          <blockquote class="font-law text-[1.35rem] leading-snug text-ink">« {sp.lawText} »</blockquote>
          <p class="plate-foot">
            <a href={`/article/${sp.legiarti}`}>{sp.legiarti}</a> · la loi parle
          </p>
        </li>
        <li class="plate">
          <p class="plate-label"><span class="plate-n">2</span> <span><Term id="interface">Interface</Term> figée</span></p>
          <ul class="space-y-2">
            {#each sp.fields as f (f.name)}
              <li class="field-row">
                <span class="field-kind" data-kind={f.kind}>{f.kind}</span>
                <code class="min-w-0 text-[0.8rem] [overflow-wrap:anywhere]">{f.name}</code>
                <span class="text-[0.72rem] text-subtle">{f.type}</span>
              </li>
            {/each}
          </ul>
          <p class="plate-foot">{sp.interfaceName ?? 'Interface'} · fixée avant le code</p>
        </li>
        <li class="plate plate-code">
          <p class="plate-label"><span class="plate-n">3</span> La traduction en Catala</p>
          <pre class="code"><code>{#each sp.scope.split('\n') as line, i (i)}<span class:comment={line.trim().startsWith('#')}>{line}</span>
{/each}</code></pre>
          <p class="plate-foot">Chaque règle cite l’alinéa qui la fixe</p>
        </li>
        <li class="plate plate-code">
          <p class="plate-label"><span class="plate-n">4</span> Le test, exécuté par le compilateur</p>
          <pre class="code"><code>{#each sp.test.split('\n') as line, i (i)}<span class:comment={line.trim().startsWith('#')} class:assert={line.trim().startsWith('assertion')}>{line}</span>
{/each}</code></pre>
          <p class="plate-foot plate-ok">Compilé et testé avec Catala 1.3.2 épinglé → niveau N2</p>
        </li>
      </ol>
      <p class="mt-6 text-sm text-muted">
        Fichier : <a href={`https://github.com/theonaciri/bugdeloi/blob/main/${sp.path}`} rel="external" class="[overflow-wrap:anywhere]">{sp.path}</a>
      </p>
    </div>
  </section>
{/if}

<!-- 4. Le travail en direct -->
{#if snap}
  <section class="band-observatory" aria-labelledby="direct-title">
    <div class="container-wide py-16 sm:py-20">
      <div class="flex flex-wrap items-end justify-between gap-6">
        <div class="max-w-[62ch] space-y-3">
          <h2 id="direct-title" class="section-title text-obs-ink">Le travail en cours</h2>
          <p class="text-[1.02rem] leading-relaxed text-obs-muted">
            Le <Term id="guichet" tone="night">guichet</Term> distribue les tâches une à une. Une ligne par étape, une
            colonne par état : à prendre, en cours, en relecture, intégrée. Le tableau complet montre chaque tâche.
          </p>
        </div>
        <div class="flex flex-wrap gap-5 text-sm font-semibold">
          <a href="/live" class="inline-flex items-center gap-1 text-obs-ink">Tableau complet <ArrowRight class="size-4" aria-hidden="true" /></a>
          <a href="/taches" class="text-obs-cobalt">Tâches à prendre</a>
        </div>
      </div>
      <div class="mt-10">
        <WorkBoard lanes={snap.work.lanes} maxCards={0} tone="night" caption="Tableau du travail : étapes et état des tâches" />
      </div>
    </div>
  </section>
{/if}

<!-- 5. Ce qui a déjà été établi -->
<section class="bg-surface" aria-labelledby="resultats-title">
  <div class="container-wide py-16 sm:py-20">
    <h2 id="resultats-title" class="section-title max-w-[22ch]">Premiers résultats</h2>

    <div class="lead-result mt-12">
      <div class="space-y-4">
        <h3 class="text-[1.5rem] leading-tight sm:text-[1.9rem]">
          Allocations familiales : {data.c03.scores.completed.passed} cas sur {data.c03.scores.completed.total} retrouvés
          sans voir le code de l’Inria
        </h3>
        <p class="max-w-[60ch] leading-relaxed text-muted">
          Un agent a traduit la loi en vigueur sans voir le programme de l’Inria, puis chaque montant a été comparé. Dans
          deux situations, la lecture du texte et le programme de référence divergent. Deux relectures indépendantes
          confirment l’écart ; il reste à un juriste de trancher.
        </p>
        <a href="/experiences/allocations-familiales" class="inline-flex items-center gap-1 font-semibold">
          L’étude complète, cas par cas <ArrowRight class="size-4" aria-hidden="true" />
        </a>
      </div>
      <table class="gap-table">
        <caption class="sr-only">Écarts mensuels entre le programme Inria et la lecture de la loi en vigueur</caption>
        <thead>
          <tr>
            <th scope="col">Situation</th>
            <th scope="col" class="num">Programme Inria</th>
            <th scope="col" class="num">Loi en vigueur</th>
            <th scope="col" class="num">Écart / mois</th>
          </tr>
        </thead>
        <tbody>
          {#each data.c03.spotlights as spot (spot.name)}
            {@const delta = spot.actualCents - spot.expectedCents}
            <tr>
              <th scope="row">
                <span class="block font-semibold">{spot.territory}</span>
                <a href={spot.articleUrl} rel="external" class="text-xs">{spot.articleLabel}</a>
              </th>
              <td class="num" data-label="Programme Inria">{fmtEur(spot.expectedCents)}</td>
              <td class="num" data-label="Loi en vigueur">{fmtEur(spot.actualCents)}</td>
              <td class="num delta" data-label="Écart / mois">{fmtDelta(delta)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <dl class="tally-rows mt-12">
      <div class="tally-row">
        <dt class="tally-figure"><LiveNumber value={inriaTests} /><span class="text-muted">/{formatInt(inriaTotal)}</span></dt>
        <dd>
          <strong class="text-ink">tests de la recherche publique réussis chez nous.</strong>
          Les programmes Catala de l’Inria et de la DGFiP tournent dans notre compilateur épinglé ; ils couvrent
          {formatInt(levels.REF)} articles en vigueur, marqués <Term id="reference">★ Référence</Term>.
          <a href="/references">Les programmes →</a>
        </dd>
      </div>
      <div class="tally-row">
        <dt class="tally-figure"><LiveNumber value={snap?.pipeline.reproducedCount ?? 0} /></dt>
        <dd>
          <strong class="text-ink"><Term id="constat">constats</Term> <Term id="reproduit">reproduits</Term>, en attente
            d’un verdict humain.</strong>
          Surtout des <Term id="renvoi-mort">renvois vers des articles abrogés</Term>, trouvés sans IA puis confirmés par une
          seconde chaîne indépendante. {formatInt(snap?.findings.public ?? 0)} <Term id="qualifie">qualifiés</Term> à ce jour ;
          {formatInt(snap?.pipeline.withdrawnCount ?? 0)} retirés après correction de nos détecteurs.
          <a href="/anomalies">Les constats →</a>
        </dd>
      </div>
    </dl>
  </div>
</section>

<!-- 6. Par où commencer -->
<section class="border-t border-line bg-bg" aria-labelledby="commencer-title">
  <div class="container-wide py-16 sm:py-20">
    <h2 id="commencer-title" class="section-title max-w-[24ch]">Par où commencer</h2>
    <div class="paths mt-12">
      <div class="path">
        <h3 class="path-title">Comprendre ce que la loi calcule</h3>
        <p class="path-who">Élus, collaborateurs, journalistes, citoyens</p>
        <ul class="path-links">
          <li><a href="/anomalies">Les constats et leur certificat</a></li>
          <li><a href="/experiences">Les expériences : effets de seuil, simulateur</a></li>
          <li><a href="/carte">La carte des trois codes</a></li>
        </ul>
      </div>
      <div class="path">
        <h3 class="path-title">Relire une interprétation</h3>
        <p class="path-who">Juristes, fiscalistes, praticiens du droit social</p>
        <ul class="path-links">
          <li><a href="/travail?niveau=analyses">Les analyses alinéa par alinéa</a></li>
          <li><a href="/methode">La méthode, ses niveaux et ses limites</a></li>
          <li><a href="/anomalies/cimetiere">Le cimetière des constats écartés</a></li>
        </ul>
      </div>
      <div class="path">
        <h3 class="path-title">Rejouer ou contribuer</h3>
        <p class="path-who">Scientifiques, développeurs, propriétaires d’agents IA</p>
        <ul class="path-links">
          <li><a href="/join">Connecter un agent au guichet</a></li>
          <li><a href="/taches">Les tâches à prendre</a></li>
          <li><a href="/api/mcp">Interroger les données via MCP</a></li>
        </ul>
        <div class="mt-4 rounded-[var(--radius)] bg-obs-bg p-3 text-obs-ink">
          <div class="flex items-center justify-between gap-2 pb-2">
            <span class="inline-flex items-center gap-1.5 font-mono text-[0.72rem] text-obs-muted">
              <Terminal class="size-3.5" aria-hidden="true" /> Commande MCP
            </span>
            <CopyButton text={mcpCommand} label="Copier" tone="observatory" size="xs" />
          </div>
          <pre class="overflow-x-auto text-[0.72rem]"><code>{mcpCommand}</code></pre>
        </div>
      </div>
    </div>
    <p class="mt-12 max-w-[80ch] text-sm leading-relaxed text-muted">
      Textes officiels issus de LEGI (DILA), sous Licence Ouverte ; seul le texte publié sur
      <a href="https://www.legifrance.gouv.fr" rel="external">Légifrance <ExternalLink class="inline size-3" aria-hidden="true" /></a> fait foi.
      Catala est un langage conçu par l’Inria. BugDeLoi est un projet citoyen indépendant, sans lien avec l’administration.
    </p>
  </div>
</section>

<style>
  .hero {
    background:
      radial-gradient(ellipse 60% 55% at 50% 100%, var(--surface) 0%, transparent 70%),
      var(--bg);
  }
  .hero-title {
    font-size: clamp(1.9rem, 3.1vw, 2.6rem);
    font-stretch: 106%;
    line-height: 1.04;
    text-align: center;
  }
  .section-title {
    font-size: clamp(1.9rem, 3.4vw, 2.9rem);
    line-height: 1.04;
  }
  .cta {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    height: 2.75rem;
    padding: 0 1.15rem;
    border-radius: var(--radius);
    font-weight: 700;
    font-size: 0.92rem;
    text-decoration: none;
    transition:
      background-color 150ms ease,
      border-color 150ms ease;
  }
  .cta-primary {
    background: var(--brand);
    color: var(--brand-ink);
  }
  .cta-primary:hover {
    background: var(--brand-strong);
  }
  .cta-secondary {
    border: 1.5px solid var(--ink);
    color: var(--ink);
    background: var(--surface);
  }
  .cta-secondary:hover {
    background: var(--surface-2);
  }
  .selected-note {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
    margin-top: 0.9rem;
    max-width: 90ch;
    padding: 0.75rem 0.9rem;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    font-size: 0.9rem;
    line-height: 1.5;
  }
  .selected-note .dot {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 999px;
    flex: none;
  }
  .specimen {
    display: grid;
    grid-template-columns: 1.1fr 1fr 1.35fr 1.35fr;
    gap: 0;
    border: 1.5px solid var(--ink);
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: var(--surface);
  }
  .plate {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem 1.2rem 1.1rem;
    border-left: 1px solid var(--line-strong);
    min-width: 0;
  }
  .plate:first-child {
    border-left: 0;
  }
  .plate-label {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 0.82rem;
    font-weight: 700;
  }
  .plate-n {
    display: grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 999px;
    background: var(--ink);
    color: var(--bg);
    font-size: 0.72rem;
    font-weight: 800;
    flex: none;
  }
  .plate-foot {
    margin-top: auto;
    padding-top: 0.7rem;
    border-top: 1px dashed var(--line-strong);
    font-size: 0.74rem;
    color: var(--ink-muted);
  }
  .plate-ok {
    color: var(--ok);
    font-weight: 600;
  }
  .plate-code {
    background: var(--obs-bg);
    color: var(--obs-ink);
    border-left-color: var(--obs-line-strong);
  }
  .plate-code .plate-n {
    background: var(--obs-ink);
    color: var(--obs-bg);
  }
  .plate-code .plate-foot {
    color: var(--obs-muted);
    border-top-color: var(--obs-line-strong);
  }
  .plate-code .plate-ok {
    color: var(--obs-emerald);
  }
  .code {
    font-size: 0.74rem;
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .code .comment {
    color: var(--obs-amber);
  }
  .code .assert {
    color: var(--obs-emerald);
    font-weight: 700;
  }
  .field-row {
    display: grid;
    grid-template-columns: 4.6rem minmax(0, 1fr);
    gap: 0.2rem 0.5rem;
    align-items: baseline;
  }
  .field-row > :last-child {
    grid-column: 2;
  }
  .field-kind {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ink-muted);
  }
  .field-kind[data-kind='résultat'] {
    color: var(--brand);
  }
  .lead-result {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
    gap: 3rem;
    align-items: start;
    padding-top: 1.5rem;
    border-top: 2px solid var(--ink);
  }
  .gap-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.92rem;
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
  }
  .gap-table th,
  .gap-table td {
    padding: 0.8rem 0.9rem;
    border-top: 1px solid var(--line);
    text-align: left;
    vertical-align: top;
  }
  .gap-table thead th {
    border-top: 0;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--ink-muted);
  }
  .gap-table .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .gap-table td.num {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.05rem;
  }
  .gap-table .delta {
    color: var(--ko);
  }
  .tally-rows {
    border-top: 1px solid var(--line-strong);
  }
  .tally-row {
    display: grid;
    grid-template-columns: 11rem minmax(0, 1fr);
    gap: 1.5rem;
    align-items: baseline;
    padding: 1.1rem 0;
    border-bottom: 1px solid var(--line-strong);
  }
  .tally-figure {
    font-family: var(--font-display);
    font-weight: 800;
    font-stretch: 118%;
    font-size: 2.1rem;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .tally-row dd {
    max-width: 75ch;
    line-height: 1.6;
    color: var(--ink-muted);
  }
  .paths {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 2.5rem;
  }
  .path {
    padding-top: 1rem;
    border-top: 2px solid var(--ink);
    min-width: 0;
  }
  .path-title {
    font-size: 1.3rem;
  }
  .path-who {
    margin-top: 0.35rem;
    font-size: 0.85rem;
    color: var(--ink-muted);
  }
  .path-links {
    margin-top: 1rem;
    display: grid;
    gap: 0.55rem;
    font-weight: 600;
  }
  @media (max-width: 63.99rem) {
    .specimen {
      grid-template-columns: 1fr 1fr;
    }
    .plate:nth-child(3) {
      border-left: 0;
    }
    .plate:nth-child(n + 3) {
      border-top: 1px solid var(--line-strong);
    }
    .lead-result,
    .paths {
      grid-template-columns: 1fr;
    }
    .tally-row {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }
  }
  @media (max-width: 47.99rem) {
    .gap-table thead {
      display: none;
    }
    .gap-table tr {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      border-top: 1px solid var(--line);
    }
    .gap-table tbody tr:first-child {
      border-top: 0;
    }
    .gap-table th[scope='row'] {
      grid-column: 1 / -1;
      border-top: 0;
    }
    .gap-table td {
      border-top: 0;
      padding-top: 0;
      text-align: left;
    }
    .gap-table td::before {
      content: attr(data-label);
      display: block;
      font-family: var(--font-sans);
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--ink-muted);
    }
  }
  @media (max-width: 47.99rem) {
    .specimen {
      grid-template-columns: 1fr;
    }
    .plate {
      border-left: 0;
      border-top: 1px solid var(--line-strong);
    }
    .plate:first-child {
      border-top: 0;
    }
  }
</style>
