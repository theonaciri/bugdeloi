<script lang="ts">
import { Bot, Cpu, UserRound } from '@lucide/svelte'
import Term from '#lib/components/Term.svelte'
import { formatInt } from '#lib/format.ts'
import { LEVEL_INFO, LEVEL_RANK, type Level, type LevelCounts, levelSlug } from '#lib/levels.ts'
import { type Actor, type BoardLane, STAGE_INFO, STAGES, type Stage } from '#lib/work.ts'
import StageGlyph from './StageGlyph.svelte'

/**
 * Le parcours d'un article, de son texte officiel à la relecture signée : six stations,
 * chacune avec qui agit, ce qu'on fait, le contrôle qui fait monter le niveau et, en direct,
 * combien d'articles s'y trouvent. Avec `articleLevel`, la station atteinte par un article
 * précis est mise en évidence (fiche d'une tâche).
 */
let {
  levels,
  lanes = [],
  articleLevel = null,
  activeStage = null,
  showCounts = true,
  compact = false,
}: {
  levels: LevelCounts
  lanes?: BoardLane[]
  articleLevel?: Level | null
  activeStage?: Stage | null
  showCounts?: boolean
  /** Rail court (fiche d'une tâche) : verbe, niveau et position seulement. */
  compact?: boolean
} = $props()

const STATE_LABEL = {
  passed: 'franchie',
  current: 'cette tâche',
  next: 'ensuite',
  future: 'à venir',
} as const

type Station = {
  key: Stage | 'texte'
  verb: string
  level: Level
  actor: Actor
  who: string
  what: string
  check: string
  termId: string | null
}

const stations: Station[] = [
  {
    key: 'texte',
    verb: 'Importer',
    level: 'N0',
    actor: 'machine',
    who: 'Un programme automatique, chaque nuit',
    what: 'Importe le texte officiel de chaque article depuis la base publique LEGI (DILA).',
    check:
      'L’identifiant officiel et l’empreinte numérique du texte sont enregistrés afin de détecter toute modification.',
    termId: 'legi',
  },
  ...STAGES.map((s) => {
    const i = STAGE_INFO[s]
    return {
      key: s,
      verb: i.verb,
      level: i.to,
      actor: i.actor,
      who: i.who,
      what: i.what,
      check: i.check,
      termId:
        s === 'analyse' ? 'analyse' : s === 'traduction' ? 'traduction' : s === 'oracles' ? 'oracle' : null,
    }
  }),
]

const actorIcon = { machine: Cpu, agent: Bot, humain: UserRound } as const

function lane(stage: Station['key']): BoardLane | undefined {
  return lanes.find((l) => l.stage === stage)
}

function stateOf(st: Station): 'passed' | 'current' | 'next' | 'future' | null {
  if (!articleLevel) return null
  const rank = LEVEL_RANK[articleLevel === 'REF' ? 'N0' : articleLevel]
  if (st.key === activeStage) return 'current'
  if (LEVEL_RANK[st.level] <= rank) return 'passed'
  if (LEVEL_RANK[st.level] === rank + 1) return 'next'
  return 'future'
}
</script>

