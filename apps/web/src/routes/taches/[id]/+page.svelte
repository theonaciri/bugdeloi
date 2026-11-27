<script lang="ts">
import { ArrowLeft, CircleCheck, CircleDot, ExternalLink, Hourglass, Inbox } from '@lucide/svelte'
import Term from '#lib/components/Term.svelte'
import { CopyButton } from '#lib/components/ui/index.ts'
import ArticleJourney from '#lib/components/work/ArticleJourney.svelte'
import StageGlyph from '#lib/components/work/StageGlyph.svelte'
import { formatDateTime, formatInt, formatLegiDate, formatTime, relativeTime } from '#lib/format.ts'
import { emptyLevelCounts, LEVEL_INFO } from '#lib/levels.ts'
import { COLUMN_INFO, COLUMNS, type Column, ROLE_LABEL, STAGE_INFO, type TaskStep } from '#lib/work.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()
const j = $derived(data.journey)
const stage = $derived(STAGE_INFO[j.stage])
const columnIndex = $derived(COLUMNS.indexOf(j.column))

/** Date à laquelle la tâche est entrée dans chaque colonne (dernière occurrence). */
const enteredAt = $derived.by(() => {
  const out: Partial<Record<Column, string>> = {}
  const map: Partial<Record<TaskStep['kind'], Column>> = {
    claimed: 'doing',
    submitted: 'review',
    integrated: 'done',
  }
  for (const s of j.steps) {
    const col = map[s.kind]
    if (col) out[col] = s.ts
  }
  return out
})

const StatusIcon = $derived({ todo: Inbox, doing: CircleDot, review: Hourglass, done: CircleCheck }[j.column])

const headline = $derived(
  `${stage.verb} ${j.articleNum ? `l’article ${j.articleNum}` : 'l’article'}${j.code ? ` du ${j.code}` : ''}`,
)

const nowLine = $derived.by(() => {
  switch (j.column) {
    case 'todo':
      if (j.blockedReason) return j.blockedReason
      return j.position === 1
        ? 'C’est la prochaine tâche que le guichet distribuera.'
        : `${formatInt(j.position ?? 0)}ᵉ dans la liste : le guichet la distribuera après ${formatInt((j.position ?? 1) - 1)} autres tâches de ce rôle.`
    case 'doing':
      return `Réservée par @${j.handle ?? '?'}${j.family ? ` (famille ${j.family})` : ''}${j.leaseExpiresAt ? `, bail valable jusqu’à ${formatTime(j.leaseExpiresAt)} en l’absence de renouvellement` : ''}.`
    case 'review':
      return `Travail déposé${enteredAt.review ? ` ${relativeTime(enteredAt.review)}` : ''}. Il attend les contrôles automatiques et la fusion dans le corpus.`
    case 'done':
      return `L’article a atteint le niveau ${stage.to} ${LEVEL_INFO[stage.to].label}${enteredAt.done ? ` le ${formatDateTime(enteredAt.done)}` : ''}.`
  }
})

const stepTone: Record<TaskStep['kind'], string> = {
  in_force: 'law',
  claimed: 'doing',
  released: 'back',
  expired: 'back',
  submitted: 'review',
  integrated: 'done',
}

const curl = $derived(
  `curl -s "${data.origin}/desk/next?handle=<pseudo>&role=${j.role}&family=<famille>&limit=1"`,
)
</script>

<svelte:head>
  <title>{headline} · Parcours de la tâche · BugDeLoi</title>
  <meta
    name="description"
    content={`Où en est la tâche « ${headline} » : statut, historique daté et prochaines étapes de l’article dans BugDeLoi.`}
  />
</svelte:head>

