<script lang="ts">
import { CODES } from '@bugdeloi/core'
import LevelBadge from '#lib/components/LevelBadge.svelte'

const CODE_KEYS = Object.keys(CODES) as Array<keyof typeof CODES>
const CATEGORY_LIST = [
  { key: 'calculable', label: 'Calculable' },
  { key: 'mixte', label: 'Mixte (calculable + appréciation / hors périmètre)' },
  { key: 'hors_perimetre', label: 'Hors périmètre' },
  { key: 'autre', label: 'À préciser' },
] as const

const CATEGORY_LABEL: Record<string, string> = {
  calculable: 'Calculable',
  mixte: 'Mixte',
  hors_perimetre: 'Hors périmètre',
  autre: 'À préciser',
}

import { formatInt } from '#lib/format.ts'
import { LEVELS, levelName } from '#lib/levels.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()

function hrefFor(params: { niveau?: string; categorie?: string; code?: string; page?: number }) {
  const n = params.niveau ?? data.niveau
  const cat = params.categorie ?? (n === 'analyses' ? data.categorie : 'all')
  const c = params.code ?? data.code
  const p = params.page ?? 1
  const qs = new URLSearchParams()
  qs.set('niveau', n)
  if (n === 'analyses' && cat !== 'all') qs.set('categorie', cat)
  if (c !== 'all') qs.set('code', c)
  if (p > 1) qs.set('page', String(p))
  return `/travail?${qs.toString()}`
}
</script>

<svelte:head>
  <title>Parcourir le travail par niveau de preuve · BugDeLoi</title>
  <meta
    name="description"
    content="Explorez tous les articles de loi en vigueur filtrés par niveau de preuve (N0 à N5 et ★ Référence) et par code."
  />
</svelte:head>

