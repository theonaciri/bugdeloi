<script lang="ts">
import { formatLegiDate } from '#lib/format.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const display = (value: number | string) => (typeof value === 'number' ? euros.format(value / 100) : value)

const phases = $derived([
  {
    score: data.scores.raw,
    title: 'Premier comptage',
    explanation: 'La première exécution a compté certaines exécutions répétées du même test.',
  },
  {
    score: data.scores.original,
    title: 'Doublons retirés',
    explanation: 'Le comptage corrigé ne retient chaque test qu’une fois par fichier.',
  },
  {
    score: data.scores.completed,
    title: 'Données de test complétées',
    explanation:
      'Notre outil de test omettait une donnée, désormais renseignée pour indiquer que les conditions générales d’ouverture du droit sont remplies dans les cas de montant.',
  },
])

function classification(test: (typeof data.cases)[number]) {
  if (test.status === 'passed') {
    return typeof test.expected === 'number'
      ? 'Le montant correspond à celui attendu.'
      : 'Le résultat correspond à celui attendu.'
  }
  if (test.classification === 'erreur_oracle') return 'Désaccord en cours de vérification.'
  if (test.classification === 'ambiguïté') return 'Le moment de l’arrondi diffère entre les deux programmes.'
  return 'L’écart reste à examiner.'
}
</script>

<svelte:head>
  <title>Expérience sur les allocations familiales · BugDeLoi</title>
  <meta name="description" content="Un agent IA peut-il écrire un programme qui calcule les allocations familiales à partir des textes officiels ? Découvrez le protocole et les résultats provisoires." />
</svelte:head>

