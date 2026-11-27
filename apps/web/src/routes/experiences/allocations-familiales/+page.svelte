<script lang="ts">
import C03EuroBars from '#lib/components/viz/C03EuroBars.svelte'
import { formatLegiDate } from '#lib/format.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const display = (value: number | string) => (typeof value === 'number' ? euros.format(value / 100) : value)

const phases = $derived([
  {
    score: data.scores.raw,
    title: 'Premier comptage',
    explanation: 'Notre outil avait compté plusieurs fois certains tests.',
  },
  {
    score: data.scores.original,
    title: 'Doublons retirés',
    explanation: 'Nous avons compté une seule fois chaque test d’un même fichier.',
  },
  {
    score: data.scores.completed,
    title: 'Données de test complétées',
    explanation:
      'Pour les cas où l’on compare des montants, il manquait une information : les conditions générales pour avoir droit aux allocations sont remplies. Nous l’avons ajoutée aux données du test.',
  },
])

function classify(test: (typeof data.cases)[number]) {
  if (test.status === 'passed') {
    return {
      label: 'Réussi',
      explanation:
        typeof test.expected === 'number'
          ? 'Les deux programmes donnent le même montant au centime près.'
          : 'Le résultat correspond à celui attendu.',
    }
  }
  if (test.classification === 'ambiguïté') {
    return {
      label: 'Écart d’arrondi',
      explanation: 'Les deux programmes arrondissent à des étapes différentes du calcul.',
    }
  }
  if (test.classification === 'erreur_oracle') {
    return {
      label: 'À examiner',
      explanation:
        'Les deux programmes appliquent les règles différemment. Une relecture juridique est en attente.',
    }
  }
  return {
    label: test.status === 'error' ? 'Erreur' : 'Écart',
    explanation: 'Le résultat reste à examiner.',
  }
}
</script>

<svelte:head>
  <title>Allocations familiales : le test à l’aveugle · BugDeLoi</title>
  <meta name="description" content="Comparez les montants du programme d’Inria à ceux calculés par une intelligence artificielle à partir des textes officiels. Résultats provisoires." />
</svelte:head>

<header class="bg-bg">
  <div class="container-wide space-y-5 py-12 sm:py-16">
    <a href="/experiences" class="text-sm font-semibold text-brand-strong no-underline hover:underline">← Toutes les expériences</a>
    <h1 class="text-4xl tracking-tight text-ink sm:text-5xl">
      Allocations familiales : le test à l’aveugle
    </h1>
    <p class="max-w-3xl text-lg leading-relaxed text-muted">
      Inria, l’institut public français de recherche en informatique, a écrit un programme et des tests sur les
      allocations familiales. Nous demandons à une intelligence artificielle (IA) d’écrire son propre programme à
      partir des textes officiels du Code de la sécurité sociale et des textes propres à Mayotte, sans accès au code
      ni aux tests d’Inria. Nous soumettons ensuite les deux programmes à la même série de
      {data.scores.completed.total} contrôles et comparons les montants mensuels obtenus.
    </p>
    <p class="max-w-3xl rounded-xl border border-notice-line/50 bg-notice/60 px-5 py-3.5 text-sm font-medium text-notice-ink">
      Résultat provisoire : non relu par un juriste et non publié comme constat définitif.
    </p>
  </div>
</header>

