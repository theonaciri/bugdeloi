<script lang="ts">
import type { PageProps } from './$types'

let { data }: PageProps = $props()

const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

const fmtDelta = (n: number) =>
  `${n > 0 ? '+' : ''}${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)}`

const GITHUB_BASE = 'https://github.com/theonaciri/bugdeloi/tree/main/packages/parlement'
</script>

<svelte:head>
  <title>Veille parlementaire : impact en euros d’un amendement · BugDeLoi</title>
  <meta
    name="description"
    content="Comment BugDeLoi lit des amendements au format Tricoteuses, repère les articles formalisés et calcule automatiquement l'écart en euros sur quatre foyers types."
  />
</svelte:head>

<section class="bg-bg">
  <div class="container-wide py-12 sm:py-16">
    <p class="text-sm font-medium text-muted">
      <a href="/experiences" class="no-underline hover:underline">Expériences d’étalonnage</a>
      <span class="mx-1.5">/</span>
      <span>Veille parlementaire (Tricoteuses)</span>
    </p>
    <h1 class="mt-4 max-w-4xl font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
      Mesurer l’effet d’un amendement en euros avant le vote
    </h1>
    <p class="mt-5 max-w-[68ch] text-lg leading-relaxed text-muted">
      Quand un amendement budgétaire modifie un article de loi déjà formalisé, notre moteur
      <code>packages/parlement</code> lit son dispositif au format ouvert <strong>Tricoteuses</strong> (données de
      l’Assemblée nationale), vérifie quels articles sont touchés et calcule l’écart d’impôt en euros sur quatre
      foyers types.
    </p>
    <p class="mt-3 max-w-[68ch] text-base leading-relaxed text-muted">
      <strong>Principe de prudence :</strong> seul le dispositif juridique fixe des paramètres. Dès qu’une phrase
      n’est pas entièrement reconnue ou contient une contradiction, l’amendement passe en
      <code>non_calculable</code> : aucun chiffre partiel n’est publié.
    </p>
  </div>
</section>

<section class="border-t border-line bg-surface">
  <div class="container-wide py-12 sm:py-16">
    <h2 class="font-display text-2xl font-semibold text-ink sm:text-3xl">
      Les {data.articlesSuivis.length} articles actuellement suivis
    </h2>
    <p class="mt-3 max-w-[68ch] text-base leading-relaxed text-muted">
      Chaque article est rattaché à son identifiant officiel <code>LEGIARTI</code> et à sa date de version en base.
    </p>
    <div class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {#each data.articlesSuivis as art}
        <a
          href="/article/{art.legiarti}"
          class="rounded-xl border border-line bg-bg p-4 no-underline transition hover:border-brand"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-muted">{art.code}</p>
          <p class="mt-1 font-display text-lg font-semibold text-ink">Article {art.article}</p>
          <p class="mt-1 font-mono text-xs text-muted">{art.legiarti}</p>
        </a>
      {/each}
    </div>
  </div>
</section>

<section class="border-t border-line bg-bg">
  <div class="container-wide py-12 sm:py-16">
    <h2 class="font-display text-2xl font-semibold text-ink sm:text-3xl">
      Exemples de démonstration (amendements fictifs PLF 2026)
    </h2>
    <p class="mt-3 max-w-[68ch] text-base leading-relaxed text-muted">
      Les trois amendements ci-dessous proviennent du jeu de test
      <code>packages/parlement/src/fixtures/plf2026-sample.json</code>. Ils sont marqués comme fictifs et servent à
      vérifier la chaîne de lecture et de calcul (42 tests unitaires verts).
    </p>

    <div class="mt-8 space-y-8">
      {#each data.resultats as item}
        <article class="rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h3 class="font-display text-xl font-semibold text-ink sm:text-2xl">
              Amendement {item.amendement.numero} ({item.amendement.articleCible})
            </h3>
            <span class="rounded-full border border-line bg-bg px-3 py-1 text-xs font-semibold text-brand-strong">
              {item.impact.statut === 'calcule' ? 'Calculé automatiquement' : 'Non calculable (lecture humaine)'}
            </span>
          </div>

          <p class="mt-3 rounded-lg border border-line bg-bg p-4 font-mono text-xs leading-relaxed text-ink">
            {item.amendement.dispositif}
          </p>

          {#if item.impact.statut === 'calcule'}
            <div class="mt-5 overflow-x-auto rounded-xl border border-line bg-bg">
              <table class="w-full border-collapse text-left text-sm">
                <thead>
                  <tr class="border-b border-line bg-surface text-xs uppercase tracking-wide text-muted">
                    <th class="px-4 py-3 font-semibold">Foyer type</th>
                    <th class="px-4 py-3 font-semibold">Loi en vigueur (2026)</th>
                    <th class="px-4 py-3 font-semibold">Après amendement</th>
                    <th class="px-4 py-3 font-semibold">Écart annuel</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-line">
                  {#each item.impact.foyers as f}
                    <tr>
                      <td class="px-4 py-3 font-medium text-ink">{f.libelle}</td>
                      <td class="px-4 py-3 tabular-nums text-muted">{fmtEur(f.loiEnVigueurEuros)}</td>
                      <td class="px-4 py-3 tabular-nums font-semibold text-ink">{fmtEur(f.apresAmendementEuros)}</td>
                      <td
                        class="px-4 py-3 tabular-nums font-semibold {f.ecartEuros > 0
                          ? 'text-notice-ink'
                          : f.ecartEuros < 0
                            ? 'text-brand-strong'
                            : 'text-muted'}"
                      >
                        {fmtDelta(f.ecartEuros)}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <p class="mt-4 text-sm text-notice-ink">{item.impact.motif}</p>
          {/if}
        </article>
      {/each}
    </div>
  </div>
</section>

<section class="border-t border-line bg-surface">
  <div class="container-wide py-12 sm:py-16">
    <h2 class="font-display text-2xl font-semibold text-ink sm:text-3xl">
      Code source et expériences liées
    </h2>
    <p class="mt-3 max-w-[68ch] text-base leading-relaxed text-muted">
      Le parseur Tricoteuses, les règles d’extraction stricte et le moteur d’impact sont ouverts et testables en
      ligne de commande avec <code>bun test packages/parlement/src/</code>.
    </p>
    <div class="mt-6 flex flex-wrap gap-3">
      <a
        href={GITHUB_BASE}
        rel="external"
        class="inline-flex items-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white no-underline hover:bg-brand-strong"
      >
        Voir packages/parlement sur GitHub →
      </a>
      <a
        href="/experiences/revenu-disponible"
        class="inline-flex items-center rounded-full border border-line bg-bg px-5 py-2.5 text-sm font-semibold text-ink no-underline hover:border-brand"
      >
        Simulateur revenu disponible →
      </a>
      <a
        href="/experiences/openfisca"
        class="inline-flex items-center rounded-full border border-line bg-bg px-5 py-2.5 text-sm font-semibold text-ink no-underline hover:border-brand"
      >
        Comparaison OpenFisca-France →
      </a>
    </div>
  </div>
</section>
