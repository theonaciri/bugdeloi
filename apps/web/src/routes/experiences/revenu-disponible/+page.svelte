<script lang="ts">
import { SOURCES } from '../../../../../../replications/c0.7/parametres.ts'
import {
  AMENDEMENTS_EXEMPLES,
  calculRevenuDisponible,
  HYPOTHESES,
  type OptionsRevenuDisponible,
  type ResultatRevenuDisponible,
  simulerAmendementIR,
  type ZoneLogement,
} from '../../../../../../replications/c0.7/revenu-disponible.ts'
import balayage from '../../../../../../replications/c0.7/summary.json'

let revenuSaisi = $state(44461)
let situation = $state<'couple' | 'seul'>('couple')
let enfants = $state(2)
let gardeAlternee = $state(false)
let enfantsAlternesChoisis = $state(1)
let locataire = $state(true)
let loyerSaisi = $state(750)
let zone = $state<ZoneLogement>(2)
let activite = $state(true)
let deuxRevenus = $state(false)
let isoleMajore = $state(false)
let compterAlternes = $state(false)
let adultesInvalides = $state(0)
let ancienCombattant = $state(false)
let selectedAmendmentId = $state(AMENDEMENTS_EXEMPLES[0]?.id ?? 'indexation-2pct')

const revenu = $derived(Math.round(Math.max(0, Number(revenuSaisi) || 0)))
const loyer = $derived(Math.max(0, Number(loyerSaisi) || 0))
const enfantsAlternes = $derived(gardeAlternee ? enfantsAlternesChoisis : 0)

const foyer = $derived({
  situationFamiliale: situation === 'couple' ? ('ImpositionCommune' as const) : ('Célibataire' as const),
  enfantsAChargeExclusiveOuPrincipale: enfants,
  enfantsEnResidenceAlternee: enfantsAlternes,
  appreciationVitSeul: situation === 'seul',
  domicileFiscal: 'Métropole' as const,
  adultesInvalides: situation === 'couple' ? adultesInvalides : Math.min(adultesInvalides, 1),
  ancienCombattantPlus74: ancienCombattant,
})

const options = $derived<OptionsRevenuDisponible>({
  ...(locataire ? { logement: { zone, loyerMensuelEuros: loyer } } : {}),
  ...(activite
    ? {
        activite: {
          deuxRevenus,
          appreciationIsoleMajore: isoleMajore,
          appreciationCompterEnfantsAlternes: compterAlternes,
        },
      }
    : {}),
})

const res = $derived(calculRevenuDisponible(revenu, foyer, options))
const resAvant = $derived(calculRevenuDisponible(Math.max(0, revenu - 1), foyer, options))

const centimes = (n: number) => Math.round(n * 100) / 100

type Ligne = {
  signe: '' | '+' | '-'
  titre: string
  detail: string
  valeur: (r: ResultatRevenuDisponible) => number
  calculee: boolean
}

const lignes = $derived<Ligne[]>([
  {
    signe: '',
    titre: 'Revenu de l’année',
    detail: 'Le montant saisi',
    valeur: (r) => r.revenuNetImposableEuros,
    calculee: true,
  },
  {
    signe: '-',
    titre: 'Impôt sur le revenu',
    detail: 'CGI art. 193 à 197 et 1657',
    valeur: (r) => r.impotMisEnRecouvrementEuros,
    calculee: true,
  },
  {
    signe: '+',
    titre: 'Allocations familiales',
    detail: 'Sécurité sociale, art. L521-1 et D521-1',
    valeur: (r) => r.allocationsFamilialesAnnuellesEuros,
    calculee: true,
  },
  {
    signe: '+',
    titre: 'Aide au logement (APL)',
    detail: 'Construction et habitation, art. D823-16',
    valeur: (r) => r.aideLogementAnnuelleEuros,
    calculee: locataire,
  },
  {
    signe: '+',
    titre: 'Prime d’activité',
    detail: 'Sécurité sociale, art. L842-3',
    valeur: (r) => r.primeActiviteAnnuelleEuros,
    calculee: activite,
  },
  {
    signe: '+',
    titre: 'Revenu de solidarité active (RSA)',
    detail: 'Action sociale et familles, art. L262-2',
    valeur: (r) => r.rsaAnnuelEuros,
    calculee: activite,
  },
])

