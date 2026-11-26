<script lang="ts">
import summary from '../../../../../replications/c0.3/summary.json'

const { passed, total } = summary.scores.completed
const rounding = summary.cases.filter((test) => test.classification === 'ambiguïté').length
const disagreements = summary.cases.filter((test) => test.classification === 'erreur_oracle').length
</script>

<svelte:head>
  <title>Expériences d’étalonnage · BugDeLoi</title>
  <meta name="description" content="Comment BugDeLoi mesure ce qu’une intelligence artificielle sait calculer à partir des textes officiels." />
</svelte:head>

<header class="bg-bg">
  <div class="container-wide space-y-4 py-12 sm:py-16">
    <h1 class="font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl">Expériences d’étalonnage</h1>
    <p class="max-w-3xl text-lg leading-relaxed text-muted">
      Avant d’utiliser des intelligences artificielles sur des textes de loi encore jamais traduits, nous mesurons ce
      qu’elles savent vraiment faire et où elles se trompent. Le principe est simple : nous leur donnons uniquement le
      texte officiel de la loi, sans montrer le travail déjà accompli par des chercheurs publics, puis nous comparons
      les montants en euros obtenus.
    </p>
  </div>
</header>

<section class="border-t border-line bg-surface" aria-labelledby="allocations">
  <div class="container-wide py-12 sm:py-16">
    <article class="space-y-4 border-y border-line py-6 sm:py-8">
      <h2 id="allocations" class="font-serif text-3xl font-semibold text-ink sm:text-4xl">
        <a class="text-ink no-underline hover:underline" href="/experiences/allocations-familiales">
          Allocations familiales : test à l’aveugle face à Inria <span aria-hidden="true">→</span>
        </a>
      </h2>
      <p class="max-w-3xl leading-relaxed text-muted">
        Sur les {total} contrôles de la suite d’Inria, {passed} réussissent et {rounding} montants correspondent à
        0,01 € près. {disagreements} écarts plus importants, en Guyane et à Mayotte, restent en cours d’examen.
        Un compte, pas une probabilité.
      </p>
      <p class="text-sm font-medium text-notice-ink">Résultat provisoire · en attente de relecture humaine</p>
    </article>
  </div>
</section>