<section class="border-t border-line bg-surface" aria-labelledby="protocole">
  <div class="container-wide space-y-6 py-12 sm:py-16">
    <h2 id="protocole" class="text-3xl text-ink sm:text-4xl">Comment fonctionne le test à l’aveugle ?</h2>
    <figure class="max-w-xl">
      <svg class="block h-auto w-full" viewBox="0 0 390 110" role="img" aria-labelledby="c03-schema c03-parcours">
        <title id="c03-schema">Les trois étapes du test à l’aveugle</title>
        <desc id="c03-parcours">L’IA reçoit les textes officiels et remet son programme. Les tests d’Inria sont utilisés après la remise pour comparer les résultats.</desc>
        <defs>
          <marker id="c03-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M1 1 5 3 1 5" fill="none" stroke="var(--brand-strong)" />
          </marker>
        </defs>
        <g fill="var(--surface-2)" stroke="var(--line)">
          <rect x="1" y="9" width="110" height="42" rx="6" />
          <rect x="140" y="9" width="110" height="42" rx="6" />
        </g>
        <rect x="279" y="9" width="110" height="42" rx="6" fill="var(--brand-soft)" stroke="var(--brand)" />
        <g fill="none" stroke="var(--brand-strong)" stroke-width="1.5" marker-end="url(#c03-arrow)">
          <path d="M116 30h18" />
          <path d="M255 30h18" />
          <path d="M334 75V56" />
        </g>
        <g fill="var(--ink)" text-anchor="middle" font-size="12" font-weight="600">
          <text x="56" y="34">Textes officiels</text>
          <text x="195" y="27"><tspan x="195">Programme</tspan><tspan x="195" dy="14">écrit par l’IA</tspan></text>
          <text x="334" y="27"><tspan x="334">Comparaison</tspan><tspan x="334" dy="14">des résultats</tspan></text>
        </g>
        <path d="M1 91h272" fill="none" stroke="var(--notice-line)" stroke-dasharray="5 3" />
        <rect x="279" y="78" width="110" height="26" rx="4" fill="var(--notice-bg)" stroke="var(--notice-line)" />
        <text x="334" y="95" text-anchor="middle" fill="var(--notice-ink)" font-size="12" font-weight="600">Tests d’Inria</text>
      </svg>
      <figcaption class="mt-3 text-base leading-relaxed text-muted">
        Les réponses d’Inria restent cachées jusqu’à la remise du programme pour empêcher l’IA de les recopier.
        La comparaison montre ainsi ce que son programme arrive à calculer à partir des textes.
      </figcaption>
    </figure>
  </div>
</section>