const deltaDisponible = $derived(centimes(res.revenuDisponibleEuros - resAvant.revenuDisponibleEuros))

const amendementActif = $derived(
  AMENDEMENTS_EXEMPLES.find((a) => a.id === selectedAmendmentId) ?? AMENDEMENTS_EXEMPLES[0],
)

const baisses = balayage.effetsDeSeuil.filter((e) => e.variationRevenuDisponibleEuros < 0)
const plagesEnBaisse = balayage.plagesSansGain.filter((p) => p.variationRevenuDisponibleEuros <= -1)

function essayerFoyerEtudie(revenuChoisi: number) {
  revenuSaisi = revenuChoisi
  situation = 'couple'
  enfants = 2
  gardeAlternee = false
  locataire = true
  loyerSaisi = balayage.foyer.loyerMensuelEuros
  zone = 2
  activite = true
  deuxRevenus = false
  adultesInvalides = 0
  ancienCombattant = false
}

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
const signes = (n: number) => `${n > 0 ? '+' : ''}${euros.format(n)}`
const couleur = (n: number) => (n < 0 ? 'text-ko' : n > 0 ? 'text-ok' : 'text-muted')
const trancheLabel: Record<ResultatRevenuDisponible['trancheAF'], string> = {
  taux_plein: 'montant entier',
  taux_reduit_50: 'montant divisé par 2, avec une transition juste après le plafond',
  taux_reduit_25: 'montant divisé par 4, avec une transition juste après le plafond',
  non_eligible: 'aucune, car il faut au moins deux enfants à charge',
}
const champ = 'mt-1.5 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink tabular'
const coche = 'flex items-start gap-2.5 text-sm text-ink'
</script>

<svelte:head>
  <title>Revenu disponible réel et simulateur d’amendement · BugDeLoi</title>
  <meta
    name="description"
    content="Additionnez impôt sur le revenu, allocations familiales, aide au logement, prime d’activité et RSA, puis mesurez en euros l’impact d’un amendement."
  />
</svelte:head>

<section class="bg-bg">
  <div class="container-wide py-12 sm:py-16">
    <p class="text-sm"><a href="/experiences">← Toutes les expériences</a></p>
    <h1 class="mt-4 max-w-4xl font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
      Revenu disponible réel et impact d’un amendement
    </h1>
    <p class="mt-5 max-w-[68ch] text-lg leading-relaxed text-muted">
      Un foyer ne subit jamais une seule loi à la fois. Ici, cinq règles s’additionnent : l’impôt sur le revenu, les
      allocations familiales, l’aide au logement, la prime d’activité et le revenu de solidarité active (RSA). Le calcul
      se fait dans votre navigateur.
    </p>
    <p class="mt-3 max-w-[68ch] text-sm leading-relaxed text-muted">
      Modèle simplifié, non relu par un juriste. Il montre comment les règles se combinent. Il ne donne pas le montant
      que vous toucherez.
    </p>
  </div>
</section>