<div class="container-page py-8 sm:py-12">
  <a class="text-sm" href="/experiences">Toutes les expériences</a>
  <h1 class="mt-3 text-4xl font-semibold sm:text-5xl">Allocations familiales</h1>
  <p class="mt-4 max-w-[68ch] text-lg">
    Un agent IA peut-il traduire les articles sur les allocations familiales en programme sans voir le travail d’Inria ?
    Les chercheurs d’Inria ont déjà écrit des tests. Ils fixent les résultats attendus et la machine les compare à ceux du programme remis.
  </p>
  <aside class="mt-5 max-w-[68ch] rounded-md border border-notice-line bg-notice px-4 py-3 font-semibold text-notice-ink">
    Résultat provisoire : non relu par un humain, non publié comme constat
  </aside>

  <section class="mt-10" aria-labelledby="protocole">
    <h2 id="protocole" class="text-3xl font-semibold">Comment se déroule l’expérience ?</h2>
    <figure class="mt-4 w-full max-w-xl rounded-lg border border-line bg-surface p-3 sm:p-5">
      <svg class="block h-auto w-full" viewBox="0 0 390 148" role="img" aria-labelledby="c03-schema c03-parcours">
        <title id="c03-schema">Protocole de traduction à l’aveugle</title>
        <desc id="c03-parcours">L’agent traduit les textes officiels en programme. Une barrière lui masque les tests et le programme Inria. Après remise, les tests Inria sont exécutés sur son programme et les réussites sont comptées.</desc>
        <defs>
          <marker id="c03-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M1 1 5 3 1 5" fill="none" class="arrow" />
          </marker>
        </defs>
        <g fill="var(--surface-2)" stroke="var(--line-strong)">
          <rect x="4" y="9" width="110" height="40" rx="6" />
          <rect x="140" y="9" width="110" height="40" rx="6" />
          <rect x="276" y="9" width="110" height="40" rx="6" />
          <rect x="276" y="99" width="110" height="40" rx="6" />
        </g>
        <rect x="140" y="99" width="110" height="40" rx="6" fill="var(--brand-soft)" stroke="var(--brand)" />
        <g class="arrow" fill="none" marker-end="url(#c03-arrow)">
          <path d="M118 29h17" />
          <path d="M254 29h17" />
          <path d="M331 53v41" />
          <path d="M272 119h-17" />
        </g>
        <g class="bdl-text" text-anchor="middle" font-size="12" font-weight="600">
          <text x="59" y="33">Textes officiels</text>
          <text x="195" y="33">Agent traducteur</text>
          <text x="331" y="33">Programme remis</text>
          <text x="331" y="123">Tests Inria</text>
          <text x="195" y="123">Score</text>
        </g>
        <path d="M8 74h50m140 0h48" stroke="var(--notice-line)" stroke-width="2" stroke-dasharray="5 3" />
        <rect x="61" y="63" width="134" height="22" rx="4" fill="var(--notice-bg)" stroke="var(--notice-line)" />
        <text x="128" y="78" text-anchor="middle" fill="var(--notice-ink)" font-size="12" font-weight="700">L’agent ne voit pas</text>
      </svg>
      <figcaption class="mt-2 text-sm text-muted">
        L’agent reçoit les textes officiels et la liste des données à utiliser. Il découvre les tests et le programme Inria après la remise.
      </figcaption>
    </figure>
  </section>

  <section class="mt-10" aria-labelledby="score">
    <h2 id="score" class="text-3xl font-semibold">Comment le score a évolué</h2>
    <ol class="mt-4 grid divide-y divide-line rounded-lg border border-line bg-surface md:grid-cols-3 md:divide-x md:divide-y-0">
      {#each phases as phase, index (phase.title)}
        <li class="p-4 sm:p-5" class:bg-brand-soft={index === phases.length - 1}>
          <p class="font-semibold">{phase.title}</p>
          <p class="my-1 font-serif text-4xl font-semibold tabular-nums">{phase.score.passed}/{phase.score.total}</p>
          <p class="text-sm">{phase.explanation}</p>
        </li>
      {/each}
    </ol>
    <p class="mt-3 text-sm text-muted">
      Un compte, pas une probabilité. Le score inclut les cas de calcul, un cas d’ouverture du droit et les contrôles de structure du programme.
      <a href={data.method}>Lire la méthode de comptage</a>.
    </p>
  </section>

  <section class="mt-10" aria-labelledby="desaccords">
    <h2 id="desaccords" class="text-3xl font-semibold">Désaccords en cours de vérification</h2>
    <div class="mt-4 divide-y divide-line rounded-lg border border-line bg-surface">
      {#each data.disagreements as { result, article, verifications } (result.name)}
        <article id={result.name.toLowerCase()} class="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-[1fr_16rem] sm:p-5">
          <div>
            <h3 class="text-xl font-semibold">{result.name} · {article.question}</h3>
            <p class="mt-2 tabular-nums">Inria attend <strong>{display(result.expected)}</strong>. Le programme remis donne <strong>{display(result.actual)}</strong>.</p>
            <p class="mt-2 text-sm">
              <a href={article.url}>{article.label}</a>
              <span class="text-muted">· {article.id} · version du {formatLegiDate(article.version)}</span>
            </p>
          </div>
          <ul class="space-y-2 self-center text-sm" aria-label={`Vérifications indépendantes pour ${result.name}`}>
            {#each verifications as report (report.url ?? report.family)}
              <li>
                <span class="font-semibold">Vérification{report.family ? ` ${report.family}` : ''} :</span>
                {#if report.url && report.verdict}
                  <a href={report.url}>{report.verdict}</a>
                {:else if report.url}
                  <a href={report.url}>voir le rapport</a>
                {:else}
                  en attente
                {/if}
              </li>
            {/each}
          </ul>
        </article>
      {/each}
    </div>
  </section>

  <section class="mt-10" aria-labelledby="cas">
    <h2 id="cas" class="text-3xl font-semibold">Les {data.scores.completed.total} cas de l’évaluation corrigée</h2>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (Défilement horizontal du tableau au clavier.) -->
    <div class="mt-4 overflow-x-auto rounded-lg border border-line bg-surface" role="region" aria-labelledby="cas" tabindex="0">
      <table class="w-full min-w-[38rem] border-collapse text-sm [&_:is(th,td)]:px-3 [&_:is(th,td)]:py-2.5">
        <caption class="sr-only">Comparaison des résultats de la remise avec les attentes Inria</caption>
        <thead class="border-b border-line bg-surface-2 text-left">
          <tr>
            <th scope="col">Cas</th>
            <th scope="col">Attendu par Inria</th>
            <th scope="col">Obtenu</th>
            <th scope="col">Statut</th>
            <th scope="col">Explication</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          {#each data.cases as test (test.id)}
            <tr class="align-top">
              <th scope="row" class="text-left font-semibold">{test.name}</th>
              <td class:whitespace-nowrap={typeof test.expected === 'number'}>{display(test.expected)}</td>
              <td class:whitespace-nowrap={typeof test.actual === 'number'}>{display(test.actual)}</td>
              <td class="whitespace-nowrap font-medium" class:text-ok={test.status === 'passed'} class:text-ko={test.status !== 'passed'}>
                {test.status === 'passed' ? 'Réussi' : test.status === 'failed' ? 'Écart' : 'Erreur'}
              </td>
              <td>{classification(test)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <section class="mt-10" aria-labelledby="sources">
    <h2 id="sources" class="text-3xl font-semibold">Sources de l’expérience</h2>
    <ul class="mt-4 list-disc space-y-2 pl-5">
      <li><a href={data.source}>Programme remis, écrit en Catala</a></li>
      <li><a href={data.declaration}>Déclaration de l’agent</a> · famille OpenAI, modèle gpt-6.2-sol. Il déclare avoir consulté les textes et consignes du projet ainsi que la documentation du langage Catala.</li>
      <li><a href={data.audit}>Rapport d’audit et commandes pour relancer les tests</a></li>
      <li><a href={data.inria}>Commit Inria utilisé pour exécuter les tests</a></li>
    </ul>
  </section>
</div>

<style>
.arrow {
  stroke: var(--brand-strong);
  stroke-width: 1.5;
}
</style>