<ol class="journey" class:compact aria-label="Les six étapes de formalisation d’un article">
  {#each stations as st, i (st.key)}
    {@const Icon = actorIcon[st.actor]}
    {@const l = st.key === 'texte' ? undefined : lane(st.key)}
    {@const state = stateOf(st)}
    {@const open = st.key === 'texte' || STAGE_INFO[st.key].open}
    <li class="station" data-state={state ?? undefined} aria-current={state === 'current' ? 'step' : undefined}>
      <div class="station-head">
        <span class="glyph-disc">
          <StageGlyph stage={st.key} size={40} />
        </span>
        <span class="step-index" aria-hidden="true">{i + 1}</span>
      </div>
      <div class="station-body">
        <h3 class="text-[1.2rem] font-bold leading-tight [font-stretch:115%]">
          {#if st.termId}<Term id={st.termId}>{st.verb}</Term>{:else}{st.verb}{/if}
        </h3>
        <p class="lvl-chip mt-1.5 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[0.75rem] font-bold lvl-bg-{levelSlug(st.level)}">
          {st.level} · {LEVEL_INFO[st.level].label}
        </p>
        {#if !compact}
          <p class="mt-3 flex items-start gap-1.5 text-[0.8rem] font-semibold text-ink">
            <Icon class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>{st.who}</span>
          </p>
          <p class="mt-1.5 text-[0.88rem] leading-relaxed text-muted">{st.what}</p>
          <p class="mt-2 text-[0.8rem] leading-relaxed text-ink"><strong class="font-semibold">Contrôle :</strong> {st.check}</p>
        {/if}
        {#if showCounts}<p class="station-count">
          {#if st.key === 'texte'}
            <strong>{formatInt(levels.N0)}</strong> articles à ce stade
          {:else if l && open}
            <strong>{formatInt(l.counts.done)}</strong> articles ont franchi cette étape
            {#if l.counts.todo > 0}<br /><strong>{formatInt(l.counts.todo)}</strong> tâches à prendre{/if}
            {#if l.counts.todo === 0 && l.waiting > 0}<br /><strong>{formatInt(l.waiting)}</strong> articles analysés hors périmètre ou à préciser{/if}
          {:else if l}
            <span class="text-subtle">Non encore ouverte au guichet</span>
            {#if l.waiting > 0}<br /><strong>{formatInt(l.waiting)}</strong> articles en attente{/if}
          {/if}
        </p>{/if}
        {#if state}<p class="state-label" data-state={state}>{STATE_LABEL[state]}</p>{/if}
      </div>
    </li>
  {/each}
</ol>

<style>
  .journey {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 0;
    counter-reset: none;
    position: relative;
  }
  .station {
    position: relative;
    padding-right: 1.1rem;
    min-width: 0;
  }
  .station-head {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.9rem;
  }
  /* Le rail qui relie les stations */
  .station-head::after {
    content: '';
    position: absolute;
    left: 3.6rem;
    right: -0.4rem;
    top: 50%;
    border-top: 1.5px dashed var(--line-strong);
  }
  .station:last-child .station-head::after {
    display: none;
  }
  .glyph-disc {
    display: grid;
    place-items: center;
    width: 3.2rem;
    height: 3.2rem;
    border-radius: 999px;
    background: var(--surface);
    border: 1.5px solid var(--ink);
    position: relative;
    z-index: 1;
  }
  .step-index {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--ink-subtle);
    background: var(--bg);
    padding-inline: 0.3rem;
    position: relative;
    z-index: 1;
  }
  .station-count {
    margin-top: 0.9rem;
    padding-top: 0.6rem;
    border-top: 1px solid var(--line);
    font-size: 0.8rem;
    line-height: 1.5;
    color: var(--ink-muted);
  }
  .station-count strong {
    font-family: var(--font-display);
    font-weight: 700;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
  }
  .station[data-state='passed'] .glyph-disc {
    background: var(--brand-soft);
    border-color: var(--brand);
  }
  .station[data-state='future'] .glyph-disc {
    border-style: dashed;
    border-color: var(--line-strong);
  }
  .station[data-state='future'] h3,
  .station[data-state='future'] p:not(.lvl-chip) {
    color: var(--ink-muted);
  }
  .station[data-state='current'] .glyph-disc {
    border-width: 3px;
    border-color: var(--brand);
    box-shadow: 0 0 0 5px var(--brand-soft);
  }
  .state-label {
    margin-top: 0.6rem;
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--ink-muted);
  }
  .state-label[data-state='passed'] {
    color: var(--ok);
  }
  .state-label[data-state='current'] {
    color: var(--brand);
  }
  .state-label[data-state='current']::before {
    content: '● ';
  }
  .compact .station-head {
    margin-bottom: 0.6rem;
  }
  @media (max-width: 63.99rem) {
    .journey {
      grid-template-columns: 1fr;
      gap: 0;
    }
    .station {
      display: grid;
      grid-template-columns: 3.2rem 1fr;
      gap: 1rem;
      padding: 0 0 1.6rem;
    }
    .station-head {
      flex-direction: column;
      margin: 0;
    }
    .station-head::after {
      display: none;
    }
    .station:not(:last-child)::before {
      content: '';
      position: absolute;
      left: 1.6rem;
      top: 3.4rem;
      bottom: 0.2rem;
      border-left: 1.5px dashed var(--line-strong);
    }
    .step-index {
      display: none;
    }
  }
</style>
