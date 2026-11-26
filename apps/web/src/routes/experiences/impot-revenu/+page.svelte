<script lang="ts">
import { scaleLinear } from 'd3-scale'
import { line } from 'd3-shape'
import { calculExact, calculIR2026, type Foyer } from '../../../../../../replications/c0.6/ir2026.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()

let revenuEuros = $state(29585)
let situation = $state<'celibataire' | 'couple' | 'parent_isole' | 'veuf'>('celibataire')
let enfants = $state(0)
let domicile = $state<Foyer['domicileFiscal']>('Métropole')
let chartWidth = $state(720)

const effectiveEnfants = $derived(situation === 'parent_isole' ? Math.max(1, enfants) : enfants)

const foyer = $derived<Foyer>({
  situationFamiliale:
    situation === 'couple' ? 'ImpositionCommune' : situation === 'veuf' ? 'Veuf' : 'Célibataire',
  enfantsAChargeExclusiveOuPrincipale: effectiveEnfants,
  appreciationVitSeul: situation === 'parent_isole',
  domicileFiscal: domicile,
})

const resultat = $derived(
  calculIR2026({
    dateDeCalcul: '2026-07-01',
    revenuNetImposableCentimes: Math.max(0, Math.round(revenuEuros)) * 100,
    ...foyer,
  }),
)

const resultatPlusUn = $derived(
  calculIR2026({
    dateDeCalcul: '2026-07-01',
    revenuNetImposableCentimes: (Math.max(0, Math.round(revenuEuros)) + 1) * 100,
    ...foyer,
  }),
)

const tmePct = $derived(
  Math.round((resultatPlusUn.impotNetAvantCredits - resultat.impotNetAvantCredits) * 100) / 100,
)
const tauxMoyenPct = $derived(
  revenuEuros > 0 ? Math.round((resultat.impotNetAvantCredits / 100 / revenuEuros) * 10000) / 100 : 0,
)
const effetPlafondQf = $derived(Math.max(0, resultat.impotApresPlafondQf - resultat.impotBrutSansPlafond))

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const intFmt = new Intl.NumberFormat('fr-FR')
const pctFmt = (n: number) => `${n.toFixed(2).replace('.', ',')} %`
const fmtCents = (c: number) => euros.format(c / 100)

// Courbe du taux marginal effectif recalculée en direct dans le navigateur pour le foyer choisi.
const maxChartRevenue = 120_000
const curvePoints = $derived.by(() => {
  const pts: { r: number; tme: number }[] = []
  const sample = new Set<number>()
  for (let r = 0; r <= maxChartRevenue; r += 1000) sample.add(r)
  // Résolution fine autour des seuils clés (11 600, 17 215, 29 579, 29 595, 32 482, 52 995, 84 577)
  for (const center of [
    11600, 17215, 28815, 29579, 29595, 32482, 41222, 44082, 45295, 52995, 64595, 71464, 84577,
  ]) {
    for (let d = -20; d <= 20; d += 5) {
      if (center + d >= 0 && center + d <= maxChartRevenue) sample.add(center + d)
    }
  }
  const ordered = [...sample].sort((a, b) => a - b)
  for (const r of ordered) {
    const a = calculExact(BigInt(r), foyer).net
    const b = calculExact(BigInt(r + 1), foyer).net
    const tme = Math.round((Number(b - a) / 200_000_000) * 10000) / 100
    pts.push({ r, tme })
  }
  return pts
})

const chartH = 260
const pad = { top: 20, right: 20, bottom: 38, left: 48 }
const innerW = $derived(Math.max(260, chartWidth - pad.left - pad.right))
const innerH = chartH - pad.top - pad.bottom

const xScale = $derived(scaleLinear().domain([0, maxChartRevenue]).range([0, innerW]))
const yScale = scaleLinear().domain([0, 50]).range([innerH, 0])

const pathData = $derived(
  line<{ r: number; tme: number }>()
    .x((d) => xScale(d.r))
    .y((d) => yScale(Math.min(50, Math.max(0, d.tme))))(curvePoints) ?? '',
)

