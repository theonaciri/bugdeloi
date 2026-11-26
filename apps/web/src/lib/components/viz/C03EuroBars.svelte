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

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const fmtEur = (cents: number) => euros.format(cents / 100)
const fmtDelta = (cents: number) => `${cents > 0 ? '+' : ''}${euros.format(cents / 100)}`

const numericCases = $derived(cases)
const filtered = $derived.by(() => {
  if (filter === 'passed') return numericCases.filter((c) => c.status === 'passed')
  if (filter === 'rounding') return numericCases.filter((c) => c.classification === 'ambiguïté')
  if (filter === 'disagreement') return numericCases.filter((c) => c.classification === 'erreur_oracle')
  return numericCases
})

const maxCents = $derived(Math.max(100, ...numericCases.flatMap((c) => [c.expected, c.actual])))
const barScale = $derived(scaleLinear().domain([0, maxCents]).range([0, 100]))
const active = $derived(
  filtered.find((c) => c.name === selectedName) ??
    numericCases.find((c) => c.name === selectedName) ??
    filtered[0] ??
    null,
)

const counts = $derived({
  all: numericCases.length,
  passed: numericCases.filter((c) => c.status === 'passed').length,
  rounding: numericCases.filter((c) => c.classification === 'ambiguïté').length,
  disagreement: numericCases.filter((c) => c.classification === 'erreur_oracle').length,
})
</script>

<div class="space-y-4">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <SegmentedControl
      bind:value={filter}
      ariaLabel="Filtrer les cas chiffrés C0.3"
      size="sm"
      options={[
        { value: 'all', label: 'Tous', badge: counts.all },
        { value: 'disagreement', label: 'Désaccords', badge: counts.disagreement },
        { value: 'rounding', label: 'Arrondi 0,01 €', badge: counts.rounding },
        { value: 'passed', label: 'Identiques', badge: counts.passed },
      ]}
    />
    <div class="flex items-center gap-4 text-xs text-muted">
      <span class="inline-flex items-center gap-1.5">
        <span class="size-2.5 rounded-xs bg-ink/80"></span>
        Inria (témoin)
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="size-2.5 rounded-xs bg-brand"></span>
        Agent IA (identique)
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span class="size-2.5 rounded-xs bg-notice-line"></span>
        Écart à vérifier
      </span>
    </div>
  </div>

  <div class="grid gap-4 lg:grid-cols-[1fr_19rem]">
    <div class="space-y-1.5">
      {#each filtered as item (item.id)}
        {@const delta = item.actual - item.expected}
        {@const isSelected = active?.name === item.name}
        {@const wExp = barScale(item.expected)}
        {@const wAct = barScale(item.actual)}
        <button
          type="button"
          onclick={() => (selectedName = item.name)}
          aria-pressed={isSelected}
          class={cn(
            'grid w-full grid-cols-[4.5rem_1fr_6.5rem] items-center gap-3 rounded-[var(--radius-sm)] border px-3 py-2 text-left transition-colors cursor-pointer',
            isSelected
              ? 'border-brand bg-brand-soft/45'
              : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2/40',
          )}
        >
          <span class="mono text-xs font-semibold text-ink">{item.name}</span>

          <svg viewBox="0 0 100 18" preserveAspectRatio="none" class="block h-4.5 w-full" aria-hidden="true">
            <rect x="0" y="1" width="100" height="6" rx="3" fill="var(--surface-2)" />
            <rect x="0" y="1" width={Math.max(1.5, wExp)} height="6" rx="3" fill="var(--ink)" opacity="0.72" />
            <rect x="0" y="10" width="100" height="6" rx="3" fill="var(--surface-2)" />
            <rect
              x="0"
              y="10"
              width={Math.max(1.5, wAct)}
              height="6"
              rx="3"
              fill={item.status === 'passed'
                ? 'var(--brand)'
                : item.classification === 'erreur_oracle'
                  ? 'var(--ko)'
                  : 'var(--notice-line)'}
            />
          </svg>

          <span
            class={cn(
              'mono text-right text-xs font-semibold tabular',
              delta === 0
                ? 'text-ok'
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

    {#if active}
      {@const delta = active.actual - active.expected}
      <aside class="rounded-[var(--radius-lg)] border border-line bg-surface-2/70 p-4 flex flex-col justify-between gap-4">
        <div class="space-y-3">
          <div class="flex items-center justify-between gap-2">
            <span class="mono text-xs font-bold text-ink">{active.name}</span>
            <span
              class={cn(
                'mono rounded-full px-2 py-0.5 text-[0.68rem] font-semibold',
                active.status === 'passed'
                  ? 'bg-ok-soft text-ok'
                  : active.classification === 'erreur_oracle'
                    ? 'bg-ko-soft text-ko'
                    : 'bg-notice text-notice-ink',
              )}
            >
              {active.status === 'passed'
                ? 'Montant identique'
                : active.classification === 'erreur_oracle'
                  ? 'Désaccord oracle'
                  : 'Écart d’arrondi'}
            </span>
          </div>

          {#if active.contextLabel}
            <p class="font-serif text-base font-semibold leading-snug text-ink">{active.contextLabel}</p>
          {/if}

          <dl class="grid grid-cols-2 gap-2.5 border-y border-line py-3">
            <div>
              <dt class="text-[0.7rem] text-muted">Attendu (Inria)</dt>
              <dd class="mono mt-0.5 text-lg font-bold tabular text-ink">{fmtEur(active.expected)}</dd>
            </div>
            <div>
              <dt class="text-[0.7rem] text-muted">Programme remis</dt>
              <dd class="mono mt-0.5 text-lg font-bold tabular text-ink">{fmtEur(active.actual)}</dd>
            </div>
          </dl>

          <div>
            <p class="text-xs text-muted">Écart mensuel observé</p>
            <p
              class={cn(
                'mono text-xl font-bold tabular',
                delta === 0 ? 'text-ok' : active.classification === 'erreur_oracle' ? 'text-ko' : 'text-notice-ink',
              )}
            >
              {delta === 0 ? '0,00 € (exact)' : `${fmtDelta(delta)} / mois`}
            </p>
          </div>
        </div>

        <p class="text-xs leading-relaxed text-muted">
          {#if active.status === 'passed'}
            Le programme produit à l’aveugle à partir de LEGI retrouve au centime près le montant du témoin Inria.
          {:else if active.classification === 'erreur_oracle'}
            Désaccord substantiel entre le texte LEGI et le témoin Inria — contre-vérifié par Anthropic et Google, en attente de verdict humain.
          {:else}
            Écart de 0,01 € dû au placement de l’arrondi (composantes arrondies avant somme chez Inria vs arrondi final dans la remise).
          {/if}
        </p>
      </aside>
    {/if}
  </div>
</div>
