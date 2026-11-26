<script lang="ts">
import {
  AMENDEMENTS_EXEMPLES,
  calculRevenuDisponible,
  simulerAmendementIR,
} from '../../../../../../replications/c0.7/revenu-disponible.ts'

let revenuEuros = $state(44461)
let situation = $state<'couple' | 'parent_isole'>('couple')
let enfants = $state(2)
let enfantsPlus14 = $state(0)
let selectedAmendmentId = $state(AMENDEMENTS_EXEMPLES[0]?.id ?? 'indexation-2pct')

const foyer = $derived({
  situationFamiliale: situation === 'couple' ? ('ImpositionCommune' as const) : ('Célibataire' as const),
  enfantsAChargeExclusiveOuPrincipale: enfants,
  appreciationVitSeul: situation === 'parent_isole',
  domicileFiscal: 'Métropole' as const,
})

const res = $derived(calculRevenuDisponible(revenuEuros, foyer, Math.min(enfants, enfantsPlus14)))
const resAvant = $derived(
  calculRevenuDisponible(Math.max(0, revenuEuros - 1), foyer, Math.min(enfants, enfantsPlus14)),
)
const deltaDisponible = $derived(
  Math.round((res.revenuDisponibleEuros - resAvant.revenuDisponibleEuros) * 100) / 100,
)

const amendementActif = $derived(
  AMENDEMENTS_EXEMPLES.find((a) => a.id === selectedAmendmentId) ?? AMENDEMENTS_EXEMPLES[0]!,
)

const foyersComparaison = [
  {
    label: 'Célibataire (1 part) · 25 000 €',
    rev: 25000,
    foyer: {
      situationFamiliale: 'Célibataire' as const,
      enfantsAChargeExclusiveOuPrincipale: 0,
      appreciationVitSeul: false,
      domicileFiscal: 'Métropole' as const,
    },
  },
  {
    label: 'Célibataire falaise 61 € · 17 592 €',
    rev: 17592,
    foyer: {
      situationFamiliale: 'Célibataire' as const,
      enfantsAChargeExclusiveOuPrincipale: 0,
      appreciationVitSeul: false,
      domicileFiscal: 'Métropole' as const,
    },
  },
  {
    label: 'Couple sans enfant (2 parts) · 55 000 €',
    rev: 55000,
    foyer: {
      situationFamiliale: 'ImpositionCommune' as const,
      enfantsAChargeExclusiveOuPrincipale: 0,
      appreciationVitSeul: false,
      domicileFiscal: 'Métropole' as const,
    },
  },
  {
    label: 'Couple 2 enfants (3 parts) · 90 000 €',
    rev: 90000,
    foyer: {
      situationFamiliale: 'ImpositionCommune' as const,
      enfantsAChargeExclusiveOuPrincipale: 2,
      appreciationVitSeul: false,
      domicileFiscal: 'Métropole' as const,
    },
  },
]

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const trancheLabel: Record<string, string> = {
  taux_plein: 'Taux plein (tranche 1)',
  taux_reduit_50: 'Divisées par 2 (tranche 2, avec lissage dégressif)',
  taux_reduit_25: 'Divisées par 4 (tranche 3, avec lissage dégressif)',
  non_eligible: 'Moins de 2 enfants (non éligible en métropole)',
}
</script>

<svelte:head>
  <title>Revenu disponible réel et simulateur d’amendement · BugDeLoi</title>
  <meta
    name="description"
    content="Croisez l’impôt sur le revenu 2026 et les allocations familiales pour voir votre revenu disponible réel, et mesurez en euros l’impact d’un amendement."
  />
</svelte:head>

<section class="bg-bg">
  <div class="container-wide py-12 sm:py-16">
    <p class="text-sm"><a href="/experiences">← Toutes les expériences</a></p>
    <h1 class="mt-4 max-w-4xl font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
      Revenu disponible réel et impact d’un amendement
    </h1>
    <p class="mt-5 max-w-[68ch] text-lg leading-relaxed text-muted">
      Dans la vie réelle, un foyer ne subit jamais une seule loi isolément : l’impôt sur le revenu (Code général des
      impôts) et les allocations familiales (Code de la sécurité sociale) s’additionnent. Ce simulateur les croise en
      direct dans votre navigateur et permet de tester l’effet en euros d’une modification de la loi.
    </p>
  </div>
</section>

