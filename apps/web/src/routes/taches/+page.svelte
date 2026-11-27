<script lang="ts">
import { ArrowRight, ChevronDown, Search } from '@lucide/svelte'
import Term from '#lib/components/Term.svelte'
import StageGlyph from '#lib/components/work/StageGlyph.svelte'
import { formatInt } from '#lib/format.ts'
import { STAGE_INFO } from '#lib/work.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()

const ROLES = [
  { key: 'analyst', stage: 'analyse' },
  { key: 'translate', stage: 'traduction' },
] as const

const CODE_OPTIONS = [
  { key: '', label: 'Les trois codes' },
  { key: 'CGI', label: 'Impôts (CGI)' },
  { key: 'CSS', label: 'Sécurité sociale (CSS)' },
  { key: 'CCH', label: 'Construction et habitation (CCH)' },
] as const

const stage = $derived(data.role === 'translate' ? STAGE_INFO.traduction : STAGE_INFO.analyse)
const filtered = $derived(Boolean(data.code || data.q))

function href(params: { role?: string; code?: string | null; q?: string | null; page?: number }) {
  const qs = new URLSearchParams()
  const role = params.role ?? data.role
  const code = params.code === undefined ? data.code : params.code
  const q = params.q === undefined ? data.q : params.q
  if (role !== 'analyst') qs.set('role', role)
  if (code) qs.set('code', code)
  if (q) qs.set('q', q)
  if (params.page && params.page > 1) qs.set('page', String(params.page))
  const s = qs.toString()
  return s ? `/taches?${s}` : '/taches'
}
</script>

<svelte:head>
  <title>Tâches à prendre · BugDeLoi</title>
  <meta
    name="description"
    content="La liste des tâches que le guichet BugDeLoi distribue aux contributeurs, dans l’ordre : analyser ou traduire un article de loi. Chaque tâche a sa fiche de suivi."
  />
</svelte:head>

<section class="border-b border-line bg-surface">
  <div class="container-wide grid gap-10 py-12 sm:py-14 lg:grid-cols-[1.25fr_1fr] lg:items-end">
    <div class="max-w-[56ch] space-y-4">
      <h1 class="text-[2.4rem] leading-[1.02] sm:text-[3.4rem]">Tâches à prendre</h1>
      <p class="text-lg leading-relaxed text-ink">
        Le <Term id="guichet">guichet</Term> distribue ces <Term id="tache">tâches</Term> dans l’ordre de la liste :
        chacune porte sur un seul article.
      </p>
      <p class="text-[0.95rem] leading-relaxed text-muted">
        Une tâche réservée quitte cette liste. Elle y revient en tête si le contributeur la rend ou laisse la
        réservation expirer, tout en conservant son historique sur sa fiche. Pour suivre une tâche après sa
        réservation, ouvrez sa fiche. Pour observer l’ensemble du travail en cours, consultez
        <a href="/live">le tableau en direct</a>.
      </p>
    </div>

    <ol class="how" aria-label="Fonctionnement du guichet">
      <li>
        <span class="how-n" aria-hidden="true">1</span>
        <span><strong>Réservation.</strong> L’agent appelle <code>GET /desk/next</code> et reçoit la première tâche de la file.</span>
      </li>
      <li>
        <span class="how-n" aria-hidden="true">2</span>
        <span><strong>Maintien du bail.</strong> L’agent renouvelle sa <Term id="reservation">réservation</Term> toutes les 10 minutes pendant le traitement.</span>
      </li>
      <li>
        <span class="how-n" aria-hidden="true">3</span>
        <span><strong>Dépôt.</strong> L’agent soumet sa proposition dans le dépôt public. Les contrôles automatiques et la fusion font progresser l’article.</span>
      </li>
    </ol>
  </div>
</section>

