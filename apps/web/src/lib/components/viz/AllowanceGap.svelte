<!--
  Écart C0.3 décomposé ligne à ligne : deux barres empilées (programme Inria, loi en vigueur) à la même
  échelle, puis le tableau du calcul. Gris : ligne comptée des deux côtés ; orange hachuré : comptée par
  Inria seul ; violet : comptée par la loi en vigueur seule. Couleur doublée d'un motif et d'une légende.
-->
<script lang="ts">
import type { AllowanceBreakdown, BreakdownLine } from '#lib/c03-breakdowns.ts'

let { item, compact = false }: { item: AllowanceBreakdown; compact?: boolean } = $props()

type Kind = 'shared' | 'inria' | 'law'
const kindOf = (line: BreakdownLine): Kind =>
  line.inriaCents !== null && line.lawCents !== null ? 'shared' : line.inriaCents !== null ? 'inria' : 'law'

const KIND_LABEL: Record<Kind, string> = {
  shared: 'Compté par les deux',
  inria: 'Ajouté par le programme Inria seul',
  law: 'Prévu par la loi en vigueur, absent chez Inria',
}

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const eur = (cents: number) => euros.format(cents / 100)

const max = $derived(Math.max(item.inriaCents, item.lawCents))
const gap = $derived(item.lawCents - item.inriaCents)

/** Segments d'une barre, en unités d'un viewBox de 1000 (échelle commune : le plus grand des deux totaux). */
function segments(side: 'inria' | 'law') {
  const list = item.lines
    .map((line, index) => ({
      line,
      index,
      kind: kindOf(line),
      cents: side === 'inria' ? line.inriaCents : line.lawCents,
    }))
    .filter((s): s is typeof s & { cents: number } => s.cents !== null)
    .sort((a, b) => Number(a.kind !== 'shared') - Number(b.kind !== 'shared'))
  let x = 0
  return list.map((seg) => {
    const span = (seg.cents / max) * 1000
    const out = { ...seg, x, w: Math.max(span - 3, 2) }
    x += span
    return out
  })
}

const rows = $derived([
  { side: 'inria' as const, label: 'Programme Inria', total: item.inriaCents, segs: segments('inria') },
  { side: 'law' as const, label: 'Loi en vigueur', total: item.lawCents, segs: segments('law') },
])

let active = $state<number | null>(null)
const activeLine = $derived(active === null ? null : (item.lines[active] ?? null))
const kinds = $derived([...new Set(item.lines.map(kindOf))])
</script>

