<script lang="ts">
import { LEVEL_INFO, type Level, levelName } from '#lib/levels.ts'
import LevelSwatch from './LevelSwatch.svelte'

let { level, flags = [] }: { level: Level; flags?: string[] } = $props()
const contested = $derived(flags.includes('contested'))
const refuted = $derived(flags.includes('refuted'))
</script>

<span class="inline-flex flex-wrap items-center gap-2">
  <span class="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-0.5 font-semibold" title={LEVEL_INFO[level].meaning}>
    <LevelSwatch {level} />
    {levelName(level)}
  </span>
  {#if contested}
    <span class="rounded-full border border-contested bg-surface px-2.5 py-0.5 text-sm font-semibold"><span aria-hidden="true">🟠 </span>Contesté · niveau gelé</span>
  {/if}
  {#if refuted}
    <span class="rounded-full border border-ko bg-surface px-2.5 py-0.5 text-sm font-semibold"><span aria-hidden="true">✝ </span>Réfuté</span>
  {/if}
</span>
