<script lang="ts">
/** Barre décorative : la valeur est toujours écrite en texte à côté (l'SVG est masqué aux lecteurs d'écran). */
let { value, max }: { value: number; max: number } = $props()
const pct = $derived(max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0)
</script>

<svg class="block h-3 w-full" aria-hidden="true" focusable="false" preserveAspectRatio="none">
  <rect x="0" y="0" width="100%" height="100%" rx="6" class="bdl-track" />
  {#if pct > 0}
    <rect x="0" y="0" width="{Math.max(pct, 0.8)}%" height="100%" rx="6" class="bdl-bar" />
  {/if}
</svg>