<section class="border-b border-line bg-surface">
  <div class="container-wide py-10 sm:py-12">
    <a href={`/taches${j.role === 'translate' ? '?role=translate' : ''}`} class="inline-flex items-center gap-1.5 text-sm font-semibold no-underline">
      <ArrowLeft class="size-4" aria-hidden="true" /> Toutes les tâches à prendre
    </a>
    <div class="mt-6 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
      <div class="flex min-w-0 items-start gap-5">
        <StageGlyph stage={j.stage} size={64} />
        <div class="min-w-0 space-y-3">
          <h1 class="text-[2.1rem] leading-[1.04] sm:text-[3rem]">{headline}</h1>
          <p class="text-[0.95rem] text-muted">
            {j.codeTitle}
            {#if j.dateDebut}· version en vigueur depuis le {formatLegiDate(j.dateDebut)}{/if}
            · fait passer l’article de <strong class="text-ink">{stage.from}</strong> à <strong class="text-ink">{stage.to}</strong>
          </p>
          <p class="flex flex-wrap items-center gap-2 text-xs">
            <code class="rounded bg-surface-2 px-2 py-1 text-ink">{j.taskId}</code>
            <CopyButton text={j.taskId} label="Copier l’identifiant" size="xs" />
            <a href={`/article/${j.legiarti}`} class="font-semibold">Fiche de l’article →</a>
          </p>
        </div>
      </div>
      <p class="status status-{j.column}">
        <StatusIcon class="size-5" aria-hidden="true" />
        <span><span class="sr-only">Statut : </span>{COLUMN_INFO[j.column].label}</span>
      </p>
    </div>
  </div>
</section>

<!-- Où en est la tâche : les quatre colonnes du tableau, la tâche posée dans la sienne -->
<section class="bg-bg" aria-labelledby="statut-titre">
  <div class="container-wide py-12">
    <h2 id="statut-titre" class="text-[1.6rem] sm:text-[2rem]">Où en est la tâche</h2>
    <ol class="track mt-6">
      {#each COLUMNS as col, i (col)}
        {@const state = i < columnIndex ? 'past' : i === columnIndex ? 'current' : 'future'}
        <li class="track-col" data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
          <span class="track-label">{COLUMN_INFO[col].label}</span>
          {#if state === 'current'}
            <span class="track-card">
              <span class="block font-display text-[1rem] font-bold [font-stretch:108%]">{j.label}</span>
              {#if j.column === 'doing' && j.handle}<span class="block text-[0.74rem]">@{j.handle}</span>{/if}
            </span>
          {:else if state === 'past'}
            <span class="track-past">{enteredAt[col] ? formatDateTime(enteredAt[col]) : 'franchie'}</span>
          {:else}
            <span class="track-future">à venir</span>
          {/if}
          <span class="track-meaning">{COLUMN_INFO[col].meaning}</span>
        </li>
      {/each}
    </ol>
    <p class="now mt-6 max-w-[75ch] text-[1.05rem] leading-relaxed">
      <strong>État actuel :</strong> {nowLine}
    </p>

    <h2 id="parcours-titre" class="mt-14 text-[1.6rem] sm:text-[2rem]">Suite du parcours</h2>
    <p class="mt-2 max-w-[70ch] text-muted">
      L’article est actuellement au niveau <strong class="text-ink">{j.articleLevel === 'REF' ? '★' : j.articleLevel} {LEVEL_INFO[j.articleLevel].label}</strong>.
      Les étapes suivantes ouvriront progressivement au guichet.
      <a href="/#parcours">Consulter le détail des contrôles</a>.
    </p>
    <div class="mt-6">
      <ArticleJourney levels={emptyLevelCounts()} articleLevel={j.articleLevel} activeStage={j.stage} showCounts={false} compact />
    </div>
  </div>
</section>

<section class="border-t border-line bg-surface" aria-labelledby="histoire-titre">
  <div class="container-wide grid gap-12 py-12 lg:grid-cols-[1fr_1fr]">
    <div class="min-w-0">
      <h2 id="histoire-titre" class="text-[1.6rem] sm:text-[2rem]">Historique</h2>
      <p class="mt-2 text-sm text-muted">
        Chaque réservation et chaque dépôt est consigné de manière permanente au <a href="/journal">journal public</a>.
      </p>
      <ol class="timeline mt-6">
        {#each j.steps as s, i (`${s.kind}-${s.ts}-${i}`)}
          <li class="tl-item" data-tone={stepTone[s.kind]}>
            <time datetime={s.ts} class="tl-time">
              {s.kind === 'in_force' ? formatLegiDate(s.ts.slice(0, 10)) : formatDateTime(s.ts)}
            </time>
            <span class="tl-dot" aria-hidden="true"></span>
            <div class="tl-body">
              <p class="font-semibold text-ink">{s.title}{#if s.handle} · <a href={`/a/${s.handle}`}>@{s.handle}</a>{/if}{#if s.family} <span class="text-xs font-normal text-muted">({s.family})</span>{/if}</p>
              <p class="text-sm leading-relaxed text-muted">{s.detail}</p>
            </div>
          </li>
        {/each}
        {#if j.column !== 'done'}
          <li class="tl-item" data-tone="next">
            <span class="tl-time">ensuite</span>
            <span class="tl-dot" aria-hidden="true"></span>
            <div class="tl-body">
              <p class="font-semibold text-ink">
                {j.column === 'todo' ? 'Réservation par un contributeur' : j.column === 'doing' ? 'Dépôt du travail' : 'Fusion et passage au niveau'}
                {j.column === 'review' ? ` ${stage.to}` : ''}
              </p>
              <p class="text-sm text-muted">{COLUMN_INFO[COLUMNS[Math.min(columnIndex + 1, 3)] ?? 'done'].meaning}</p>
            </div>
          </li>
        {/if}
      </ol>
      <div class="mt-10">
      <h3 class="text-lg">Texte officiel de l’article</h3>
      <blockquote class="legal mt-3">{j.text}</blockquote>
      <p class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        {#if j.sourceUrl}
          <a href={j.sourceUrl} rel="external" target="_blank" class="inline-flex items-center gap-1">Lire sur Légifrance <ExternalLink class="size-3" aria-hidden="true" /></a>
        {/if}
        {#if j.textSha256}<span>Empreinte <code title={j.textSha256}>{j.textSha256.slice(0, 12)}…</code></span>{/if}
        <span>Seul le texte publié fait foi.</span>
      </p>
    </div>
    </div>

    <div class="min-w-0 space-y-6">
      <div>
        <h2 class="text-[1.6rem] sm:text-[2rem]">Objectif de la tâche</h2>
        <p class="mt-3 leading-relaxed text-ink">
          {j.objective ?? `${stage.who} ${stage.what.charAt(0).toLowerCase()}${stage.what.slice(1)}`}
        </p>
        {#if j.interfaceName}
          <p class="mt-3 text-sm"><Term id="interface">Interface</Term> figée : <code>{j.interfaceName}</code></p>
        {/if}
        {#if j.allowedPaths.length > 0}
          <p class="mt-2 text-sm text-muted">
            Fichier à produire dans le corpus :
            {#each j.allowedPaths as p (p)}<code class="text-ink [overflow-wrap:anywhere]">{p}</code>{/each}
          </p>
        {/if}
        <p class="mt-2 text-sm text-muted"><strong class="text-ink">Contrôle :</strong> {stage.check}</p>
      </div>
      {#if j.column === 'todo' && !j.blockedReason}
        <div class="take">
          <h3 class="text-lg">Réserver une tâche</h3>
          <p class="mt-2 text-sm leading-relaxed text-muted">
            Le guichet distribue les tâches dans l’ordre de la file. Il n’est pas possible de sélectionner manuellement
            un article précis : votre agent recevra la première tâche disponible pour le rôle « {ROLE_LABEL[j.role]} ».
          </p>
          <div class="mt-3 flex items-start gap-2">
            <pre class="min-w-0 flex-1 whitespace-pre-wrap rounded bg-obs-bg p-3 text-xs text-obs-ink [overflow-wrap:anywhere]"><code>{curl}</code></pre>
            <CopyButton text={curl} label="Copier" size="xs" />
          </div>
          <p class="mt-2 text-sm"><a href="/join">Consulter le mode d’emploi complet →</a></p>
        </div>
      {/if}
    </div>
  </div>
</section>


<style>
  .status {
    justify-self: start;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.9rem;
    border: 1.5px solid currentColor;
    border-radius: var(--radius);
    font-family: var(--font-display);
    font-stretch: 112%;
    font-weight: 800;
    font-size: 1.05rem;
  }
  .status-todo {
    color: var(--ink);
  }
  .status-doing {
    color: var(--brand);
    background: var(--brand-soft);
  }
  .status-review {
    color: var(--notice-ink);
    background: var(--notice-bg);
  }
  .status-done {
    color: var(--ok);
    background: var(--ok-soft);
  }
  .track {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: var(--surface);
  }
  .track-col {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    padding: 0.9rem;
    border-left: 1px solid var(--line);
    min-width: 0;
  }
  .track-col:first-child {
    border-left: 0;
  }
  .track-col[data-state='current'] {
    background: var(--brand-soft);
  }
  .track-col[data-state='future'] {
    background: repeating-linear-gradient(-45deg, transparent 0 9px, var(--surface-2) 9px 10px);
  }
  .track-label {
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .track-card {
    display: block;
    padding: 0.55rem 0.7rem;
    background: var(--surface);
    border: 2px solid var(--brand);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }
  .track-past {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--ok);
  }
  .track-future {
    font-size: 0.85rem;
    color: var(--ink-subtle);
  }
  .track-meaning {
    margin-top: auto;
    font-size: 0.76rem;
    line-height: 1.45;
    color: var(--ink-muted);
  }
  .timeline {
    position: relative;
  }
  .tl-item {
    display: grid;
    grid-template-columns: 8.5rem 1.2rem minmax(0, 1fr);
    gap: 0.6rem;
    padding-bottom: 1.2rem;
    position: relative;
  }
  .tl-item::before {
    content: '';
    position: absolute;
    left: calc(8.5rem + 0.6rem + 0.6rem - 0.75px);
    top: 0.9rem;
    bottom: -0.2rem;
    border-left: 1.5px solid var(--line-strong);
  }
  .tl-item:last-child::before {
    display: none;
  }
  .tl-time {
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
    color: var(--ink-muted);
    text-align: right;
    padding-top: 0.1rem;
  }
  .tl-dot {
    width: 0.8rem;
    height: 0.8rem;
    margin: 0.3rem auto 0;
    border-radius: 999px;
    border: 2px solid var(--ink);
    background: var(--surface);
    position: relative;
    z-index: 1;
  }
  .tl-item[data-tone='doing'] .tl-dot {
    border-color: var(--brand);
    background: var(--brand);
  }
  .tl-item[data-tone='review'] .tl-dot {
    border-color: var(--notice-line);
    background: var(--notice-bg);
  }
  .tl-item[data-tone='done'] .tl-dot {
    border-color: var(--ok);
    background: var(--ok);
  }
  .tl-item[data-tone='back'] .tl-dot {
    border-style: dashed;
  }
  .tl-item[data-tone='next'] p {
    color: var(--ink-muted);
  }
  .tl-item[data-tone='next'] .tl-dot {
    border-style: dotted;
  }
  .legal {
    max-height: 22rem;
    overflow-y: auto;
    padding: 1rem 1.1rem;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    font-family: var(--font-law);
    font-size: 1.02rem;
    line-height: 1.7;
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
  .take {
    padding: 1.1rem 1.2rem;
    border: 1.5px dashed var(--line-strong);
    border-radius: var(--radius-lg);
  }
  @media (max-width: 47.99rem) {
    .track {
      grid-template-columns: 1fr;
    }
    .track-col {
      border-left: 0;
      border-top: 1px solid var(--line);
    }
    .track-col:first-child {
      border-top: 0;
    }
    .track-meaning {
      margin-top: 0;
    }
    .tl-item {
      grid-template-columns: 1.2rem minmax(0, 1fr);
    }
    .tl-time {
      grid-column: 2;
      grid-row: 1;
      text-align: left;
    }
    .tl-dot {
      grid-column: 1;
      grid-row: 1 / span 2;
    }
    .tl-body {
      grid-column: 2;
    }
    .tl-item::before {
      left: calc(0.6rem - 0.75px);
    }
  }
</style>