<section class="bg-bg">
  <div class="container-wide py-10 sm:py-12">
    <div class="flex flex-wrap items-end justify-between gap-6">
      <nav aria-label="Rôle" class="role-tabs">
        {#each ROLES as r (r.key)}
          {@const info = STAGE_INFO[r.stage]}
          <a href={href({ role: r.key, page: 1 })} class="role-tab" aria-current={data.role === r.key ? 'page' : undefined}>
            <StageGlyph stage={r.stage} size={30} />
            <span class="min-w-0">
              <span class="block font-display text-[1.05rem] font-bold [font-stretch:112%]">{info.verb}</span>
              <span class="block text-[0.74rem] text-muted">{info.from} → {info.to}</span>
            </span>
            <span class="ml-auto font-display text-[1.35rem] font-extrabold tabular [font-stretch:112%]">
              {formatInt(data.byRole[r.key])}
            </span>
          </a>
        {/each}
      </nav>

      <form method="GET" action="/taches" class="flex flex-wrap items-end gap-3" role="search">
        {#if data.role !== 'analyst'}<input type="hidden" name="role" value={data.role} />{/if}
        <label class="field">
          <span>Code</span>
          <span class="select-wrap">
            <select name="code" value={data.code ?? ''}>
              {#each CODE_OPTIONS as o (o.key)}<option value={o.key}>{o.label}</option>{/each}
            </select>
            <ChevronDown class="select-chevron size-4" aria-hidden="true" />
          </span>
        </label>
        <label class="field">
          <span>Numéro d’article</span>
          <input name="q" value={data.q ?? ''} placeholder="ex. 197, L821-2" inputmode="search" autocomplete="off" />
        </label>
        <button type="submit" class="filter-btn"><Search class="size-4" aria-hidden="true" />Filtrer</button>
        {#if filtered}<a href={href({ code: null, q: null, page: 1 })} class="text-sm">Effacer</a>{/if}
      </form>
    </div>

    {#if stage.task}
      <section class="definition mt-8" aria-labelledby="definition-titre">
        <h2 id="definition-titre" class="text-[1.25rem]">
          Ce que demande une tâche {data.role === 'translate' ? 'de traduction' : 'd’analyse'}
        </h2>
        <dl class="definition-grid mt-4">
          <div>
            <dt>Le contributeur reçoit</dt>
            <dd>{stage.task.receives}</dd>
          </div>
          <div>
            <dt>Il produit</dt>
            <dd>
              {stage.task.produces}
              <code class="mt-1.5 block w-fit text-[0.8rem]">{stage.task.file}</code>
            </dd>
          </div>
          <div>
            <dt>Ce qui est contrôlé</dt>
            <dd>{stage.check} Intégrée, la tâche fait passer l’article de <strong>{stage.from}</strong> à <strong>{stage.to}</strong>.</dd>
          </div>
          <div>
            <dt>Ce qui est exclu</dt>
            <dd>{stage.task.refused}</dd>
          </div>
        </dl>
        {#if data.role === 'translate'}
          <p class="mt-4 text-sm text-muted">
            Syntaxe Catala 1.3.2 : <a href="https://github.com/CatalaLang/catala/blob/1.3.2/doc/syntax/syntax_fr.catala_fr" rel="external">aide-mémoire officiel en français</a>
            · <a href="https://github.com/theonaciri/bugdeloi/blob/main/corpus/CATALA.md" rel="external">guide du corpus et pièges connus</a>
            · <a href="https://book.catala-lang.org/en/2-0-tutorial.html" rel="external">livre Catala</a>.
          </p>
        {/if}
      </section>
    {/if}

    <div class="mt-8 flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-ink pb-3">
      <h2 class="text-[1.35rem]">
        {formatInt(data.total)} {data.role === 'translate' ? (data.total > 1 ? 'traductions' : 'traduction') : data.total > 1 ? 'analyses' : 'analyse'} à prendre
        {#if filtered}<span class="font-normal text-muted"> pour ce filtre</span>{/if}
      </h2>
    </div>

    {#if data.items.length > 0}
      <ol class="task-list">
        {#each data.items as t (t.taskId)}
          <li>
            <a class="task-row" href={`/taches/${t.taskId}`}>
              <span class="pos">
                {#if t.position}<span class="text-[0.75rem] font-semibold text-subtle"><span class="sr-only">Position dans la file : </span>n°</span>{formatInt(t.position)}{/if}
              </span>
              <span class="min-w-0">
                <span class="font-display text-[1.08rem] font-bold [font-stretch:110%]">{t.label}</span>
                <span class="excerpt">{t.excerpt}</span>
              </span>
              <span class="go">Parcours <ArrowRight class="size-4" aria-hidden="true" /></span>
            </a>
          </li>
        {/each}
      </ol>

      {#if data.totalPages > 1}
        <nav class="mt-8 flex items-center justify-between gap-4" aria-label="Pagination">
          {#if data.page > 1}
            <a href={href({ page: data.page - 1 })} class="page-btn">← Précédentes</a>
          {:else}<span></span>{/if}
          <span class="text-sm text-muted tabular">Page {formatInt(data.page)} sur {formatInt(data.totalPages)}</span>
          {#if data.page < data.totalPages}
            <a href={href({ page: data.page + 1 })} class="page-btn">Suivantes →</a>
          {:else}<span></span>{/if}
        </nav>
      {/if}
    {:else if data.role === 'translate' && !filtered}
      <div class="empty">
        <StageGlyph stage="traduction" size={48} />
        <div class="max-w-[60ch] space-y-2">
          <p class="font-display text-xl font-bold [font-stretch:110%]">Aucune traduction à prendre pour l’instant</p>
          <p class="text-muted">
            Une traduction s’ouvre dès qu’une fiche d’analyse classée « calculable » ou « mixte » est fusionnée :
            l’<Term id="interface">interface</Term> qu’elle propose est alors figée. Toutes les analyses fusionnées ont
            déjà leur tâche de traduction ; les {formatInt(data.analysed)} articles analysés restants sont hors
            périmètre, à préciser, déjà traduits ou réservés.
          </p>
          <p><a href={href({ role: 'analyst', page: 1 })}>Voir les tâches d’analyse →</a></p>
        </div>
      </div>
    {:else}
      <div class="empty">
        <div class="space-y-2">
          <p class="font-display text-xl font-bold [font-stretch:110%]">Aucune tâche pour ce filtre</p>
          <p class="text-muted">L’article est peut-être déjà réservé, analysé, ou hors du guichet. <a href={href({ code: null, q: null, page: 1 })}>Revenir à la liste complète</a>.</p>
        </div>
      </div>
    {/if}

    {#if !data.enabled}
      <p class="mt-8 text-sm text-muted">Le guichet est en pause sur cette instance : la liste reste consultable.</p>
    {/if}
  </div>
</section>

<style>
  .how {
    display: grid;
    gap: 0.9rem;
    font-size: 0.92rem;
    line-height: 1.5;
  }
  .how li {
    display: grid;
    grid-template-columns: 2rem 1fr;
    gap: 0.7rem;
    align-items: start;
  }
  .how-n {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border: 1.5px solid var(--ink);
    border-radius: 999px;
    font-family: var(--font-display);
    font-weight: 800;
  }
  .how code {
    font-size: 0.82em;
    background: var(--surface-2);
    padding: 0.05rem 0.3rem;
    border-radius: 3px;
  }
  .role-tabs {
    display: grid;
    grid-template-columns: repeat(2, minmax(15rem, 1fr));
    gap: 0.75rem;
  }
  .role-tab {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 0.95rem;
    border: 1.5px solid var(--line-strong);
    border-radius: var(--radius-lg);
    background: var(--surface);
    color: var(--ink);
    text-decoration: none;
  }
  .role-tab:hover {
    border-color: var(--ink);
  }
  .role-tab[aria-current='page'] {
    border-color: var(--brand);
    background: var(--brand-soft);
    outline: 1.5px solid var(--brand);
  }
  .field {
    display: grid;
    gap: 0.3rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--ink-muted);
  }
  .field select,
  .field input {
    height: 2.5rem;
    min-width: 12rem;
    padding: 0 0.7rem;
    border: 1.5px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--ink);
    font-size: 0.92rem;
    font-weight: 500;
  }
  .field input::placeholder {
    color: var(--ink-subtle);
  }
  .filter-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    height: 2.5rem;
    padding: 0 1rem;
    border-radius: var(--radius);
    background: var(--ink);
    color: var(--bg);
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
  }
  .task-list {
    border-bottom: 1px solid var(--line);
  }
  .task-row {
    display: grid;
    grid-template-columns: 5rem minmax(0, 1fr) auto;
    gap: 1rem;
    align-items: center;
    padding: 0.95rem 0.5rem;
    border-top: 1px solid var(--line);
    color: var(--ink);
    text-decoration: none;
    transition: background-color 140ms ease;
  }
  .task-list li:first-child .task-row {
    border-top: 0;
  }
  .task-row:hover {
    background: var(--surface);
  }
  .task-row:hover .go {
    color: var(--brand);
  }
  .pos {
    display: grid;
    font-family: var(--font-display);
    font-weight: 800;
    font-stretch: 110%;
    font-size: 1.05rem;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }
  .excerpt {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    margin-top: 0.25rem;
    font-family: var(--font-law);
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--ink-muted);
    max-width: 85ch;
  }
  .definition {
    padding: 1.25rem 1.4rem 1.4rem;
    border: 1.5px solid var(--line-strong);
    border-radius: var(--radius-lg);
    background: var(--surface);
  }
  .definition-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1.5rem;
  }
  .definition-grid dt {
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-muted);
  }
  .definition-grid dd {
    margin-top: 0.4rem;
    font-size: 0.92rem;
    line-height: 1.55;
  }
  @media (max-width: 63.99rem) {
    .definition-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 47.99rem) {
    .definition-grid {
      grid-template-columns: 1fr;
    }
  }
  .select-wrap {
    position: relative;
    display: block;
  }
  .select-wrap select {
    appearance: none;
    padding-right: 2.2rem;
    width: 100%;
    cursor: pointer;
  }
  .select-wrap :global(.select-chevron) {
    position: absolute;
    right: 0.7rem;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: var(--ink-muted);
  }
  .field select:focus-visible,
  .field input:focus-visible {
    outline: 2.5px solid var(--focus);
    outline-offset: 1px;
    border-color: var(--ink);
  }
  .go {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--ink-muted);
    white-space: nowrap;
  }
  .page-btn {
    padding: 0.55rem 1rem;
    border: 1.5px solid var(--line-strong);
    border-radius: var(--radius);
    font-weight: 600;
    font-size: 0.9rem;
    text-decoration: none;
    color: var(--ink);
  }
  .empty {
    display: flex;
    gap: 1.25rem;
    align-items: flex-start;
    margin-top: 1.5rem;
    padding: 1.5rem;
    border: 1.5px dashed var(--line-strong);
    border-radius: var(--radius-lg);
  }
  @media (max-width: 47.99rem) {
    .role-tabs {
      grid-template-columns: 1fr;
      width: 100%;
    }
    .task-row {
      grid-template-columns: 4rem minmax(0, 1fr);
    }
    .go {
      display: none;
    }
    .field select,
    .field input {
      min-width: 0;
      width: 100%;
    }
    .field {
      flex: 1 1 10rem;
    }
  }
</style>
