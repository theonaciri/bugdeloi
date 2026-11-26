<script lang="ts">
import type { PageProps } from './$types'

let { data }: PageProps = $props()

const c08 = $derived(data.c08)
const fmtInt = (n: number) => new Intl.NumberFormat('fr-FR').format(n)
const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n)

const arrondiGroup = $derived(data.arrondiGroup)
const perimetreGroups = $derived(data.perimetreGroups)

const GITHUB_BASE = 'https://github.com/theonaciri/bugdeloi/blob/main/replications/c0.8-openfisca'
</script>

<svelte:head>
  <title>Comparaison croisée avec OpenFisca-France (C0.8) · BugDeLoi</title>
  <meta
    name="description"
    content="Comment BugDeLoi compare ses calculs d'impôt sur le revenu et d'allocations familiales à OpenFisca-France sur 328 foyers, et pourquoi un écart d'arrondi à 17 593 € est mis à l'étude."
  />
</svelte:head>

<section class="bg-bg">
  <div class="container-wide py-12 sm:py-16">
    <p class="text-sm font-medium text-muted">
      <a href="/experiences" class="no-underline hover:underline">Expériences d’étalonnage</a>
      <span class="mx-1.5">/</span>
      <span>Comparaison OpenFisca-France (C0.8)</span>
    </p>
    <h1 class="mt-4 max-w-4xl font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
      Vérifier nos calculs face à OpenFisca-France
    </h1>
    <p class="mt-5 max-w-[68ch] text-lg leading-relaxed text-muted">
      Un programme ne peut jamais se valider lui-même. Pour vérifier nos formalisations de l’impôt sur le revenu
      (2026) et des allocations familiales, nous les confrontons automatiquement à
      <strong>OpenFisca-France {c08.versions.openfisca_france}</strong>, un moteur socio-fiscal libre indépendant
      maintenu par une autre équipe.
    </p>

    <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-xl border border-line bg-surface p-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-muted">Foyers comparés</p>
        <p class="mt-2 font-serif text-3xl font-semibold text-ink">{fmtInt(c08.foyersCompares)}</p>
        <p class="mt-1 text-xs text-muted">
          {fmtInt(c08.foyersGeneres.ir)} impôt sur le revenu · {fmtInt(c08.foyersGeneres.af)} allocations familiales
        </p>
      </div>
      <div class="rounded-xl border border-line bg-surface p-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-muted">Allocations familiales</p>
        <p class="mt-2 font-serif text-3xl font-semibold text-brand-strong">100 %</p>
        <p class="mt-1 text-xs text-muted">Accord exact sur tous les foyers dans le périmètre</p>
      </div>
      <div class="rounded-xl border border-line bg-surface p-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-muted">Différences de périmètre</p>
        <p class="mt-2 font-serif text-3xl font-semibold text-ink">
          {fmtInt(c08.ecartsParCategorie.difference_de_perimetre)}
        </p>
        <p class="mt-1 text-xs text-muted">Règles modélisées d’un seul côté (CEHR, outre-mer, enfant 20 ans)</p>
      </div>
      <div class="rounded-xl border border-line bg-surface p-5">
        <p class="text-xs font-semibold uppercase tracking-wide text-muted">Candidat d’arrondi</p>
        <p class="mt-2 font-serif text-3xl font-semibold text-notice-ink">
          {fmtInt(c08.ecartsParCategorie.divergence_simulateur)}
        </p>
        <p class="mt-1 text-xs text-muted">Tous liés au même ordre d’arrondi autour de la décote</p>
      </div>
    </div>
  </div>
</section>

