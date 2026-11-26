<script lang="ts">
import { ShieldCheck, ShieldOff } from '@lucide/svelte'
import LevelSwatch from '#lib/components/LevelSwatch.svelte'
import { formatInt } from '#lib/format.ts'
import { LEVEL_INFO, LEVELS, type Level, type LevelCounts, levelName } from '#lib/levels.ts'
import { cn } from '#lib/utils/cn.ts'

let {
  counts,
  initial = 'REF',
}: {
  counts?: LevelCounts
  initial?: Level
} = $props()

let selected = $state<Level | null>(null)
const currentLevel = $derived(selected ?? initial)
const info = $derived(LEVEL_INFO[currentLevel])

const checkerByLevel: Record<Level, string> = {
  N0: 'ingest · empreinte SHA-256 LEGI',
  N1: 'check anchor · texte identique à LEGI',
  N2: 'check compile · clerk test (image épinglée)',
  N3: 'check oracles · ≥ 2 sources indépendantes (≥ 1 non-LLM)',
  N4: 'check differential · ≥ 10 000 entrées + mutations ≥ 80 % + 7 j red team',
  N5: 'check human · revue signée par un juriste identifié',
  REF: 'replications/c0.1/promote.ts · suite externe verte chez nous',
}

const neverProof = [
  'L’auto-évaluation d’un LLM',
  '« Ça compile » seul',
  'Un vote ou accord entre deux modèles de la même famille',
  'Un test écrit par l’auteur de la traduction',
  'Un chiffre qu’un tiers ne peut pas rejouer',
]
</script>

<div class="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
  <div class="space-y-2" role="tablist" aria-label="Niveaux de preuve N0 à N5 et Référence">
    {#each LEVELS as lvl, idx (lvl)}
      {@const isSelected = currentLevel === lvl}
      {@const count = counts?.[lvl]}
      <button
        type="button"
        role="tab"
        aria-selected={isSelected}
        onclick={() => (selected = lvl)}
        class={cn(
          'flex w-full items-center justify-between gap-3 rounded-[var(--radius)] border px-3.5 py-2.5 text-left transition-all cursor-pointer',
          isSelected
            ? 'border-brand bg-brand-soft/50 shadow-xs'
            : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2/50',
        )}
      >
        <span class="flex items-center gap-3 min-w-0">
          <LevelSwatch level={lvl} size={26} />
          <span class="min-w-0">
            <span class="flex items-center gap-2">
              <span class="font-semibold text-sm text-ink">{levelName(lvl)}</span>
              {#if lvl === 'REF'}
                <span class="mono rounded bg-notice px-1.5 py-0.5 text-[0.65rem] text-notice-ink">
                  marqueur externe
                </span>
              {:else}
                <span class="mono text-[0.68rem] text-subtle">palier {idx}/5</span>
              {/if}
            </span>
            <span class="block truncate text-xs text-muted">{checkerByLevel[lvl]}</span>
          </span>
        </span>
        {#if count !== undefined}
          <span class="mono shrink-0 text-sm font-bold tabular text-ink">{formatInt(count)}</span>
        {/if}
      </button>
    {/each}
  </div>

  <div class="flex flex-col justify-between gap-4 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
    <div class="space-y-3">
      <div class="flex items-center gap-3">
        <LevelSwatch level={currentLevel} size={36} />
        <div>
          <p class="kicker">Contrôle mécanique sélectionné</p>
          <h3 class="font-serif text-2xl font-semibold text-ink">{levelName(currentLevel)}</h3>
        </div>
      </div>

      <p class="text-sm leading-relaxed text-ink">{info.meaning}</p>

      <div class="rounded-[var(--radius-sm)] border border-line bg-surface-2/70 px-3 py-2.5">
        <p class="flex items-center gap-1.5 text-xs font-semibold text-brand-strong">
          <ShieldCheck class="size-3.5" aria-hidden="true" />
          Vérification correspondante
        </p>
        <p class="mono mt-1 text-xs text-muted">{checkerByLevel[currentLevel]}</p>
      </div>
    </div>

    <div class="border-t border-line pt-4">
      <p class="flex items-center gap-1.5 text-xs font-semibold text-ko">
        <ShieldOff class="size-3.5" aria-hidden="true" />
        Ce qui n’est jamais un marqueur de preuve
      </p>
      <ul class="mt-2 space-y-1 text-xs text-muted">
        {#each neverProof as item (item)}
          <li class="flex items-start gap-2">
            <span class="mt-1 size-1.5 shrink-0 rounded-full bg-ko/70" aria-hidden="true"></span>
            <span>{item}</span>
          </li>
        {/each}
      </ul>
    </div>
  </div>
</div>
