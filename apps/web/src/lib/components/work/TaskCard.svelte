<script lang="ts">
import { relativeTime } from '#lib/format.ts'
import type { BoardCard, Column } from '#lib/work.ts'

/** Une tâche sur le tableau : l'article, le rôle, qui la tient et depuis quand. Mène à sa fiche. */
let { card, column, tone = 'paper' }: { card: BoardCard; column: Column; tone?: 'paper' | 'night' } = $props()

const verb: Record<Column, string> = {
  todo: '',
  doing: 'réservée',
  review: 'déposée',
  done: 'intégrée',
}
</script>

<a href={`/taches/${card.taskId}`} class="task-card" class:task-card-night={tone === 'night'}>
  <span class="block font-display text-[0.95rem] font-bold leading-snug [font-stretch:108%] [overflow-wrap:anywhere]">
    {card.label}
  </span>
  {#if card.handle || (card.since && column !== 'todo')}
    <span class="meta mt-0.5 block text-[0.75rem] leading-snug">
      {#if card.handle}@{card.handle}{#if card.family} · {card.family}{/if}{/if}
      {#if card.since && column !== 'todo'}
        <span class="block">{verb[column]} {relativeTime(card.since)}</span>
      {/if}
    </span>
  {/if}
</a>

<style>
  .task-card {
    display: block;
    padding: 0.5rem 0.65rem 0.55rem;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    color: var(--ink);
    text-decoration: none;
    box-shadow: var(--shadow-xs);
    transition:
      border-color 150ms ease,
      transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
    min-width: 0;
  }
  .meta {
    color: var(--ink-muted);
  }
  .task-card-night .meta {
    color: var(--obs-muted);
  }
  .task-card:hover {
    border-color: var(--brand);
    transform: translateY(-1px);
  }
  .task-card-night {
    background: var(--obs-surface);
    border-color: var(--obs-line-strong);
    color: var(--obs-ink);
  }
  .task-card-night:hover {
    border-color: var(--obs-cobalt);
  }
</style>