<section class="bg-bg">
  <div class="container-wide py-12 sm:py-16">
    <h1 class="max-w-4xl font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
      Parcourir le travail par niveau de preuve
    </h1>
    <p class="mt-4 max-w-[68ch] text-lg leading-relaxed text-muted">
      Filtrez les articles en vigueur par niveau de preuve (de N0 texte brut jusqu’à N5 certifié, ainsi que les
      articles ★ Référence) et par code pour consulter directement chaque fiche et son code Catala.
    </p>

    <!-- Filtres par niveau de preuve -->
    <div class="mt-8 space-y-4">
      <div class="flex flex-wrap items-center gap-2" role="navigation" aria-label="Filtrer par niveau de preuve">
        <a
          href={hrefFor({ niveau: 'formalises', page: 1 })}
          aria-current={data.niveau === 'formalises' ? 'page' : undefined}
          class="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium no-underline transition hover:border-brand aria-[current=page]:border-brand aria-[current=page]:bg-brand-soft aria-[current=page]:font-semibold aria-[current=page]:text-brand-strong"
        >
          <span>Formalisés (N1–N5 + ★)</span>
          <span class="text-xs tabular text-muted">{formatInt(data.formalisesTotal)}</span>
        </a>
        <a
          href={hrefFor({ niveau: 'analyses', categorie: 'all', page: 1 })}
          aria-current={data.niveau === 'analyses' ? 'page' : undefined}
          class="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium no-underline transition hover:border-brand aria-[current=page]:border-brand aria-[current=page]:bg-brand-soft aria-[current=page]:font-semibold aria-[current=page]:text-brand-strong"
        >
          <span>Analyses (détail N1)</span>
          <span class="text-xs tabular text-muted">{formatInt(data.analysesTotal)}</span>
        </a>
        {#each LEVELS as lvl (lvl)}
          <a
            href={hrefFor({ niveau: lvl, page: 1 })}
            aria-current={data.niveau === lvl ? 'page' : undefined}
            class="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium no-underline transition hover:border-brand aria-[current=page]:border-brand aria-[current=page]:bg-brand-soft aria-[current=page]:font-semibold aria-[current=page]:text-brand-strong"
          >
            <span>{levelName(lvl)}</span>
            <span class="text-xs tabular text-muted">{formatInt(data.counts[lvl])}</span>
          </a>
        {/each}
        <a
          href={hrefFor({ niveau: 'all', page: 1 })}
          aria-current={data.niveau === 'all' ? 'page' : undefined}
          class="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium no-underline transition hover:border-brand aria-[current=page]:border-brand aria-[current=page]:bg-brand-soft aria-[current=page]:font-semibold aria-[current=page]:text-brand-strong"
        >
          <span>Tous</span>
          <span class="text-xs tabular text-muted">{formatInt(data.allTotal)}</span>
        </a>
      </div>

      <!-- Sous-filtres par catégorie d'analyse -->
      {#if data.niveau === 'analyses'}
        <div class="flex flex-wrap items-center gap-2" role="navigation" aria-label="Filtrer par catégorie d'analyse">
          <a
            href={hrefFor({ niveau: 'analyses', categorie: 'all', page: 1 })}
            aria-current={data.categorie === 'all' ? 'page' : undefined}
            class="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-medium no-underline hover:border-brand aria-[current=page]:border-brand aria-[current=page]:bg-brand-soft aria-[current=page]:font-semibold aria-[current=page]:text-brand-strong"
          >
            <span>Toutes les analyses</span>
            <span class="tabular text-muted">{formatInt(data.analysesTotal)}</span>
          </a>
          {#each CATEGORY_LIST as cat (cat.key)}
            <a
              href={hrefFor({ niveau: 'analyses', categorie: cat.key, page: 1 })}
              aria-current={data.categorie === cat.key ? 'page' : undefined}
              class="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-medium no-underline hover:border-brand aria-[current=page]:border-brand aria-[current=page]:bg-brand-soft aria-[current=page]:font-semibold aria-[current=page]:text-brand-strong"
            >
              <span>{cat.label}</span>
              <span class="tabular text-muted">{formatInt(data.analysesByCategory[cat.key])}</span>
            </a>
          {/each}
        </div>
      {/if}

      <!-- Filtres par code -->
      <div class="flex flex-wrap items-center gap-2" role="navigation" aria-label="Filtrer par code">
        <a
          href={hrefFor({ code: 'all', page: 1 })}
          aria-current={data.code === 'all' ? 'page' : undefined}
          class="rounded-full border border-line px-3.5 py-1.5 text-xs font-medium no-underline hover:border-brand aria-[current=page]:border-brand aria-[current=page]:bg-surface aria-[current=page]:font-semibold aria-[current=page]:text-ink"
        >
          Tous les codes
        </a>
        {#each CODE_KEYS as key (key)}
          <a
            href={hrefFor({ code: key, page: 1 })}
            aria-current={data.code === key ? 'page' : undefined}
            class="rounded-full border border-line px-3.5 py-1.5 text-xs font-medium no-underline hover:border-brand aria-[current=page]:border-brand aria-[current=page]:bg-surface aria-[current=page]:font-semibold aria-[current=page]:text-ink"
          >
            {CODES[key].title}
          </a>
        {/each}
      </div>
    </div>
  </div>
</section>

<section class="border-t border-line bg-surface">
  <div class="container-wide py-12 sm:py-16">
    <div class="flex flex-wrap items-baseline justify-between gap-4">
      <p class="text-sm text-muted">
        <strong class="font-semibold text-ink tabular">{formatInt(data.totalMatching)}</strong>
        article{data.totalMatching > 1 ? 's' : ''} trouvé{data.totalMatching > 1 ? 's' : ''}
        {#if data.totalPages > 1}
          · page {data.page} / {data.totalPages}
        {/if}
      </p>
      <a href="/methode" class="text-sm font-semibold text-brand-strong no-underline hover:underline">
        Comprendre les niveaux N0 à N5 →
      </a>
    </div>

    {#if data.niveau === 'analyses' && data.analysesItems.length > 0}
      <div class="mt-6 overflow-x-auto rounded-xl border border-line bg-bg">
        <table class="w-full min-w-[44rem] border-collapse text-left text-sm">
          <thead>
            <tr class="border-b border-line bg-surface text-xs uppercase tracking-wide text-muted">
              <th scope="col" class="px-4 py-3 font-semibold">Catégorie</th>
              <th scope="col" class="px-4 py-3 font-semibold">Article</th>
              <th scope="col" class="px-4 py-3 font-semibold">Interface proposée</th>
              <th scope="col" class="px-4 py-3 font-semibold">LEGIARTI</th>
              <th scope="col" class="px-4 py-3 font-semibold">Fiche d’analyse</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            {#each data.analysesItems as entry (entry.id)}
              <tr>
                <td class="px-4 py-3">
                  <span class="inline-block rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-ink">
                    {CATEGORY_LABEL[entry.category] ?? entry.category}
                  </span>
                </td>
                <td class="px-4 py-3 font-semibold text-ink">
                  <a href="/article/{entry.id}" class="text-brand-strong no-underline hover:underline">
                    {entry.title}
                  </a>
                </td>
                <td class="px-4 py-3 font-mono text-xs text-muted">
                  {entry.interfaceName ?? 'Aucune'}
                </td>
                <td class="px-4 py-3 font-mono text-xs text-muted">{entry.id}</td>
                <td class="px-4 py-3 text-xs">
                  <a
                    href="https://github.com/theonaciri/bugdeloi/blob/main/{entry.file}"
                    rel="external"
                    class="font-mono text-brand-strong no-underline hover:underline"
                  >
                    {entry.file} →
                  </a>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else if data.items.length > 0}
      <div class="mt-6 overflow-x-auto rounded-xl border border-line bg-bg">
        <table class="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead>
            <tr class="border-b border-line bg-surface text-xs uppercase tracking-wide text-muted">
              <th scope="col" class="px-4 py-3 font-semibold">Niveau</th>
              <th scope="col" class="px-4 py-3 font-semibold">Article</th>
              <th scope="col" class="px-4 py-3 font-semibold">Code</th>
              <th scope="col" class="px-4 py-3 font-semibold">LEGIARTI</th>
              <th scope="col" class="px-4 py-3 font-semibold">Code Catala</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            {#each data.items as item (item.id)}
              <tr>
                <td class="px-4 py-3">
                  <LevelBadge level={item.level} />
                </td>
                <td class="px-4 py-3 font-semibold text-ink">
                  <a href="/article/{item.id}" class="text-brand-strong no-underline hover:underline">
                    Article {item.num ?? item.id}
                  </a>
                </td>
                <td class="px-4 py-3 text-muted">{item.codeTitle}</td>
                <td class="px-4 py-3 font-mono text-xs text-muted">{item.id}</td>
                <td class="px-4 py-3 text-xs">
                  {#if item.catalaFile}
                    <a
                      href="https://github.com/theonaciri/bugdeloi/blob/main/{item.catalaFile}"
                      rel="external"
                      class="font-mono text-brand-strong no-underline hover:underline"
                    >
                      {item.catalaFile} →
                    </a>
                  {:else if item.level === 'REF'}
                    <a href="/references" class="text-muted no-underline hover:underline">Source Inria ★ →</a>
                  {:else}
                    <span class="text-muted">Non formalisé</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      {#if data.totalPages > 1}
        <nav aria-label="Pagination" class="mt-6 flex items-center justify-between text-sm">
          <div>
            {#if data.page > 1}
              <a
                href={hrefFor({ page: data.page - 1 })}
                class="rounded-full border border-line bg-bg px-4 py-2 font-semibold no-underline hover:border-brand"
              >
                ← Page précédente
              </a>
            {/if}
          </div>
          <span class="text-xs text-muted tabular">Page {data.page} sur {data.totalPages}</span>
          <div>
            {#if data.page < data.totalPages}
              <a
                href={hrefFor({ page: data.page + 1 })}
                class="rounded-full border border-line bg-bg px-4 py-2 font-semibold no-underline hover:border-brand"
              >
                Page suivante →
              </a>
            {/if}
          </div>
        </nav>
      {/if}
    {:else}
      <div class="mt-6 rounded-xl border border-line bg-bg p-8 text-center">
        <p class="font-serif text-lg font-semibold text-ink">Aucun article à ce niveau pour l’instant.</p>
        <p class="mt-2 text-sm text-muted">
          Chaque contribution communautaire fait progresser les articles de N0 vers N5.
        </p>
        <a
          href="/join"
          class="mt-4 inline-flex items-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white no-underline hover:bg-brand-strong"
        >
          Contribuer en Catala →
        </a>
      </div>
    {/if}
  </div>
</section>