<section class="border-t border-line bg-bg" aria-labelledby="score">
  <div class="container-wide space-y-8 py-12 sm:py-16">
    <div class="max-w-3xl space-y-3">
      <h2 id="score" class="text-3xl text-ink sm:text-4xl">Comparaison en euros, cas par cas</h2>
      <p class="leading-relaxed text-muted">
        Sélectionnez un cas pour lire les deux montants et leur différence. Le graphique affiche les
        {data.euroCases.length} cas qui donnent un montant. Il compare les résultats d’Inria et ceux obtenus par
        notre programme selon sa lecture du texte applicable à la date du cas.
      </p>
    </div>

    <C03EuroBars cases={data.euroCases} />

    <ol class="grid divide-y divide-line border-y border-line md:grid-cols-3 md:divide-x md:divide-y-0">
      {#each phases as phase (phase.title)}
        <li class="space-y-2 py-5 md:px-6 md:first:pl-0 md:last:pr-0">
          <h3 class="text-ink">{phase.title}</h3>
          <p class="font-display text-3xl font-semibold tabular text-ink">{phase.score.passed} sur {phase.score.total}</p>
          <p class="text-sm leading-relaxed text-muted">{phase.explanation}</p>
        </li>
      {/each}
    </ol>
    <p class="max-w-3xl text-sm leading-relaxed text-muted">
      <strong class="text-ink">Ce chiffre est un dénombrement observé, et non une probabilité.</strong> Il compte les
      tests réussis dans cette expérience, incluant les comparaisons en euros, un test sur l’ouverture du droit aux
      allocations et deux contrôles de structure du programme. <a href={data.method}>Consulter la méthode de comptage</a>.
    </p>
  </div>
</section>

<section class="border-t border-line bg-surface" aria-labelledby="desaccords">
  <div class="container-wide space-y-8 py-12 sm:py-16">
    <div class="max-w-3xl space-y-3">
      <h2 id="desaccords" class="text-3xl text-ink sm:text-4xl">
        Deux écarts à trancher : Guyane et Mayotte
      </h2>
      <p class="leading-relaxed text-muted">
        Un juriste doit encore déterminer si chaque écart vient d’une version différente du texte, d’un choix
        d’interprétation ou d’une erreur dans l’un des programmes. Les montants qui suivent concernent les dates et
        les situations des tests.
      </p>
    </div>
    <div class="grid divide-y divide-line border-y border-line lg:grid-cols-2 lg:divide-x lg:divide-y-0">
      {#each data.disagreements as { result, article, verifications } (result.name)}
        <article id={result.name.toLowerCase()} class="min-w-0 scroll-mt-24 space-y-5 py-6 lg:px-8 lg:first:pl-0 lg:last:pr-0">
          <h3 class="text-2xl text-ink">{article.territory}</h3>
          <p class="text-sm text-muted">{result.name} · {article.question}</p>
          <dl class="grid grid-cols-2 gap-4 border-y border-line py-5 sm:gap-6">
            <div>
              <dt class="text-sm font-semibold text-ink">Montant du programme Inria</dt>
              <dd class="mt-2 font-display text-2xl font-semibold tabular text-ink sm:text-3xl">{display(result.expected)}</dd>
              <dd class="mt-2 text-sm leading-relaxed text-muted">{article.inriaWhy}</dd>
            </div>
            <div>
              <dt class="text-sm font-semibold text-brand-strong">Ce que donne la loi en vigueur</dt>
              <dd class="mt-2 font-display text-2xl font-semibold tabular text-brand-strong sm:text-3xl">{display(result.actual)}</dd>
              <dd class="mt-2 text-sm leading-relaxed text-muted">{article.lawWhy}</dd>
            </div>
          </dl>
          <p class="text-sm leading-relaxed text-muted">
            <a href={article.url}>{article.label}</a>
            · {article.id} · version du {formatLegiDate(article.version)}
          </p>
          <div class="space-y-2 text-sm">
            <h4 class="font-semibold text-ink">Relectures indépendantes par d’autres modèles</h4>
            <ul class="space-y-2 text-muted">
              {#each verifications as report (report.url ?? report.family)}
                <li>
                  <span class="capitalize">{report.family ?? 'Autre rapport'}</span> ·
                  {#if report.url}
                    <a href={report.url}>{report.verdict ?? 'Lire le rapport'}</a>
                  {:else}
                    En attente
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        </article>
      {/each}
    </div>
  </div>
</section>

<section class="border-t border-line bg-bg" aria-labelledby="cas">
  <div class="container-wide space-y-10 py-12 sm:space-y-12 sm:py-16">
    <div class="space-y-4">
      <h2 id="cas" class="text-3xl text-ink sm:text-4xl">Tableau complet des {data.scores.completed.total} cas</h2>
      <p class="max-w-3xl leading-relaxed text-muted">
        La colonne « Ce que donne la loi » présente le résultat de notre programme. Les lignes sans montant
        portent sur le droit aux allocations ou sur la structure du programme.
      </p>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (Défilement horizontal du tableau au clavier.) -->
      <div class="overflow-x-auto border-y border-line" role="region" aria-labelledby="cas" tabindex="0">
        <table class="w-full min-w-[40rem] border-collapse text-sm leading-relaxed [&_:is(th,td)]:px-3 [&_:is(th,td)]:py-3">
          <caption class="sr-only">Résultats complets des contrôles et des comparaisons avec Inria</caption>
          <thead class="border-b border-line text-left text-ink">
            <tr>
              <th scope="col">Cas</th>
              <th scope="col">Montant du programme Inria</th>
              <th scope="col">Ce que donne la loi</th>
              <th scope="col">Résultat</th>
              <th scope="col">Explication</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            {#each data.cases as test (test.id)}
              {@const result = classify(test)}
              <tr class="align-top">
                <th scope="row" class="text-left font-semibold text-ink">{test.name}</th>
                <td class="tabular" class:whitespace-nowrap={typeof test.expected === 'number'}>{display(test.expected)}</td>
                <td class="tabular" class:whitespace-nowrap={typeof test.actual === 'number'}>{display(test.actual)}</td>
                <td class="font-medium" class:text-ok={test.status === 'passed'} class:text-notice-ink={test.status !== 'passed'}>
                  {result.label}
                </td>
                <td class="text-muted">{result.explanation}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <div class="space-y-4">
      <h2 id="sources" class="text-3xl text-ink sm:text-4xl">Sources</h2>
      <ul class="max-w-3xl divide-y divide-line border-y border-line text-sm">
        <li class="py-3"><a href={data.source}>Programme remis en Catala</a></li>
        <li class="py-3"><a href={data.declaration}>Déclaration de transparence de l’agent</a></li>
        <li class="py-3"><a href={data.audit}>Rapport d’audit complet</a></li>
        <li class="py-3"><a href={data.inria}>Version exacte des tests Inria</a></li>
      </ul>
    </div>
  </div>
</section>
