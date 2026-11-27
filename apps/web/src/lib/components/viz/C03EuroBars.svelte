<script lang="ts">
import { scaleLinear } from 'd3-scale'
import { SegmentedControl } from '#lib/components/ui/index.ts'
import { cn } from '#lib/utils/cn.ts'

export interface EuroCase {
  id: string
  name: string
  status: 'passed' | 'failed' | 'error'
  expected: number // centimes
  actual: number // centimes
  classification: string | null
  contextLabel?: string
}

let {
  cases,
  selectedName = $bindable<string>('Test3'),
}: {
  cases: EuroCase[]
  selectedName?: string
} = $props()

let filter = $state('all')
let chartWidth = $state(420)

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const fmtEur = (cents: number) => euros.format(cents / 100)
const fmtDelta = (cents: number) => `${cents > 0 ? '+' : ''}${euros.format(cents / 100)}`

const filtered = $derived.by(() => {
  if (filter === 'passed') return cases.filter((c) => c.status === 'passed')
  if (filter === 'rounding') return cases.filter((c) => c.classification === 'ambiguïté')
  if (filter === 'disagreement') return cases.filter((c) => c.classification === 'erreur_oracle')
  return cases
})

const maxCents = $derived(Math.max(100, ...cases.flatMap((c) => [c.expected, c.actual])))
const barW = $derived(Math.max(140, Math.round(chartWidth)))
const barScale = $derived(scaleLinear().domain([0, maxCents]).range([0, barW]))

const active = $derived(
  filtered.find((c) => c.name === selectedName) ??
    cases.find((c) => c.name === selectedName) ??
    filtered[0] ??
    null,
)

const counts = $derived({
  all: cases.length,
  passed: cases.filter((c) => c.status === 'passed').length,
  rounding: cases.filter((c) => c.classification === 'ambiguïté').length,
  disagreement: cases.filter((c) => c.classification === 'erreur_oracle').length,
})
</script>