const markerX = $derived(xScale(Math.min(maxChartRevenue, Math.max(0, revenuEuros))))
const markerY = $derived(yScale(Math.min(50, Math.max(0, tmePct))))

const presets = [
  {
    label: 'Avant falaise 61 € (17 592 €)',
    rev: 17592,
    sit: 'celibataire' as const,
    enf: 0,
    dom: 'Métropole' as const,
  },
  {
    label: 'Falaise 61 € : +1 € = +61 € (17 593 €)',
    rev: 17593,
    sit: 'celibataire' as const,
    enf: 0,
    dom: 'Métropole' as const,
  },
  {
    label: 'Pic décote 43,58 % (29 585 €)',
    rev: 29585,
    sit: 'celibataire' as const,
    enf: 0,
    dom: 'Métropole' as const,
  },
  {
    label: 'Couple 2 enfants plafonné (90 000 €)',
    rev: 90000,
    sit: 'couple' as const,
    enf: 2,
    dom: 'Métropole' as const,
  },
  {
    label: 'Guyane / Mayotte (50 000 €)',
    rev: 50000,
    sit: 'celibataire' as const,
    enf: 0,
    dom: 'GuyaneMayotte' as const,
  },
]

function applyPreset(p: (typeof presets)[number]) {
  revenuEuros = p.rev
  situation = p.sit
  enfants = p.enf
  domicile = p.dom
}
</script>

<svelte:head>
  <title>Simulateur Impôt sur le revenu 2026 et coudes de taux · BugDeLoi</title>
  <meta
    name="description"
    content="Simulez le barème 2026 de l’impôt sur le revenu directement dans votre navigateur à partir des articles 193, 194 et 197 du CGI, et observez le coude de la décote."
  />
</svelte:head>

<section class="bg-bg">
  <div class="container-wide py-12 sm:py-16">
    <p class="text-sm"><a href="/experiences">← Toutes les expériences</a></p>
    <h1 class="mt-4 max-w-4xl font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
      Impôt sur le revenu 2026 : simulateur et détection des coudes
    </h1>
    <p class="mt-5 max-w-[68ch] text-lg leading-relaxed text-muted">
      Ce calculateur tourne entièrement dans votre navigateur à partir du texte en vigueur des articles 193, 194 et 197
      du Code général des impôts (barème 2026). Il est aligné au centime sur notre programme Catala vérifié dans son
      bac à sable (12 tests réussis, 30 cas de contrôle vérifiés).
    </p>
    <div class="mt-6 max-w-[68ch] rounded-xl border border-notice-line/50 bg-notice/60 px-5 py-3.5 text-sm text-notice-ink">
      <strong>Périmètre clair :</strong> ce noyau calcule le barème progressif, le quotient familial, son plafonnement,
      la réfaction outre-mer et la décote. Il n’inclut pas les réductions ni les crédits d’impôt (dons, emploi à domicile)
      ni le seuil de mise en recouvrement de 61 €. Ce n’est pas un simulateur officiel des impôts.
    </div>
  </div>
</section>