<section class="border-t border-line bg-surface">
  <div class="container-wide py-12 sm:py-16">
    <h2 class="font-serif text-2xl font-semibold text-ink sm:text-3xl">
      Ce que la comparaison a mis au jour : un candidat d’arrondi à 17 593 €
    </h2>
    <p class="mt-4 max-w-[68ch] text-base leading-relaxed text-muted">
      Sur les {fmtInt(c08.foyersGeneres.ir)} foyers testés pour l’impôt sur le revenu, {fmtInt(c08.ecartsParCategorie.divergence_simulateur)}
      présentent un écart avec OpenFisca-France. Tous disparaissent si l’on arrondit l’impôt brut à l’euro avant
      d’appliquer la décote, puis que l’on arrondit la décote elle-même.
    </p>
    <p class="mt-3 max-w-[68ch] text-base leading-relaxed text-muted">
      En temps normal, cet ordre d’arrondi change l’impôt d’au plus 1 €. Mais juste à côté du seuil de recouvrement
      de 61 € (article 1657 1 bis du CGI), ce seul euro fait basculer l’impôt de <strong>0 € à 61 €</strong> :
    </p>

    {#if arrondiGroup}
      <div class="mt-6 overflow-x-auto rounded-xl border border-line bg-bg">
        <table class="w-full border-collapse text-left text-sm">
          <thead>
            <tr class="border-b border-line bg-surface text-xs uppercase tracking-wide text-muted">
              <th class="px-4 py-3 font-semibold">Foyer exemple</th>
              <th class="px-4 py-3 font-semibold">Revenu imposable</th>
              <th class="px-4 py-3 font-semibold">BugDeLoi (arrondi en fin de calcul)</th>
              <th class="px-4 py-3 font-semibold">OpenFisca (arrondi avant décote)</th>
              <th class="px-4 py-3 font-semibold">Écart</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            {#each arrondiGroup.exemples as ex}
              <tr>
                <td class="px-4 py-3 font-medium text-ink">
                  {ex.entree.situationFamiliale}{ex.entree.agesEnfants.length > 0 ? `, ${ex.entree.agesEnfants.length} enfant(s)` : ''}
                </td>
                <td class="px-4 py-3 tabular-nums text-ink">{fmtEur(ex.entree.revenuEuros)}</td>
                <td class="px-4 py-3 tabular-nums font-semibold text-ink">{fmtEur(ex.bugdeloi)}</td>
                <td class="px-4 py-3 tabular-nums font-semibold text-brand-strong">{fmtEur(ex.openfisca)}</td>
                <td class="px-4 py-3 tabular-nums font-semibold text-notice-ink">
                  {fmtEur(Math.abs(ex.bugdeloi - ex.openfisca))}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <p class="mt-4 max-w-[68ch] text-sm leading-relaxed text-muted">
      <strong>Point de méthode :</strong> un écart entre deux simulateurs ne dit pas qui a raison. Il signale un
      candidat de type <code>ARRONDI</code> à soumettre à une relecture juridique humaine du texte officiel et de la
      doctrine fiscale.
    </p>
  </div>
</section>

<section class="border-t border-line bg-bg">
  <div class="container-wide py-12 sm:py-16">
    <h2 class="font-serif text-2xl font-semibold text-ink sm:text-3xl">
      Les {fmtInt(c08.ecartsParCategorie.difference_de_perimetre)} différences de périmètre expliquées
    </h2>
    <p class="mt-3 max-w-[68ch] text-base leading-relaxed text-muted">
      Chaque autre écart est classé explicitement : il correspond à une règle fiscale présente dans OpenFisca-France
      mais volontairement hors périmètre de notre noyau C0.6 actuel.
    </p>
    <ul class="mt-6 space-y-3">
      {#each perimetreGroups as grp}
        <li class="rounded-xl border border-line bg-surface p-5">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <span class="font-semibold text-ink">{grp.motif}</span>
            <span class="text-xs font-semibold uppercase tracking-wide text-muted">
              {grp.nombre} foyer{grp.nombre > 1 ? 's' : ''} · {grp.domaine.toUpperCase()}
            </span>
          </div>
        </li>
      {/each}
    </ul>
  </div>
</section>

<section class="border-t border-line bg-surface">
  <div class="container-wide py-12 sm:py-16">
    <h2 class="font-serif text-2xl font-semibold text-ink sm:text-3xl">
      Données brutes et reproductibilité
    </h2>
    <p class="mt-3 max-w-[68ch] text-base leading-relaxed text-muted">
      Tous les scénarios, le pont Python vers OpenFisca-France {c08.versions.openfisca_france}, le rapport complet et
      les résultats JSON sont publics. Vous pouvez relancer la comparaison sur votre machine avec
      <code>bun replications/c0.8-openfisca/run.ts</code>.
    </p>
    <div class="mt-6 flex flex-wrap gap-3">
      <a
        href="{GITHUB_BASE}/REPORT.md"
        rel="external"
        class="inline-flex items-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white no-underline hover:bg-brand-strong"
      >
        Lire le rapport C0.8 sur GitHub →
      </a>
      <a
        href="{GITHUB_BASE}/summary.json"
        rel="external"
        class="inline-flex items-center rounded-full border border-line bg-bg px-5 py-2.5 text-sm font-semibold text-ink no-underline hover:border-brand"
      >
        Télécharger summary.json →
      </a>
      <a
        href="/experiences/revenu-disponible"
        class="inline-flex items-center rounded-full border border-line bg-bg px-5 py-2.5 text-sm font-semibold text-ink no-underline hover:border-brand"
      >
        Tester le simulateur revenu disponible →
      </a>
    </div>
  </div>
</section>
