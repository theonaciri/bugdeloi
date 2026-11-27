<script lang="ts">
/**
 * Pictogrammes des étapes du parcours, dessinés au trait (1,6 px) avec un lavis d'encre violette.
 * Un sujet par planche : la page du texte, la page surlignée, le code, la liste de cas, la grille
 * d'essais, la signature.
 */
import type { Stage } from '#lib/work.ts'

let {
  stage,
  size = 44,
  tone = 'paper',
}: { stage: Stage | 'texte'; size?: number; tone?: 'paper' | 'night' } = $props()
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 48 48"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  class="glyph"
  class:glyph-night={tone === 'night'}
>
  {#if stage === 'texte'}
    <path class="wash" d="M11 5.5h18l8 8v29H11z" />
    <path d="M11 5.5h18l8 8v29H11z" />
    <path d="M29 5.5v8h8" />
    <path d="M16 19h16M16 24h16M16 29h12M16 34h14" />
  {:else if stage === 'analyse'}
    <path class="wash" d="M9 5.5h18l7 7v30H9z" />
    <path d="M9 5.5h18l7 7v30H9z" />
    <path d="M27 5.5v7h7" />
    <rect class="hl" x="13" y="16.2" width="15" height="4.6" rx="1" stroke="none" />
    <path d="M14 18.5h13M14 25h16M14 31h9" />
    <circle cx="33.5" cy="33.5" r="6.5" class="lens" />
    <path d="M38.2 38.2l4.6 4.6" />
  {:else if stage === 'traduction'}
    <path class="wash" d="M5.5 9.5h17v29h-17z" />
    <path d="M5.5 9.5h17v29h-17z" />
    <path d="M9.5 16h9M9.5 21h9M9.5 26h6" />
    <path d="M25.5 24h5.5M28.5 21l3 3-3 3" />
    <path d="M38 11c-2.4 0-3.4 1.2-3.4 3.5v5.2c0 2-1 3.2-2.6 3.3 1.6.1 2.6 1.3 2.6 3.3v5.2c0 2.3 1 3.5 3.4 3.5" />
    <path d="M40 15.5l2.5 0M40 24h2.5M40 32.5h2.5" />
  {:else if stage === 'oracles'}
    <path class="wash" d="M8 7.5h32v33H8z" />
    <path d="M8 7.5h32v33H8z" />
    <rect x="12.5" y="13" width="5.5" height="5.5" rx="1" />
    <rect x="12.5" y="21.3" width="5.5" height="5.5" rx="1" />
    <rect x="12.5" y="29.6" width="5.5" height="5.5" rx="1" />
    <path d="M13.8 15.8l1.3 1.3 2.4-2.8M13.8 24.1l1.3 1.3 2.4-2.8M13.8 32.4l1.3 1.3 2.4-2.8" />
    <path d="M22 15.8h13M22 24h10M22 32.4h12" />
  {:else if stage === 'epreuve'}
    <path class="wash" d="M6.5 6.5h35v35h-35z" />
    {#each [0, 1, 2, 3, 4] as row (row)}
      {#each [0, 1, 2, 3, 4] as col (col)}
        {#if !(row === 3 && col === 1)}
          <circle cx={11 + col * 6.5} cy={11 + row * 6.5} r="1.5" class="dot" stroke="none" />
        {/if}
      {/each}
    {/each}
    <path d="M15.5 28.5l4 4M19.5 28.5l-4 4" class="cross" />
  {:else}
    <path class="wash" d="M6 34c4-1 6-8 9-8s1 6 4 6 4-7 7-7 2 5 5 5h11v8H6z" />
    <path d="M6 34c4-1 6-8 9-8s1 6 4 6 4-7 7-7 2 5 5 5" />
    <path d="M6 41.5h36" />
    <path d="M33 25l9-15 3 1.8-9 15-4 2.2z" />
    <path d="M39.5 14.3l3 1.8" />
  {/if}
</svg>

<style>
  .glyph {
    color: var(--ink);
    flex: none;
  }
  .glyph .wash {
    fill: var(--brand-soft);
    stroke: none;
  }
  .glyph .hl {
    fill: var(--mark);
  }
  .glyph .lens {
    fill: var(--surface);
  }
  .glyph .dot {
    fill: currentColor;
  }
  .glyph .cross {
    stroke: var(--ko);
    stroke-width: 2;
  }
  .glyph-night {
    color: var(--obs-ink);
  }
  .glyph-night .wash {
    fill: var(--obs-surface-2);
  }
  .glyph-night .lens {
    fill: var(--obs-bg);
  }
</style>
