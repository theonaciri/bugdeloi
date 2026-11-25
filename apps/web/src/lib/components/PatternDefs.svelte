<!--
  Motifs des niveaux de preuve, définis une seule fois dans la page (référencés par
  url(#bdl-pat-…) depuis n'importe quel SVG). Ils doublent la couleur pour les personnes
  qui ne la distinguent pas (AGENTS.md §9.5).
-->
<svg width="0" height="0" class="absolute" aria-hidden="true" focusable="false">
  <defs>
    <pattern id="bdl-pat-ring" width="10" height="10" patternUnits="userSpaceOnUse">
      <circle cx="5" cy="5" r="2.6" class="bdl-pat-stroke" fill="none" stroke-width="1.2" />
    </pattern>
    <pattern id="bdl-pat-dots" width="7" height="7" patternUnits="userSpaceOnUse">
      <circle cx="3.5" cy="3.5" r="1.3" class="bdl-pat-fill" />
    </pattern>
    <pattern id="bdl-pat-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="7" class="bdl-pat-stroke" stroke-width="1.6" />
    </pattern>
    <pattern id="bdl-pat-star" width="14" height="14" patternUnits="userSpaceOnUse">
      <path
        d="M7 2.2l1.4 2.9 3.2.4-2.3 2.2.6 3.1L7 9.3l-2.9 1.5.6-3.1-2.3-2.2 3.2-.4z"
        class="bdl-pat-fill"
      />
    </pattern>
  </defs>
</svg>

<style>
  :global(.bdl-pat-fill) {
    fill: var(--pattern-ink);
  }
  :global(.bdl-pat-stroke) {
    stroke: var(--pattern-ink);
  }
</style>