<figure class="gap-fig">
  <figcaption class="space-y-1">
    <span class="block text-lg font-semibold text-ink">{item.territory} · {item.situation}</span>
    <span class="block text-sm text-muted">Montant mensuel, {item.date}, base mensuelle {item.base}</span>
  </figcaption>

  <ul class="legend" aria-label="Légende">
    {#each kinds as kind (kind)}
      <li><span class="swatch {kind}" aria-hidden="true"></span>{KIND_LABEL[kind]}</li>
    {/each}
    <li><span class="swatch gap" aria-hidden="true"></span>Écart entre les deux totaux</li>
  </ul>

  <div class="bars" role="group" aria-label="Décomposition des deux montants">
    {#each rows as row (row.side)}
      <div class="bar-row">
        <span class="bar-label">{row.label}</span>
        <svg class="bar" viewBox="0 0 1000 32" preserveAspectRatio="none" role="group" aria-label="{row.label} : {eur(row.total)}">
          <defs>
            <pattern id="hatch-{item.name}-{row.side}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="8" height="8" class="fill-inria-light" />
              <rect width="5" height="8" class="fill-inria" />
            </pattern>
          </defs>
          {#each row.segs as seg (seg.index)}
            <rect
              x={seg.x}
              y="0"
              width={seg.w}
              height="32"
              class="seg-{seg.kind}"
              class:dim={active !== null && active !== seg.index}
              fill={seg.kind === 'inria' ? `url(#hatch-${item.name}-${row.side})` : undefined}
              role="img"
              aria-label="{seg.line.label} : {eur(seg.cents)}"
              onmouseenter={() => (active = seg.index)}
              onmouseleave={() => (active = null)}
            />
          {/each}
          {#if row.total < max}
            <rect
              x={(row.total / max) * 1000 + 3}
              y="1"
              width={1000 - (row.total / max) * 1000 - 4}
              height="30"
              class="missing"
              vector-effect="non-scaling-stroke"
            />
          {/if}
        </svg>
        <span class="bar-total">{eur(row.total)}</span>
      </div>
    {/each}
  </div>

  <p class="readout" aria-live="polite">
    {#if activeLine}
      <strong class="text-ink">{activeLine.label}</strong> : {activeLine.formula} ({activeLine.basis})
    {:else}
      <strong class="text-ink">Écart : {gap > 0 ? '+' : '−'}{eur(Math.abs(gap))} par mois</strong>
      ({gap > 0 ? 'la loi en vigueur donne plus' : 'le programme Inria donne plus'}).
      Le tableau détaille chaque ligne du calcul.
    {/if}
  </p>

  <table class="calc">
    <caption class="sr-only">Calcul ligne à ligne, {item.territory}</caption>
    <thead>
      <tr>
        <th scope="col">Ligne du calcul</th>
        <th scope="col" class="num">Inria</th>
        <th scope="col" class="num">Loi</th>
      </tr>
    </thead>
    <tbody>
      {#each item.lines as line, index (line.label)}
        {@const kind = kindOf(line)}
        <tr class:active={active === index} class={kind}>
          <th scope="row">
            <span class="flex items-start gap-2">
              <span class="swatch {kind} mt-1 shrink-0" aria-hidden="true"></span>
              <span>
                <span class="block font-semibold text-ink">{line.label}</span>
                <span class="block text-xs text-muted">{line.formula} · {line.basis}</span>
                {#if line.why && !compact}<span class="mt-1 block text-xs text-ink/80">{line.why}</span>{/if}
              </span>
            </span>
          </th>
          <td class="num">{#if line.inriaCents === null}<span class="text-xs text-muted">non compté</span>{:else}{eur(line.inriaCents)}{/if}</td>
          <td class="num">{#if line.lawCents === null}<span class="text-xs text-muted">non compté</span>{:else}{eur(line.lawCents)}{/if}</td>
        </tr>
      {/each}
    </tbody>
    <tfoot>
      <tr>
        <th scope="row">Total par mois</th>
        <td class="num">{eur(item.inriaCents)}</td>
        <td class="num">{eur(item.lawCents)}</td>
      </tr>
    </tfoot>
  </table>

  {#if compact}
    <ul class="space-y-1 text-sm leading-relaxed text-muted">
      {#each item.lines.filter((l) => l.why) as line (line.label)}
        <li><strong class="text-ink">{line.label}.</strong> {line.why}</li>
      {/each}
    </ul>
  {/if}
  <p class="text-sm leading-relaxed text-muted">{item.incomeNote}</p>
  {#if item.caveat}<p class="text-sm leading-relaxed text-muted">{item.caveat}</p>{/if}
</figure>

<style>
  .gap-fig {
    --seg-shared: #d5d9c2;
    --seg-inria: #f47230;
    --seg-law: #6a4ce2;
    display: grid;
    gap: 1rem;
    min-width: 0;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.1rem;
    font-size: 0.8rem;
    color: var(--ink-muted);
  }
  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .swatch {
    display: inline-block;
    width: 0.85rem;
    height: 0.85rem;
    border-radius: 3px;
  }
  .shared {
    --fill: var(--seg-shared);
  }
  .inria {
    --fill: repeating-linear-gradient(135deg, var(--seg-inria) 0 5px, #f8a57a 5px 8px);
  }
  .law {
    --fill: var(--seg-law);
  }
  .swatch {
    background: var(--fill);
  }
  .swatch.gap {
    background: transparent;
    border: 1.5px dashed var(--ink-muted);
  }
  .bars {
    display: grid;
    gap: 0.6rem;
  }
  .bar-row {
    display: grid;
    grid-template-columns: 7.5rem minmax(0, 1fr) 5.5rem;
    align-items: center;
    gap: 0.75rem;
  }
  .bar-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--ink);
  }
  .bar-total {
    text-align: right;
    font-family: var(--font-display);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--ink);
  }
  .bar {
    display: block;
    width: 100%;
    height: 2rem;
    overflow: visible;
  }
  .seg-shared {
    fill: var(--seg-shared);
  }
  .seg-law {
    fill: var(--seg-law);
  }
  .fill-inria {
    fill: var(--seg-inria);
  }
  .fill-inria-light {
    fill: #f8a57a;
  }
  .bar rect {
    transition: opacity 120ms;
  }
  .bar rect.dim {
    opacity: 0.35;
  }
  .missing {
    fill: none;
    stroke: var(--ink-muted);
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
  }
  .readout {
    min-height: 2.6rem;
    font-size: 0.9rem;
    line-height: 1.45;
    color: var(--ink-muted);
  }
  .calc {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  .calc th,
  .calc td {
    padding: 0.55rem 0.4rem;
    border-top: 1px solid var(--line);
    text-align: left;
    vertical-align: top;
    font-weight: 400;
  }
  .calc thead th {
    border-top: 0;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--ink-muted);
  }
  .calc .num {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .calc tfoot th,
  .calc tfoot td {
    border-top: 2px solid var(--ink);
    font-weight: 700;
    color: var(--ink);
  }
  .calc tr.active {
    background: var(--bg);
  }
  @media (max-width: 40rem) {
    .bar-row {
      grid-template-columns: minmax(0, 1fr) auto;
    }
    .bar-label {
      grid-column: 1 / -1;
    }
  }
</style>