<div class="space-y-6">
  <!-- Filtres + légende complète sans troncature -->
  <div class="flex flex-wrap items-center justify-between gap-4">
    <SegmentedControl
      bind:value={filter}
      ariaLabel="Filtrer les cas chiffrés de l’expérience C0.3"
      size="sm"
      options={[
        { value: 'all', label: 'Tous les cas', badge: counts.all },
        { value: 'disagreement', label: 'Désaccords', badge: counts.disagreement },
        { value: 'rounding', label: 'Arrondi 0,01 €', badge: counts.rounding },
        { value: 'passed', label: 'Identiques', badge: counts.passed },
      ]}
    />
    <div class="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted">
      <span class="inline-flex items-center gap-2">
        <span class="h-1.5 w-4 rounded-full bg-ink/45"></span>
        Programme Inria
      </span>
      <span class="inline-flex items-center gap-2">
        <span class="h-1.5 w-4 rounded-full bg-brand"></span>
        Loi en vigueur (identique)
      </span>
      <span class="inline-flex items-center gap-2">
        <span class="h-1.5 w-4 rounded-full bg-notice-line"></span>
        Écart d’arrondi (0,01 €)
      </span>
      <span class="inline-flex items-center gap-2">
        <span class="h-1.5 w-4 rounded-full bg-ko"></span>
        Désaccord sur la loi
      </span>
    </div>
  </div>

  <div class="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
    <!-- Lignes éditoriales aérées, sans boîtes ni déformation SVG -->
    <div class="divide-y divide-line/80 border-y border-line">
      {#each filtered as item (item.id)}
        {@const delta = item.actual - item.expected}
        {@const isSelected = active?.name === item.name}
        {@const wExp = Math.max(4, Math.round(barScale(item.expected)))}
        {@const wAct = Math.max(4, Math.round(barScale(item.actual)))}
        <button
          type="button"
          onclick={() => (selectedName = item.name)}
          aria-pressed={isSelected}
          class={cn(
            'grid w-full grid-cols-[4.5rem_1fr_6.5rem] items-center gap-4 px-3 py-3 text-left transition-colors cursor-pointer sm:grid-cols-[5.5rem_1fr_7.5rem]',
            isSelected ? 'bg-surface-2/90' : 'hover:bg-surface-2/45',
          )}
        >
          <span class="flex items-center gap-2">
            <span
              class={cn(
                'h-4 w-0.5 rounded-full transition-colors',
                isSelected ? 'bg-brand' : 'bg-transparent',
              )}
              aria-hidden="true"
            ></span>
            <span class="text-sm font-semibold text-ink">{item.name}</span>
          </span>

          <div class="min-w-0" bind:clientWidth={chartWidth}>
            <svg
              viewBox="0 0 {barW} 18"
              width={barW}
              height="18"
              class="block h-[18px] w-full overflow-visible"
              aria-hidden="true"
            >
              <!-- Piste discrète -->
              <rect x="0" y="2" width={barW} height="5" rx="2.5" fill="var(--surface-2)" />
              <rect x="0" y="2" width={wExp} height="5" rx="2.5" fill="var(--ink)" opacity="0.45" />

              <rect x="0" y="11" width={barW} height="5" rx="2.5" fill="var(--surface-2)" />
              <rect
                x="0"
                y="11"
                width={wAct}
                height="5"
                rx="2.5"
                fill={item.status === 'passed'
                  ? 'var(--brand)'
                  : item.classification === 'erreur_oracle'
                    ? 'var(--ko)'
                    : 'var(--notice-line)'}
              />
            </svg>
          </div>

          <span
            class={cn(
              'text-right text-sm font-semibold tabular',
              delta === 0
                ? 'text-muted'
                : item.classification === 'erreur_oracle'
                  ? 'text-ko'
                  : 'text-notice-ink',
            )}
          >
            {delta === 0 ? fmtEur(item.actual) : fmtDelta(delta)}
          </span>
        </button>
      {/each}
    </div>

    <!-- Panneau éditorial du cas sélectionné (sans bordure lourde) -->
    {#if active}
      {@const delta = active.actual - active.expected}
      <aside class="rounded-[var(--radius-xl)] bg-surface-2/75 p-6 sm:p-7 space-y-5 lg:sticky lg:top-24">
        <div class="flex items-baseline justify-between gap-2">
          <h4 class="font-display text-xl font-semibold text-ink">{active.name}</h4>
          <span
            class={cn(
              'text-xs font-semibold',
              active.status === 'passed'
                ? 'text-ok'
                : active.classification === 'erreur_oracle'
                  ? 'text-ko'
                  : 'text-notice-ink',
            )}
          >
            {active.status === 'passed'
              ? 'Identique'
              : active.classification === 'erreur_oracle'
                ? 'Désaccord à arbitrer'
                : 'Écart d’arrondi'}
          </span>
        </div>

        {#if active.contextLabel}
          <p class="text-sm font-medium leading-snug text-ink">{active.contextLabel}</p>
        {/if}

        <dl class="grid grid-cols-2 gap-4 border-y border-line py-4">
          <div>
            <dt class="text-xs text-muted">Programme Inria</dt>
            <dd class="font-display mt-1 text-2xl font-semibold tabular text-ink">{fmtEur(active.expected)}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted">Lecture de la loi en vigueur</dt>
            <dd class="font-display mt-1 text-2xl font-semibold tabular text-ink">{fmtEur(active.actual)}</dd>
          </div>
        </dl>

        <div>
          <p class="text-xs text-muted">Écart mensuel entre les deux calculs</p>
          <p
            class={cn(
              'font-display mt-0.5 text-2xl font-semibold tabular',
              delta === 0 ? 'text-ok' : active.classification === 'erreur_oracle' ? 'text-ko' : 'text-notice-ink',
            )}
          >
            {delta === 0 ? '0,00 € (montants identiques)' : `${fmtDelta(delta)} / mois`}
          </p>
        </div>

        <p class="text-sm leading-relaxed text-muted">
          {#if active.status === 'passed'}
            La traduction automatique de la loi en vigueur donne exactement le même montant que le programme de référence d’Inria.
          {:else if active.classification === 'erreur_oracle'}
            La lecture littérale de l’article en vigueur contredit le programme de référence d’Inria. Deux relectures indépendantes ont confirmé l’écart ; un juriste doit trancher.
          {:else}
            Écart d’un centime : Inria arrondit chaque composante avant d’additionner, tandis que notre programme arrondit uniquement le total final.
          {/if}
        </p>
      </aside>
    {/if}
  </div>
</div>
