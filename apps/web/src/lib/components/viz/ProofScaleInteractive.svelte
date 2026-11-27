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
  N0: 'Texte officiel chargé depuis la DILA avec son empreinte cryptographique.',
  N1: 'Interface figée et texte officiel cité à l’identique, alinéa par alinéa.',
  N2: 'Compilation Catala et tests verts dans l’environnement épinglé ; chaque constante est sourcée.',
  N3: 'Validation contre au moins deux sources indépendantes (dont une non issue d’une IA).',
  N4: '10 000 cas testés contre une implémentation tierce, tests de mutation ≥ 80 % et 7 jours de contre-attaques.',
  N5: 'Relecture juridique complète et signée par un juriste identifié.',
  REF: 'Formalisation réalisée par des chercheurs ou une administration (Inria, DGFiP…) dont les tests réussissent chez nous.',
}

const neverProof = [
  'L’auto-évaluation d’une intelligence artificielle',
  'Le seul fait qu’un programme compile sans erreur',
  'L’accord de deux modèles issus du même fournisseur',
  'Un test rédigé par l’auteur même de la traduction',
  'Un résultat qu’un tiers ne peut pas reproduire',
]
</script>

<div class="space-y-8">
  <!-- Barre horizontale aérée (sans empilement de boîtes) -->
  <div
    class="flex flex-wrap items-center gap-2 border-b border-line pb-5"
    role="tablist"
    aria-label="Niveaux de preuve N0 à N5 et Référence"
  >
    {#each LEVELS as lvl (lvl)}
      {@const isSelected = currentLevel === lvl}
      {@const count = counts?.[lvl]}
      <button
        type="button"
        role="tab"
        aria-selected={isSelected}
        onclick={() => (selected = lvl)}
        class={cn(
          'inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-sm transition-colors cursor-pointer',
          isSelected
            ? 'bg-ink text-bg font-semibold'
            : 'bg-surface-2/75 text-ink hover:bg-surface-3',
        )}
      >
        <LevelSwatch level={lvl} size={18} />
        <span>{levelName(lvl)}</span>
        {#if count !== undefined}
          <span class={cn('text-xs tabular', isSelected ? 'opacity-75' : 'text-muted')}>
            {formatInt(count)}
          </span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Lecture éditoriale ouverte sur deux colonnes -->
  <div class="grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:items-start">
    <div class="space-y-4">
      <div class="flex items-center gap-3.5">
        <LevelSwatch level={currentLevel} size={34} />
        <h3 class="font-serif text-3xl font-semibold text-ink">{levelName(currentLevel)}</h3>
      </div>

      <p class="font-serif text-xl leading-relaxed text-ink">{info.meaning}</p>

      <div class="flex items-start gap-2.5 pt-2 text-sm text-brand-strong">
        <ShieldCheck class="mt-0.5 size-4.5 shrink-0" aria-hidden="true" />
        <p>{checkerByLevel[currentLevel]}</p>
      </div>

      <div class="pt-2">
        <a
          href="/travail?niveau={currentLevel}"
          class="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-strong no-underline hover:underline"
        >
          {#if counts}
            Voir les {formatInt(counts[currentLevel])} articles ({levelName(currentLevel)}) →
          {:else}
            Voir les articles au niveau {levelName(currentLevel)} →
          {/if}
        </a>
      </div>
    </div>

    <div class="rounded-[var(--radius-xl)] bg-surface-2/70 p-6 space-y-3">
      <p class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ko">
        <ShieldOff class="size-4" aria-hidden="true" />
        Ce qui ne compte jamais comme preuve
      </p>
      <ul class="space-y-2 text-sm text-muted">
        {#each neverProof as item (item)}
          <li class="flex items-start gap-2.5">
            <span class="mt-2 size-1.5 shrink-0 rounded-full bg-ko/60" aria-hidden="true"></span>
            <span>{item}</span>
          </li>
        {/each}
      </ul>
    </div>
  </div>
</div>
