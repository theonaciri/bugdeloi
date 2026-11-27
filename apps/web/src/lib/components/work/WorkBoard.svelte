<script lang="ts">
import { formatInt } from '#lib/format.ts'
import { LEVEL_INFO } from '#lib/levels.ts'
import { type BoardLane, COLUMN_INFO, COLUMNS, type Column, STAGE_INFO } from '#lib/work.ts'
import LiveNumber from './LiveNumber.svelte'
import StageGlyph from './StageGlyph.svelte'
import TaskCard from './TaskCard.svelte'

/**
 * Le tableau du travail (Kanban) : une ligne par étape du parcours, quatre colonnes
 * (à prendre → en cours → en relecture → intégrées). Chaque case donne son compte exact ;
 * les cartes mènent à la fiche de chaque tâche. Une étape que le guichet ne distribue pas
 * encore l'affiche en creux, avec le nombre d'articles qui l'attendent.
 */
let {
  lanes,
  maxCards = 3,
  tone = 'night',
  caption,
}: { lanes: BoardLane[]; maxCards?: number; tone?: 'paper' | 'night'; caption: string } = $props()

const HINT: Record<Column, string> = {
  todo: 'le guichet les donne dans l’ordre',
  doing: 'réservées par un contributeur',
  review: 'déposées, en attente de fusion',
  done: 'l’article a monté d’un niveau',
}

function moreHref(lane: BoardLane, column: Column): string | null {
  const role = STAGE_INFO[lane.stage].roles[0]
  if (column === 'todo' && role) return `/taches?role=${role}`
  if (column === 'done') return `/travail?niveau=${STAGE_INFO[lane.stage].to}`
  return null
}
</script>