<section class="border-t border-line bg-surface" aria-labelledby="combo-titre">
  <div class="container-wide py-12 sm:py-16">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <h2 id="combo-titre" class="font-serif text-2xl font-semibold text-ink sm:text-3xl">
        1. Croiser Impôt 2026 et Allocations familiales
      </h2>
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          onclick={() => {
            situation = 'couple'
            enfants = 2
            revenuEuros = 44460
          }}
          class="cursor-pointer rounded-full border border-line bg-bg px-3.5 py-1.5 text-xs font-medium text-ink hover:border-brand"
        >
          Avant falaise 61 € (44 460 €)
        </button>
        <button
          type="button"
          onclick={() => {
            situation = 'couple'
            enfants = 2
            revenuEuros = 44461
          }}
          class="cursor-pointer rounded-full border border-line bg-bg px-3.5 py-1.5 text-xs font-medium text-ink hover:border-brand"
        >
          Falaise +1 € = -60 € net (44 461 €)
        </button>
        <button
          type="button"
          onclick={() => {
            situation = 'couple'
            enfants = 2
            revenuEuros = 84000
          }}
          class="cursor-pointer rounded-full border border-line bg-bg px-3.5 py-1.5 text-xs font-medium text-ink hover:border-brand"
        >
          Zone de modulation AF (84 000 €)
        </button>
      </div>
    </div>

    <div class="mt-8 grid gap-10 lg:grid-cols-12">
      <div class="space-y-5 lg:col-span-5">
        <div>
          <div class="flex items-baseline justify-between gap-3">
            <label for="rd-rev" class="text-sm font-semibold text-ink">Revenu net imposable annuel</label>
            <input
              id="rd-rev-num"
              type="number"
              min="0"
              max="200000"
              step="1"
              bind:value={revenuEuros}
              aria-label="Revenu annuel en euros"
              class="w-28 rounded-lg border border-line bg-bg px-2.5 py-1 text-right font-mono text-sm font-semibold text-ink tabular"
            />
          </div>
          <input id="rd-rev" type="range" min="0" max="140000" step="100" bind:value={revenuEuros} class="mt-3 w-full accent-brand" />
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label for="rd-sit" class="block text-sm font-semibold text-ink">Foyer</label>
            <select id="rd-sit" bind:value={situation} class="mt-1.5 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink">
              <option value="couple">Couple marié ou pacsé</option>
              <option value="parent_isole">Parent isolé vivant seul</option>
            </select>
          </div>
          <div>
            <label for="rd-enf" class="block text-sm font-semibold text-ink">Enfants à charge</label>
            <input id="rd-enf" type="number" min="1" max="5" bind:value={enfants} class="mt-1.5 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink tabular" />
          </div>
        </div>
        <p class="text-xs text-muted">
          Allocations familiales : {trancheLabel[res.trancheAF]}.
        </p>
      </div>

      <div class="space-y-6 lg:col-span-7">
        <div class="grid gap-6 border-b border-line pb-6 sm:grid-cols-3">
          <div>
            <p class="text-xs font-medium text-muted">Impôt mis en recouvrement</p>
            <p class="mt-1 font-serif text-3xl font-semibold text-ko tabular">- {euros.format(res.impotMisEnRecouvrementEuros)}</p>
            <p class="mt-1 text-xs text-muted">CGI art. 193-197 &amp; 1657 1 bis</p>
          </div>
          <div>
            <p class="text-xs font-medium text-muted">Allocations familiales / an</p>
            <p class="mt-1 font-serif text-3xl font-semibold text-ok tabular">+ {euros.format(res.allocationsFamilialesAnnuellesEuros)}</p>
            <p class="mt-1 text-xs text-muted">CSS art. L521-1 &amp; D521-1</p>
          </div>
          <div>
            <p class="text-xs font-medium text-muted">Revenu disponible annuel</p>
            <p class="mt-1 font-serif text-3xl font-semibold text-ink tabular">{euros.format(res.revenuDisponibleEuros)}</p>
            <p class="mt-1 text-xs {deltaDisponible < 0 ? 'font-semibold text-ko' : 'text-muted'}">
              Effet du dernier +1 € : {deltaDisponible >= 0 ? '+' : ''}{euros.format(deltaDisponible)}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="border-t border-line bg-bg" aria-labelledby="amendement-titre">
  <div class="container-wide py-12 sm:py-16">
    <h2 id="amendement-titre" class="font-serif text-2xl font-semibold text-ink sm:text-3xl">
      2. Mesurer l’impact en euros d’un amendement parlementaire
    </h2>
    <p class="mt-3 max-w-[68ch] text-base leading-relaxed text-muted">
      Choisissez une hypothèse de modification de la loi (type projet de loi de finances) pour comparer instantanément
      l’impôt en vigueur en 2026 et l’impôt après amendement sur quatre foyers types.
    </p>

    <div class="mt-6 flex flex-wrap gap-2.5">
      {#each AMENDEMENTS_EXEMPLES as am (am.id)}
        <button
          type="button"
          onclick={() => (selectedAmendmentId = am.id)}
          aria-pressed={selectedAmendmentId === am.id}
          class="cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition {selectedAmendmentId === am.id
            ? 'border-brand bg-brand-soft text-brand-strong'
            : 'border-line bg-surface text-ink hover:bg-surface-2'}"
        >
          {am.titre}
        </button>
      {/each}
    </div>
    <p class="mt-3 text-sm text-muted">{amendementActif.description}</p>

    <div class="mt-6 overflow-x-auto">
      <table class="w-full min-w-[38rem] border-collapse text-left text-sm">
        <thead>
          <tr class="border-b border-line-strong text-muted">
            <th scope="col" class="py-3 pr-4 font-semibold">Foyer type</th>
            <th scope="col" class="py-3 pr-4 font-semibold">Loi en vigueur 2026</th>
            <th scope="col" class="py-3 pr-4 font-semibold">Après amendement</th>
            <th scope="col" class="py-3 font-semibold">Différence en euros</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          {#each foyersComparaison as item (item.label)}
            {@const diff = simulerAmendementIR(item.rev, item.foyer, amendementActif)}
            <tr>
              <th scope="row" class="py-3.5 pr-4 font-medium text-ink">{item.label}</th>
              <td class="py-3.5 pr-4 font-mono tabular">{euros.format(diff.loiEnVigueurEuros)}</td>
              <td class="py-3.5 pr-4 font-mono tabular">{euros.format(diff.apresAmendementEuros)}</td>
              <td class="py-3.5 font-mono font-semibold tabular {diff.ecartEuros < 0 ? 'text-ok' : diff.ecartEuros > 0 ? 'text-ko' : 'text-muted'}">
                {diff.ecartEuros > 0 ? '+' : ''}{euros.format(diff.ecartEuros)}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</section>
