<script lang="ts">
import { LEVEL_INFO, type Level, type LevelCounts, levelSlug } from '#lib/levels.ts'
import LiveNumber from './LiveNumber.svelte'

/**
 * Décompte façon résultat de scrutin : une colonne par niveau, du texte brut (N0) à la relecture
 * signée (N5), puis ★. Chaque colonne est un bouton qui met en avant ses sièges dans l'hémicycle.
 * Un niveau vide reste affiché, en creux : l'absence dit ce qui reste à faire.
 */
let {
  counts,
  selected = $bindable(null),
  tone = 'paper',
}: { counts: LevelCounts; selected?: Level | null; tone?: 'paper' | 'night' } = $props()

const ORDER: Level[] = ['N0', 'N1', 'N2', 'N3', 'N4', 'N5', 'REF']
const total = $derived(ORDER.reduce((n, l) => n + counts[l], 0))
const pct = (n: number) =>
  total > 0
    ? `${((n / total) * 100).toLocaleString('fr-FR', { maximumFractionDigits: n / total < 0.01 ? 2 : 1 })} %`
    : '0 %'
</script>

<div class="tally" role="group" aria-label="Décompte des articles en vigueur par niveau">
  {#each ORDER as level (level)}
    {@const n = counts[level]}
    {@const info = LEVEL_INFO[level]}
    <button
      type="button"
      class="tally-item"
      class:is-empty={n === 0}
      class:is-night={tone === 'night'}
      aria-pressed={selected === level}
      onclick={() => (selected = selected === level ? null : level)}
    >
      <span class="flex items-center gap-2">
        <span class="swatch lvl-bg-{levelSlug(level)}" class:swatch-empty={n === 0} aria-hidden="true"></span>
        <span class="text-[0.78rem] font-bold tracking-wide">{level === 'REF' ? '★' : level}</span>
        <span class="truncate text-[0.78rem]">{info.label}</span>
      </span>
      <span class="mt-1 block font-display text-[1.55rem] font-bold leading-none [font-stretch:112%]">
        <LiveNumber value={n} />
      </span>
      <span class="mt-1 block text-[0.75rem] text-muted">{n === 0 ? 'aucun pour l’instant' : pct(n)}</span>
    </button>
  {/each}
</div>

<style>
  .tally {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    border-top: 2px solid currentColor;
  }
  .tally-item {
    text-align: left;
    padding: 0.7rem 0.6rem 0.8rem;
    border-right: 1px solid var(--line);
    cursor: pointer;
    min-width: 0;
    transition: background-color 160ms ease;
  }
  .tally-item:last-child {
    border-right: 0;
  }
  .tally-item:hover {
    background: var(--surface-2);
  }
  .tally-item[aria-pressed='true'] {
    background: var(--brand-soft);
    outline: 2px solid var(--brand);
    outline-offset: -2px;
  }
  .is-night {
    border-color: var(--obs-line);
  }
  .is-night:hover {
    background: var(--obs-surface);
  }
  .is-night[aria-pressed='true'] {
    background: var(--obs-surface-2);
    outline: 2px solid var(--obs-cobalt);
    outline-offset: -2px;
  }
  .is-empty {
    color: var(--ink-muted);
  }
  .is-night.is-empty {
    color: var(--obs-muted);
  }
  .swatch {
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 999px;
    flex: none;
  }
  .swatch-empty {
    background: transparent;
    border: 1.5px dashed var(--ink-muted);
  }
  .is-night .swatch-empty {
    border-color: var(--obs-muted);
  }
  @media (max-width: 47.99rem) {
    .tally {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .tally-item {
      border-bottom: 1px solid var(--line);
    }
    .tally-item:nth-child(2n) {
      border-right: 0;
    }
  }
  @media (min-width: 48rem) and (max-width: 63.99rem) {
    .tally {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
</style>
