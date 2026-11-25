<script lang="ts">
import { LEVEL_INFO, LEVELS, levelName } from '#lib/levels.ts'
import LevelSwatch from './LevelSwatch.svelte'

let { compact = false }: { compact?: boolean } = $props()
</script>

<ul class={compact ? 'flex flex-wrap gap-x-4 gap-y-1 text-sm' : 'grid gap-2 sm:grid-cols-2'}>
  {#each LEVELS as level (level)}
    <li class="flex items-start gap-2">
      <LevelSwatch {level} size={compact ? 16 : 20} />
      <span>
        <strong>{levelName(level)}</strong>
        {#if !compact}<span class="block text-sm text-muted">{LEVEL_INFO[level].meaning}</span>{/if}
      </span>
    </li>
  {/each}
</ul>