<section class="border-t border-line bg-surface" aria-labelledby="combo-titre">
  <div class="container-wide py-12 sm:py-16">
    <h2 id="combo-titre" class="font-serif text-2xl font-semibold text-ink sm:text-3xl">
      1. Impôt + allocations familiales + APL + prime d’activité et RSA
    </h2>

    <div class="mt-8 grid gap-10 lg:grid-cols-12">
      <div class="space-y-6 lg:col-span-5">
        <div>
          <div class="flex items-baseline justify-between gap-3">
            <label for="rd-rev-num" class="text-sm font-semibold text-ink">Revenu annuel du foyer (€)</label>
            <input
              id="rd-rev-num"
              type="number"
              min="0"
              max="200000"
              step="1"
              bind:value={revenuSaisi}
              class="w-28 rounded-lg border border-line bg-bg px-2.5 py-1 text-right font-mono text-sm font-semibold text-ink tabular"
            />
          </div>
          <input
            type="range"
            min="0"
            max="140000"
            step="100"
            bind:value={revenuSaisi}
            aria-label="Revenu annuel du foyer, curseur"
            class="mt-3 w-full accent-brand"
          />
          <p class="mt-1 text-xs text-muted">Revenu net imposable, avant déduction de l’impôt.</p>
        </div>

        <fieldset class="space-y-3">
          <legend class="text-sm font-semibold text-ink">Le foyer</legend>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block text-sm text-ink">
              Situation
              <select bind:value={situation} class={champ}>
                <option value="couple">Couple marié ou pacsé</option>
                <option value="seul">Adulte vivant seul</option>
              </select>
            </label>
            <label class="block text-sm text-ink">
              Enfants à charge principale
              <select bind:value={enfants} class={champ}>
                {#each [0, 1, 2, 3, 4, 5] as n (n)}
                  <option value={n}>{n}</option>
                {/each}
              </select>
            </label>
          </div>
          <label class={coche}>
            <input type="checkbox" bind:checked={gardeAlternee} class="mt-1 accent-brand" />
            <span>Des enfants sont en garde alternée (une partie du temps chez chaque parent)</span>
          </label>
          {#if gardeAlternee}
            <label class="block text-sm text-ink">
              Enfants en garde alternée
              <select bind:value={enfantsAlternesChoisis} class={champ}>
                {#each [1, 2, 3, 4] as n (n)}
                  <option value={n}>{n}</option>
                {/each}
              </select>
            </label>
          {/if}
        </fieldset>

        <fieldset class="space-y-3">
          <legend class="text-sm font-semibold text-ink">Le logement</legend>
          <label class={coche}>
            <input type="checkbox" bind:checked={locataire} class="mt-1 accent-brand" />
            <span>Le foyer est locataire : calculer l’aide au logement (APL)</span>
          </label>
          {#if locataire}
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block text-sm text-ink">
                Loyer par mois, hors charges (€)
                <input type="number" min="0" max="5000" step="10" bind:value={loyerSaisi} class={champ} />
              </label>
              <label class="block text-sm text-ink">
                Zone de la commune
                <select bind:value={zone} class={champ}>
                  <option value={1}>Zone 1 (plafonds les plus hauts)</option>
                  <option value={2}>Zone 2</option>
                  <option value={3}>Zone 3 (plafonds les plus bas)</option>
                </select>
              </label>
            </div>
          {/if}
        </fieldset>

        <fieldset class="space-y-3">
          <legend class="text-sm font-semibold text-ink">Le travail</legend>
          <label class={coche}>
            <input type="checkbox" bind:checked={activite} class="mt-1 accent-brand" />
            <span>Ce revenu vient du travail : calculer la prime d’activité et le RSA</span>
          </label>
          {#if activite && situation === 'couple'}
            <label class={coche}>
              <input type="checkbox" bind:checked={deuxRevenus} class="mt-1 accent-brand" />
              <span>Les deux adultes travaillent et gagnent chacun la moitié</span>
            </label>
          {/if}
          {#if activite && situation === 'seul' && enfants + enfantsAlternes > 0}
            <label class={coche}>
              <input type="checkbox" bind:checked={isoleMajore} class="mt-1 accent-brand" />
              <span>
                Appliquer la majoration temporaire du parent isolé (par exemple après une séparation récente ou avec un
                enfant de moins de 3 ans)
              </span>
            </label>
          {/if}
          {#if activite && gardeAlternee}
            <label class={coche}>
              <input type="checkbox" bind:checked={compterAlternes} class="mt-1 accent-brand" />
              <span>
                Compter les enfants en garde alternée pour la prime d’activité et le RSA (hypothèse à choisir : elle
                dépend de la situation déclarée à la caisse d’allocations familiales)
              </span>
            </label>
          {/if}
        </fieldset>

        <details class="rounded-xl border border-line bg-bg px-4 py-3">
          <summary class="cursor-pointer text-sm font-semibold text-ink">Invalidité et anciens combattants</summary>
          <div class="mt-3 space-y-3">
            <p class="text-xs text-muted">
              L’article 195 du Code général des impôts ajoute une demi-part de quotient familial dans certains cas. Une
              part sert à diviser le revenu avant de calculer l’impôt.
            </p>
            <label class="block text-sm text-ink">
              Adultes avec une invalidité reconnue (carte « invalidité » ou pension d’au moins 40 %)
              <select bind:value={adultesInvalides} class={champ}>
                <option value={0}>Aucun</option>
                <option value={1}>Un adulte</option>
                {#if situation === 'couple'}
                  <option value={2}>Deux adultes</option>
                {/if}
              </select>
            </label>
            <label class={coche}>
              <input type="checkbox" bind:checked={ancienCombattant} class="mt-1 accent-brand" />
              <span>Un adulte de plus de 74 ans a la carte du combattant ou une pension militaire</span>
            </label>
          </div>
        </details>
      </div>

      <div class="space-y-6 lg:col-span-7">
        <div class="border-b border-line pb-6" aria-live="polite">
          <p class="text-sm font-medium text-muted">Revenu disponible réel, sur un an</p>
          <p class="mt-1 font-serif text-5xl font-semibold text-ink tabular">
            {euros.format(res.revenuDisponibleEuros)}
          </p>
          <p class="mt-2 text-sm text-muted">
            Soit {euros.format(centimes(res.revenuDisponibleEuros / 12))} par mois, avant de payer le loyer.
          </p>
          <p class="mt-2 text-sm {deltaDisponible < 0 ? 'font-semibold text-ko' : 'text-muted'}">
            Effet du dernier euro gagné : {signes(deltaDisponible)}
            {#if deltaDisponible < 0}(gagner un euro de plus fait perdre de l’argent){/if}
          </p>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full min-w-[30rem] border-collapse text-left text-sm">
            <caption class="sr-only">Détail du revenu disponible, en euros par an</caption>
            <thead>
              <tr class="border-b border-line-strong text-muted">
                <th scope="col" class="py-3 pr-4 font-semibold">Détail</th>
                <th scope="col" class="py-3 pr-4 text-right font-semibold">Par an</th>
                <th scope="col" class="py-3 text-right font-semibold">Dernier euro gagné</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line">
              {#each lignes as ligne (ligne.titre)}
                {@const variation = centimes(ligne.valeur(res) - ligne.valeur(resAvant))}
                {@const effet = ligne.signe === '-' ? -variation : variation}
                <tr>
                  <th scope="row" class="py-3 pr-4 font-medium text-ink">
                    {ligne.titre}
                    <span class="block text-xs font-normal text-muted">{ligne.detail}</span>
                  </th>
                  <td class="py-3 pr-4 text-right font-mono tabular">
                    {#if ligne.calculee}
                      {ligne.signe} {euros.format(ligne.valeur(res))}
                    {:else}
                      <span class="text-muted">non calculé</span>
                    {/if}
                  </td>
                  <td class="py-3 text-right font-mono tabular {couleur(effet)}">
                    {ligne.calculee ? signes(effet) : ''}
                  </td>
                </tr>
              {/each}
            </tbody>
            <tfoot>
              <tr class="border-t-2 border-line-strong">
                <th scope="row" class="py-3 pr-4 font-semibold text-ink">= Revenu disponible réel</th>
                <td class="py-3 pr-4 text-right font-mono font-semibold text-ink tabular">
                  {euros.format(res.revenuDisponibleEuros)}
                </td>
                <td class="py-3 text-right font-mono font-semibold tabular {couleur(deltaDisponible)}">
                  {signes(deltaDisponible)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p class="text-xs text-muted">
          Quotient familial : {res.nombreDeParts.toLocaleString('fr-FR')} parts. Allocations familiales : {trancheLabel[
            res.trancheAF
          ]}.
        </p>
        {#if res.rsaAplIndetermine}
          <p class="rounded-xl border border-line bg-bg px-4 py-3 text-sm text-ink">
            Cas limite : le RSA dépend de l’aide au logement, et inversement. Aucune des deux situations n’est cohérente.
            Le modèle affiche alors un RSA nul. Ce choix est le nôtre, pas celui de la loi.
          </p>
        {/if}
      </div>
    </div>

    <div class="mt-12 border-t border-line pt-8">
      <h3 class="font-serif text-xl font-semibold text-ink">Effets de seuil à essayer</h3>
      <p class="mt-2 max-w-[72ch] text-sm leading-relaxed text-muted">
        Pour un couple avec deux enfants, un seul revenu et un loyer de {euros.format(balayage.foyer.loyerMensuelEuros)}
        par mois en zone 2, un programme a testé chaque euro de {euros.format(balayage.balayage.deEuros)} à
        {euros.format(balayage.balayage.aEuros)}. Un effet de seuil est un saut du revenu disponible pour un euro de plus.
        Ces résultats sont des candidats : aucun humain ne les a encore qualifiés.
      </p>
      <ul class="mt-5 grid gap-3 md:grid-cols-3">
        {#each baisses as effet (effet.revenuApresEuros)}
          <li class="flex flex-col rounded-xl border border-line bg-bg p-4">
            <p class="font-serif text-2xl font-semibold text-ko tabular">
              {signes(effet.variationRevenuDisponibleEuros)}
              <span class="text-sm font-normal text-muted">par an</span>
            </p>
            <p class="mt-1 text-sm text-ink">à {euros.format(effet.revenuApresEuros)} de revenu annuel</p>
            <p class="mt-1 text-xs text-muted">{effet.lois}</p>
            <button
              type="button"
              onclick={() => essayerFoyerEtudie(effet.revenuApresEuros)}
              class="mt-3 cursor-pointer self-start rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-ink hover:border-brand"
            >
              Voir à {euros.format(effet.revenuApresEuros)}
            </button>
          </li>
        {/each}
      </ul>

      <h4 class="mt-8 text-sm font-semibold text-ink">Plages où gagner plus fait baisser le revenu disponible</h4>
      <ul class="mt-3 space-y-2 text-sm text-ink">
        {#each plagesEnBaisse as plage (plage.deEuros)}
          <li>
            De {euros.format(plage.deEuros)} à {euros.format(plage.aEuros)} :
            <span class="font-semibold text-ko tabular">{signes(plage.variationRevenuDisponibleEuros)}</span>
            <span class="text-muted">· {plage.lois}</span>
          </li>
        {/each}
      </ul>
      <p class="mt-4 max-w-[72ch] text-xs leading-relaxed text-muted">
        S’y ajoutent {balayage.marchesArrondiAideLogement.nombre} petites marches, de
        {euros.format(balayage.marchesArrondiAideLogement.perteMaximaleEuros)} par an au plus : l’aide au logement arrondit
        les ressources à la centaine d’euros supérieure.
        <a href="https://github.com/theonaciri/bugdeloi/tree/main/replications/c0.7">Méthode, code et résultats complets</a>
      </p>
    </div>

    <div class="mt-8 space-y-3">
      <details class="rounded-xl border border-line bg-bg px-4 py-3">
        <summary class="cursor-pointer text-sm font-semibold text-ink">Ce que le modèle simplifie</summary>
        <ul class="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
          {#each HYPOTHESES as hypothese (hypothese)}
            <li>{hypothese}</li>
          {/each}
        </ul>
      </details>
      <details class="rounded-xl border border-line bg-bg px-4 py-3">
        <summary class="cursor-pointer text-sm font-semibold text-ink">Textes utilisés</summary>
        <ul class="mt-3 space-y-2 text-sm">
          {#each SOURCES as source (source.sujet)}
            <li>
              <span class="text-ink">{source.sujet} : </span>
              <a href={source.url} rel="external">{source.reference}</a>
            </li>
          {/each}
        </ul>
      </details>
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

    {#if amendementActif}
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
    {/if}
  </div>
</section>

<section class="border-t border-line bg-surface">
  <div class="container-wide py-12">
    <h2 class="font-serif text-2xl font-semibold text-ink">Vérifier nos données et aller plus loin</h2>
    <p class="mt-3 max-w-[68ch] text-sm leading-relaxed text-muted">
      Ce simulateur croise plusieurs textes de loi en vigueur en 2026. Pour garantir l’exactitude des calculs et
      suivre les débats budgétaires, nous publions aussi nos vérifications croisées et nos données brutes :
    </p>
    <div class="mt-5 flex flex-wrap gap-3">
      <a
        href="/experiences/openfisca"
        class="inline-flex items-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white no-underline hover:bg-brand-strong"
      >
        Comparaison OpenFisca-France (C0.8) →
      </a>
      <a
        href="/experiences/parlement"
        class="inline-flex items-center rounded-full border border-line bg-bg px-5 py-2.5 text-sm font-semibold text-ink no-underline hover:border-brand"
      >
        Veille parlementaire (Tricoteuses) →
      </a>
      <a
        href="https://github.com/theonaciri/bugdeloi/blob/main/replications/c0.7/summary.json"
        rel="external"
        class="inline-flex items-center rounded-full border border-line bg-bg px-5 py-2.5 text-sm font-semibold text-ink no-underline hover:border-brand"
      >
        Données brutes du balayage C0.7 (JSON) →
      </a>
    </div>
  </div>
</section>
