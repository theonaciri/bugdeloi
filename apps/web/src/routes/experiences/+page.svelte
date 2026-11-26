<script lang="ts">
import type { PageProps } from './$types'

let { data }: PageProps = $props()
</script>

<svelte:head>
  <title>Expériences d’étalonnage · BugDeLoi</title>
  <meta
    name="description"
    content="Comment BugDeLoi teste ses programmes et les intelligences artificielles sur des textes de loi réels : impôt sur le revenu 2026, allocations familiales et ambiguïtés connues."
  />
</svelte:head>

<section class="bg-bg">
  <div class="container-wide py-12 sm:py-16">
    <h1 class="max-w-4xl font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
      Expériences d’étalonnage
    </h1>
    <p class="mt-5 max-w-[68ch] text-lg leading-relaxed text-muted">
      Avant d’appliquer nos outils sur des pans entiers de la loi encore jamais programmés, nous mesurons publiquement
      ce qu’ils savent faire et où ils se trompent. Chaque expérience publie ses chiffres bruts, ses limites et les
      moyens de tout vérifier soi-même.
    </p>
  </div>
</section>

<section class="border-t border-line bg-surface">
  <div class="container-wide py-12 sm:py-16">
    <ul class="divide-y divide-line border-y border-line">
      <li class="grid gap-4 py-8 lg:grid-cols-12 lg:items-baseline">
        <div class="lg:col-span-8">
          <h2 class="font-serif text-2xl font-semibold text-ink sm:text-3xl">
            <a href="/experiences/impot-revenu" class="no-underline hover:underline">
              Impôt sur le revenu 2026 : simulateur et détection des coudes
            </a>
          </h2>
          <p class="mt-2.5 max-w-[62ch] text-base leading-relaxed text-muted">
            Formalisation en Catala des articles 193, 194, 197 et 1657 en vigueur en 2026, accompagnée d’un simulateur
            direct dans le navigateur et d’un balayage au pas de 1 € sur quatre foyers types. Le détecteur retrouve le
            taux marginal de {data.c06.decoteTme.toFixed(2).replace('.', ',')} % dans la décote, un pic à 43,58 % entre
            29 579 € et 29 594 €, et la vraie falaise de 61 € (+6 100 %) due à l’article 1657 1 bis.
          </p>
          <p class="mt-3 text-sm font-medium text-brand-strong">
            14/14 tests Catala · 10 000 foyers en différentiel (0 divergence) · 93,75 % mutation · {data.c06.totalCliffs1657} falaises 61 €
          </p>
        </div>
        <div class="lg:col-span-4 lg:text-right">
          <a
            href="/experiences/impot-revenu"
            class="inline-flex items-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white no-underline hover:bg-brand-strong"
          >
            Ouvrir le simulateur →
          </a>
        </div>
      </li>

      <li class="grid gap-4 py-8 lg:grid-cols-12 lg:items-baseline">
        <div class="lg:col-span-8">
          <h2 class="font-serif text-2xl font-semibold text-ink sm:text-3xl">
            <a href="/experiences/allocations-familiales" class="no-underline hover:underline">
              Allocations familiales : test à l’aveugle face à Inria
            </a>
          </h2>
          <p class="mt-2.5 max-w-[62ch] text-base leading-relaxed text-muted">
            Une intelligence artificielle a reçu uniquement le texte officiel du Code de la sécurité sociale, sans voir
            ni le programme ni les tests des chercheurs d’Inria. Sur 17 cas officiels, 12 sont réussis (dont 9 montants
            identiques au centime), 3 diffèrent de 0,01 € par arrondi, et 2 vrais écarts (Guyane et Mayotte) sont en cours
            d’examen juridique.
          </p>
          <p class="mt-3 text-sm font-medium text-notice-ink">
            Résultat provisoire · en attente de relecture humaine
          </p>
        </div>
        <div class="lg:col-span-4 lg:text-right">
          <a href="/experiences/allocations-familiales" class="text-sm font-semibold">
            Voir les 17 cas en euros →
          </a>
        </div>
      </li>

      <li class="grid gap-4 py-8 lg:grid-cols-12 lg:items-baseline">
        <div class="lg:col-span-8">
          <h2 class="font-serif text-2xl font-semibold text-ink sm:text-3xl">
            Rappel des ambiguïtés juridiques connues (C0.4)
          </h2>
          <p class="mt-2.5 max-w-[62ch] text-base leading-relaxed text-muted">
            Les chercheurs d’Inria et de la DGFiP ont noté {data.c04.totalGroundTruth} questions d’interprétation et
            dépendances à la doctrine fiscale dans leurs programmes publics, dont {data.c04.inPacket} portent sur des
            versions d’articles présentes dans notre base. Sans jamais voir les travaux d’Inria, un analyste IA aveugle
            (Gemini 4 Neon) en retrouve <strong>{data.c04.blindMatched} sur {data.c04.inPacket} ({data.c04.blindRecallPct.toFixed(2).replace('.', ',')} %)</strong>,
            contre {data.c04.baselineMatched} sur {data.c04.inPacket} ({data.c04.baselineRecallPct !== null ? `${data.c04.baselineRecallPct.toFixed(2).replace('.', ',')} %` : '0 %'})
            pour un détecteur purement mécanique.
          </p>
          <p class="mt-3 text-xs text-muted">
            Un compte, pas une probabilité · {data.c04.blindObservations} observations aveugles vérifiées sans fuite.
          </p>
        </div>
        <div class="lg:col-span-4 lg:text-right">
          <a
            href="https://github.com/theonaciri/bugdeloi/blob/j0-fondations/replications/c0.4/REPORT.md"
            rel="external"
            class="text-sm font-semibold"
          >
            Lire le rapport C0.4 →
          </a>
        </div>
      </li>
    </ul>
  </div>
</section>