<section class="border-t border-line bg-surface" aria-labelledby="sim-titre">
  <div class="container-wide py-12 sm:py-16">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 id="sim-titre" class="font-serif text-2xl font-semibold text-ink sm:text-3xl">
          Tester un foyer en direct
        </h2>
        <p class="mt-1.5 text-sm text-muted">
          Déplacez le curseur ou cliquez sur un cas remarquable pour voir l’effet exact sur le prochain euro gagné.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        {#each presets as p (p.label)}
          <button
            type="button"
            onclick={() => applyPreset(p)}
            class="cursor-pointer rounded-full border border-line bg-bg px-3.5 py-1.5 text-xs font-medium text-ink transition hover:border-brand hover:text-brand-strong"
          >
            {p.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="mt-8 grid gap-10 lg:grid-cols-12">
      <div class="space-y-6 lg:col-span-5">
        <div>
          <div class="flex items-baseline justify-between gap-3">
            <label for="sim-revenu" class="text-sm font-semibold text-ink">Revenu net imposable annuel</label>
            <div class="flex items-center gap-1.5">
              <input
                id="sim-revenu-num"
                type="number"
                min="0"
                max="300000"
                step="1"
                bind:value={revenuEuros}
                aria-label="Revenu net imposable en euros"
                class="w-28 rounded-lg border border-line bg-bg px-2.5 py-1 text-right font-mono text-sm font-semibold text-ink tabular"
              />
              <span class="text-sm text-muted">€</span>
            </div>
          </div>
          <input
            id="sim-revenu"
            type="range"
            min="0"
            max="120000"
            step="100"
            bind:value={revenuEuros}
            class="mt-3 w-full accent-brand"
          />
          <div class="mt-1 flex justify-between font-mono text-xs text-muted">
            <span>0 €</span>
            <span>30 000 €</span>
            <span>60 000 €</span>
            <span>120 000 €</span>
          </div>
        </div>

        <fieldset class="space-y-2">
          <legend class="text-sm font-semibold text-ink">Situation familiale (art. 194)</legend>
          <div class="grid grid-cols-2 gap-2">
            {#each [
              ['celibataire', 'Célibataire / divorcé'],
              ['couple', 'Couple marié ou pacsé'],
              ['parent_isole', 'Parent isolé vivant seul'],
              ['veuf', 'Veuf ou veuve'],
            ] as const as [val, label] (val)}
              <button
                type="button"
                onclick={() => (situation = val)}
                aria-pressed={situation === val}
                class="cursor-pointer rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium transition {situation === val
                  ? 'border-brand bg-brand-soft text-brand-strong'
                  : 'border-line bg-bg text-ink hover:bg-surface-2'}"
              >
                {label}
              </button>
            {/each}
          </div>
        </fieldset>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label for="sim-enfants" class="block text-sm font-semibold text-ink">Enfants à charge</label>
            <input
              id="sim-enfants"
              type="number"
              min={situation === 'parent_isole' ? 1 : 0}
              max="6"
              bind:value={enfants}
              class="mt-1.5 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink tabular"
            />
          </div>
          <div>
            <label for="sim-domicile" class="block text-sm font-semibold text-ink">Domicile fiscal (art. 197 I.3)</label>
            <select
              id="sim-domicile"
              bind:value={domicile}
              class="mt-1.5 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink"
            >
              <option value="Métropole">Métropole</option>
              <option value="GuadeloupeMartiniqueRéunion">Guadeloupe, Martinique, Réunion</option>
              <option value="GuyaneMayotte">Guyane, Mayotte</option>
            </select>
          </div>
        </div>

        <div class="divide-y divide-line border-y border-line text-sm">
          <div class="flex justify-between py-2.5">
            <span class="text-muted">Nombre de parts (art. 194)</span>
            <span class="font-mono font-semibold text-ink tabular">{resultat.nombreDeParts.toString().replace('.', ',')}</span>
          </div>
          <div class="flex justify-between py-2.5">
            <span class="text-muted">Impôt brut selon le barème (art. 197 I.1)</span>
            <span class="font-mono text-ink tabular">{fmtCents(resultat.impotBrutSansPlafond)}</span>
          </div>
          {#if effetPlafondQf > 0}
            <div class="flex justify-between py-2.5">
              <span class="text-muted">Effet du plafonnement du quotient familial (art. 197 I.2)</span>
              <span class="font-mono font-medium text-notice-ink tabular">+ {fmtCents(effetPlafondQf)}</span>
            </div>
          {/if}
          {#if resultat.refactionOutreMer > 0}
            <div class="flex justify-between py-2.5">
              <span class="text-muted">Réfaction outre-mer (art. 197 I.3)</span>
              <span class="font-mono font-medium text-ok tabular">- {fmtCents(resultat.refactionOutreMer)}</span>
            </div>
          {/if}
          {#if resultat.decote > 0}
            <div class="flex justify-between py-2.5">
              <span class="text-muted">Décote appliquée (art. 197 I.4.a)</span>
              <span class="font-mono font-medium text-ok tabular">- {fmtCents(resultat.decote)}</span>
            </div>
          {/if}
          <div class="flex justify-between py-2.5">
            <span class="text-muted">Cotisation arrondie à l’euro (art. 1657.1)</span>
            <span class="font-mono text-ink tabular">{fmtCents(resultat.impotArrondiEuro)}</span>
          </div>
          {#if resultat.impotArrondiEuro > 0 && resultat.impotMisEnRecouvrement === 0}
            <div class="flex justify-between py-2.5">
              <span class="font-medium text-ok">Seuil de non-recouvrement &lt; 61 € (art. 1657 1 bis)</span>
              <span class="font-mono font-semibold text-ok tabular">0,00 € à payer</span>
            </div>
          {/if}
        </div>
      </div>

      <div class="space-y-6 lg:col-span-7">
        <div class="grid gap-6 border-b border-line pb-6 sm:grid-cols-3">
          <div>
            <p class="text-xs font-medium text-muted">Impôt mis en recouvrement</p>
            <p class="mt-1 font-serif text-3xl font-semibold text-ink tabular sm:text-4xl">
              {fmtCents(resultat.impotMisEnRecouvrement)}
            </p>
            <p class="mt-1 text-xs text-muted">
              {resultat.impotArrondiEuro > 0 && resultat.impotMisEnRecouvrement === 0
                ? `${fmtCents(resultat.impotArrondiEuro)} calculés (< 61 €, non prélevés)`
                : 'Art. 1657 1 bis, avant crédits'}
            </p>
          </div>
          <div>
            <p class="text-xs font-medium text-muted">Taux moyen d’imposition</p>
            <p class="mt-1 font-serif text-3xl font-semibold text-ink tabular sm:text-4xl">
              {pctFmt(tauxMoyenPct)}
            </p>
            <p class="mt-1 text-xs text-muted">Part totale du revenu imposable</p>
          </div>
          <div>
            <p class="text-xs font-medium text-muted">Impôt sur le prochain euro</p>
            <p class="mt-1 font-serif text-3xl font-semibold tabular sm:text-4xl {tmePct > 42 ? 'text-ko' : tmePct > 15 && tmePct < 17 ? 'text-notice-ink' : 'text-brand-strong'}">
              {pctFmt(tmePct)}
            </p>
            <p class="mt-1 text-xs text-muted">Taux marginal effectif</p>
          </div>
        </div>

        <div bind:clientWidth={chartWidth}>
          <div class="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 class="text-sm font-semibold text-ink">
              Taux marginal effectif selon le revenu (de 0 € à 120 000 €)
            </h3>
            <span class="text-xs text-muted">Le point marque votre revenu actuel</span>
          </div>
          <svg
            width={Math.max(300, chartWidth)}
            height={chartH}
            viewBox={`0 0 ${Math.max(300, chartWidth)} ${chartH}`}
            role="img"
            aria-label="Courbe du taux marginal effectif de l’impôt sur le revenu 2026 selon le revenu net imposable"
            class="block w-full overflow-visible"
          >
            <g transform={`translate(${pad.left},${pad.top})`}>
              {#each [0, 11, 16, 30, 41, 45] as tick (tick)}
                <line
                  x1="0"
                  x2={innerW}
                  y1={yScale(tick)}
                  y2={yScale(tick)}
                  stroke="var(--line)"
                  stroke-dasharray={tick === 16 ? '3 3' : undefined}
                />
                <text
                  x="-8"
                  y={yScale(tick) + 4}
                  text-anchor="end"
                  fill="var(--muted)"
                  font-size="11"
                  font-family="var(--font-mono)"
                >
                  {tick} %
                </text>
              {/each}

              {#each [0, 30000, 60000, 90000, 120000] as tick (tick)}
                <text
                  x={xScale(tick)}
                  y={innerH + 22}
                  text-anchor="middle"
                  fill="var(--muted)"
                  font-size="11"
                  font-family="var(--font-mono)"
                >
                  {tick === 0 ? '0 €' : `${tick / 1000} k€`}
                </text>
              {/each}

              <path d={pathData} fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linejoin="round" />

              {#if revenuEuros <= maxChartRevenue}
                <line
                  x1={markerX}
                  x2={markerX}
                  y1={markerY}
                  y2={innerH}
                  stroke="var(--brand-strong)"
                  stroke-dasharray="3 3"
                  opacity="0.6"
                />
                <circle cx={markerX} cy={markerY} r="5.5" fill="var(--brand-strong)" stroke="var(--surface)" stroke-width="2" />
              {/if}
            </g>
          </svg>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="border-t border-line bg-bg" aria-labelledby="coudes-titre">
  <div class="container-wide py-12 sm:py-16">
    <h2 id="coudes-titre" class="font-serif text-2xl font-semibold text-ink sm:text-3xl">
      Ce que révèle le détecteur automatique de coudes et falaises (expérience C0.6)
    </h2>
    <p class="mt-3 max-w-[68ch] text-base leading-relaxed text-muted">
      En testant automatiquement chaque euro de revenu entre 0 € et 200 000 € sur quatre foyers types, notre programme
      repère <strong>{data.c06.totalKinks} changements brusques de taux marginal</strong> (des « coudes »),
      <strong>{data.c06.totalCliffs} falaise</strong> sur le barème progressif seul, mais
      <strong>{data.c06.totalCliffs1657} falaises réelles</strong> dès que l’on applique le seuil de recouvrement de 61 €
      (CGI art. 1657 1 bis).
    </p>
    <div class="mt-5 grid gap-5 lg:grid-cols-2">
      <div class="rounded-xl border border-line bg-surface p-5">
        <h3 class="font-serif text-lg font-semibold text-ink">La vraie falaise de 61 € (taux marginal : +6 100 %)</h3>
        <p class="mt-2 text-sm leading-relaxed text-muted">
          L’article 1657 1 bis du CGI prévoit qu’un impôt inférieur à 61 € n’est pas prélevé. Pour un célibataire,
          un revenu de <strong>17 592 €</strong> donne 60 € d’impôt, donc <strong>0 € à payer</strong>. Avec
          <strong>1 € de plus</strong> (17 593 €), l’impôt passe à <strong>61 €</strong> : gagner 1 € fait perdre
          <strong>60 € de revenu disponible</strong>.
        </p>
      </div>
      <div class="rounded-xl border border-line bg-surface p-5">
        <h3 class="font-serif text-lg font-semibold text-ink">Le pic de décote à 43,58 % (pendant 15 €)</h3>
        <p class="mt-2 text-sm leading-relaxed text-muted">
          Parce que la décote diminue de 45,25 % par euro d’impôt supplémentaire, le taux réel dans la tranche à 11 %
          est de <strong>15,98 %</strong>. Entre <strong>29 579 € et 29 594 €</strong>, la tranche à 30 % démarre avant
          la fin de la décote : pendant 15 €, chaque euro gagné subit un taux marginal de <strong>43,58 %</strong>,
          avant de redescendre à 30 %.
        </p>
      </div>
    </div>

    <div class="mt-8 overflow-x-auto">
      <table class="w-full min-w-[46rem] border-collapse text-left text-sm">
        <thead>
          <tr class="border-b border-line-strong text-muted">
            <th scope="col" class="py-3 pr-4 font-semibold">Foyer type</th>
            <th scope="col" class="py-3 pr-4 font-semibold">Entrée dans l’impôt</th>
            <th scope="col" class="py-3 pr-4 font-semibold">Falaise 61 € (art. 1657 1 bis)</th>
            <th scope="col" class="py-3 pr-4 font-semibold">Zone de décote</th>
            <th scope="col" class="py-3 pr-4 font-semibold">Taux réel en décote</th>
            <th scope="col" class="py-3 font-semibold">Plafond quotient familial</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          {#each data.c06.households as h (h.id)}
            <tr>
              <th scope="row" class="py-3.5 pr-4 font-semibold text-ink">{h.label}</th>
              <td class="py-3.5 pr-4 font-mono tabular">{intFmt.format(h.seuilEntreeEuros)} €</td>
              <td class="py-3.5 pr-4 font-mono font-semibold text-ko tabular">
                {#if h.cliff1657}
                  {intFmt.format(h.cliff1657.revenuAvantEuros)} € → {intFmt.format(h.cliff1657.revenuApresEuros)} € (0 → 61 €)
                {:else}
                  Aucune
                {/if}
              </td>
              <td class="py-3.5 pr-4 font-mono tabular">
                {#if h.debutDecotePartielleEuros && h.finDecoteEuros}
                  {intFmt.format(h.debutDecotePartielleEuros)} € → {intFmt.format(h.finDecoteEuros)} €
                {:else}
                  Aucune
                {/if}
              </td>
              <td class="py-3.5 pr-4 font-mono font-semibold text-notice-ink tabular">
                {h.tmeZoneDecotePct !== null ? pctFmt(h.tmeZoneDecotePct) : '0,00 %'}
              </td>
              <td class="py-3.5 font-mono tabular">
                {h.seuilPlafondQfEuros ? `${intFmt.format(h.seuilPlafondQfEuros)} €` : 'Non atteint'}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="mt-4 text-xs text-muted">{data.c06.note}</p>

    <div class="mt-10 grid gap-6 border-t border-line pt-8 sm:grid-cols-3">
      <div>
        <p class="text-xs font-medium text-muted">Différentiel indépendant</p>
        <p class="mt-1 font-serif text-2xl font-semibold text-ink tabular">
          {intFmt.format(data.differential.totalCases)} foyers · {data.differential.divergences} divergence
        </p>
        <p class="mt-1 text-xs text-muted">
          Dont {intFmt.format(data.differential.thresholdCasesIncluded)} cas de seuils légaux (± 1 €).
        </p>
      </div>
      <div>
        <p class="text-xs font-medium text-muted">Score de mutation</p>
        <p class="mt-1 font-serif text-2xl font-semibold text-ok tabular">
          {data.mutation.killedMutants}/{data.mutation.totalMutants} ({pctFmt(data.mutation.killScorePct)})
        </p>
        <p class="mt-1 text-xs text-muted">
          Seuil requis pour le niveau N4 : ≥ {data.mutation.thresholdN4Pct} %.
        </p>
      </div>
      <div>
        <p class="text-xs font-medium text-muted">Programme Catala 1.3.2</p>
        <p class="mt-1 font-serif text-2xl font-semibold text-brand-strong tabular">14/14 tests verts</p>
        <p class="mt-1 text-xs text-muted">4 empreintes LEGI vérifiées + rétro-traduction publiée.</p>
      </div>
    </div>
  </div>
</section>

<section class="border-t border-line bg-surface" aria-labelledby="sources-ir">
  <div class="container-wide py-12 sm:py-16">
    <h2 id="sources-ir" class="font-serif text-2xl font-semibold text-ink sm:text-3xl">
      Articles officiels modélisés et code source vérifiable
    </h2>
    <ul class="mt-6 divide-y divide-line border-y border-line">
      {#each data.articles as art (art.id)}
        <li class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4">
          <div>
            <a href={`/article/${art.id}`} class="font-semibold text-ink">{art.num} du Code général des impôts</a>
            <p class="text-sm text-muted">{art.role}</p>
          </div>
          <div class="flex items-center gap-4 text-xs">
            <span class="font-mono text-muted">{art.id}</span>
            <a href={art.url} rel="external">Lire sur Légifrance</a>
          </div>
        </li>
      {/each}
    </ul>
    <div class="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
      <a href={data.links.catala} rel="external">Programme Catala 1.3.2 (noyau_ir.catala_fr)</a>
      <a href={data.links.oracles} rel="external">30 cas de vérification YAML</a>
      <a href={data.links.backtranslation} rel="external">Rétro-traduction française du programme</a>
      <a href={data.links.report} rel="external">Rapport complet du détecteur C0.6</a>
    </div>
  </div>
</section>