<div class="board" class:board-night={tone === 'night'} role="table" aria-label={caption}>
  <div class="board-row board-header" role="row">
    <div class="cell head-cell" role="columnheader">Étape</div>
    {#each COLUMNS as col (col)}
      <div class="cell head-cell" role="columnheader">
        <span class="block">{COLUMN_INFO[col].label}</span>
        <span class="hint block text-[0.75rem] font-normal normal-case tracking-normal">{HINT[col]}</span>
      </div>
    {/each}
  </div>

  {#each lanes as lane (lane.stage)}
    {@const info = STAGE_INFO[lane.stage]}
    <div class="board-row" role="row" class:lane-closed={!info.open}>
      <div class="cell lane-head" role="rowheader">
        <StageGlyph stage={lane.stage} size={34} {tone} />
        <span class="min-w-0">
          <span class="block font-display text-[1.05rem] font-bold leading-tight [font-stretch:112%]">{info.verb}</span>
          <span class="block text-[0.75rem] text-[var(--b-muted)]">{info.from} → {info.to} {LEVEL_INFO[info.to].label}</span>
          <span class="mt-0.5 block text-[0.72rem] font-semibold" class:text-open={info.open}>
            {info.open ? 'Ouverte au guichet' : 'Pas encore ouverte'}
          </span>
        </span>
      </div>

      {#if info.open}
        {#each COLUMNS as col (col)}
          {@const n = lane.counts[col]}
          {@const cards = lane.cards[col].slice(0, maxCards)}
          {@const more = moreHref(lane, col)}
          <div class="cell" role="cell" data-column={col}>
            <span class="col-label" aria-hidden="true">{COLUMN_INFO[col].label}</span>
            <span class="count" class:count-zero={n === 0}>
              <LiveNumber value={n} />
            </span>
            <span class="unit">{col === 'done' ? (n > 1 ? 'articles' : 'article') : n > 1 ? 'tâches' : 'tâche'}</span>
            {#if cards.length > 0}
              <div class="mt-2.5 grid gap-1.5">
                {#each cards as card (card.taskId)}
                  <TaskCard {card} column={col} {tone} />
                {/each}
              </div>
            {:else if n === 0 && maxCards > 0}
              <p class="ghost">{col === 'doing' ? 'Personne pour l’instant' : col === 'review' ? 'Rien en attente' : 'Aucune pour l’instant'}</p>
            {/if}
            {#if more && n > cards.length && maxCards > 0}
              <a class="more" href={more}>{col === 'todo' ? `Voir les ${formatInt(n)} tâches` : 'Voir les articles'} →</a>
            {/if}
            {#if col === 'todo' && lane.waiting > 0 && lane.stage !== 'analyse'}
              <p class="waiting">+ {formatInt(lane.waiting)} articles en attente d’une interface figée</p>
            {/if}
          </div>
        {/each}
      {:else}
        <div class="cell closed-cell" role="cell">
          <span class="col-label" aria-hidden="true">À prendre · En cours · En relecture</span>
          <p class="ghost-strong">
            Le guichet ne distribue pas encore cette étape.
            {#if lane.waiting > 0}
              <strong>{formatInt(lane.waiting)}</strong> {lane.waiting > 1 ? 'articles l’attendent' : 'article l’attend'} au niveau {info.from}.
            {:else}
              Aucun article ne l’attend encore.
            {/if}
          </p>
        </div>
        <div class="cell" role="cell" data-column="done">
          <span class="col-label" aria-hidden="true">{COLUMN_INFO.done.label}</span>
          <span class="count" class:count-zero={lane.counts.done === 0}><LiveNumber value={lane.counts.done} /></span>
          <span class="unit">{lane.counts.done > 1 ? 'articles' : 'article'}</span>
        </div>
      {/if}
    </div>
  {/each}
</div>

<style>
  .board {
    --b-line: var(--line);
    --b-ink: var(--ink);
    --b-muted: var(--ink-muted);
    --b-cell: var(--surface);
    --b-head: var(--surface-2);
    --b-open: var(--ok);
    color: var(--b-ink);
    border: 1px solid var(--b-line);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  .board-night {
    --b-line: var(--obs-line-strong);
    --b-ink: var(--obs-ink);
    --b-muted: var(--obs-muted);
    --b-cell: var(--obs-bg);
    --b-head: var(--obs-surface);
    --b-open: var(--obs-emerald);
  }
  .board-row {
    display: grid;
    grid-template-columns: minmax(12.5rem, 1.15fr) repeat(4, minmax(0, 1fr));
    border-top: 1px solid var(--b-line);
  }
  .board-row:first-child {
    border-top: 0;
  }
  .cell {
    padding: 0.9rem 0.85rem 1rem;
    border-left: 1px solid var(--b-line);
    background: var(--b-cell);
    min-width: 0;
  }
  .cell:first-child {
    border-left: 0;
  }
  .head-cell {
    background: var(--b-head);
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding-block: 0.7rem;
  }
  .lane-head {
    display: flex;
    gap: 0.7rem;
    align-items: flex-start;
    background: var(--b-head);
  }
  .text-open {
    color: var(--b-open);
  }
  .hint {
    color: var(--b-muted);
  }
  .closed-cell {
    grid-column: span 3;
    display: flex;
    align-items: center;
    background: repeating-linear-gradient(
      -45deg,
      transparent 0 9px,
      color-mix(in oklab, var(--b-line) 55%, transparent) 9px 10px
    );
  }
  .count {
    display: block;
    font-family: var(--font-display);
    font-weight: 800;
    font-stretch: 112%;
    font-size: 1.9rem;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .count-zero {
    color: var(--b-muted);
  }
  .unit {
    display: block;
    margin-top: 0.2rem;
    font-size: 0.72rem;
    color: var(--b-muted);
  }
  .col-label {
    display: none;
  }
  .ghost {
    margin-top: 0.6rem;
    padding: 0.5rem 0.6rem;
    border: 1px dashed var(--b-line);
    border-radius: var(--radius);
    font-size: 0.74rem;
    color: var(--b-muted);
  }
  .ghost-strong {
    font-size: 0.84rem;
    line-height: 1.5;
    color: var(--b-muted);
    max-width: 52ch;
  }
  .ghost-strong strong {
    color: var(--b-ink);
    font-family: var(--font-display);
  }
  .waiting {
    margin-top: 0.6rem;
    font-size: 0.74rem;
    line-height: 1.45;
    color: var(--b-muted);
  }
  .more {
    display: inline-block;
    margin-top: 0.6rem;
    font-size: 0.76rem;
    font-weight: 600;
  }
  .board-night .more {
    color: var(--obs-cobalt);
  }
  @media (max-width: 63.99rem) {
    .board-header {
      display: none;
    }
    .board-row {
      grid-template-columns: minmax(0, 1fr);
    }
    .lane-head {
      border-left: 0;
    }
    .cell {
      border-top: 1px solid var(--b-line);
      border-left: 0;
      display: grid;
      grid-template-columns: 7.5rem auto minmax(0, 1fr);
      column-gap: 0.75rem;
      align-items: baseline;
    }
    .cell > :not(.col-label):not(.count):not(.unit) {
      grid-column: 1 / -1;
    }
    .lane-head {
      display: flex;
    }
    .closed-cell {
      display: block;
    }
    .closed-cell .col-label {
      margin-bottom: 0.35rem;
    }
    .col-label {
      display: block;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--b-muted);
    }
  }
</style>
