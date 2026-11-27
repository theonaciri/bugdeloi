<script lang="ts">
import EmptyState from '#lib/components/EmptyState.svelte'
import LevelLegend from '#lib/components/LevelLegend.svelte'
import MapTreeList from '#lib/components/MapTreeList.svelte'
import Treemap from '#lib/components/Treemap.svelte'
import { formatInt, plural } from '#lib/format.ts'
import { LEVELS, levelName, totalOf } from '#lib/levels.ts'
import { buildMapTree } from '#lib/map-tree.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()
const map = $derived(data.map)
const tree = $derived(buildMapTree(map.focus, map.sections, map.counts, map.articles))
const total = $derived(totalOf(tree.counts))
const breakdown = $derived(
  LEVELS.filter((level) => tree.counts[level] > 0)
    .map((level) => `${formatInt(tree.counts[level])} · ${levelName(level)}`)
    .join(', '),
)
</script>

<svelte:head>
  <title>{map.focus.isRoot ? `Carte du ${map.codeTitle}` : map.focus.title} · Carte · BugDeLoi</title>
  <meta name="description" content="Explorez les articles en vigueur, chapitre par chapitre, et découvrez où en sont les vérifications." />
</svelte:head>

<header class="bg-bg">
  <div class="container-wide space-y-6 py-12 sm:py-16">
    <h1 class="text-4xl tracking-tight sm:text-5xl">Explorer les codes de la loi</h1>
    <p class="max-w-3xl font-display text-xl leading-relaxed text-ink/90">
      Chaque rectangle représente un chapitre, une section ou un article. Plus un chapitre contient d’articles en
      vigueur, plus son rectangle est grand. Les couleurs et les motifs indiquent où en sont les vérifications.
      L’étoile signale un article couvert par un programme indépendant dont les tests réussissent chez nous.
      Cliquez sur un chapitre pour zoomer, ou sur un article pour le lire.
    </p>

    <nav aria-label="Choix du code">
      <ul class="flex flex-wrap gap-2">
        {#each data.codes as c (c.key)}
          <li>
            <a
              href="/carte?code={c.key}"
              aria-current={map.code === c.key ? 'page' : undefined}
              title={c.title}
              class="block rounded-[var(--radius)] border border-line px-4 py-2 text-sm font-semibold text-ink no-underline hover:bg-surface-2 aria-[current=page]:border-brand aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-strong"
            >
              {c.title}
            </a>
          </li>
        {/each}
      </ul>
    </nav>

    <nav aria-label="Fil d’Ariane" class="border-t border-line pt-4 text-sm">
      <ol class="flex flex-wrap items-center gap-x-2 gap-y-1">
        {#if map.focus.isRoot}
          <li aria-current="page" class="font-semibold">{map.codeTitle}</li>
        {:else}
          <li><a href="/carte?code={map.code}">{map.codeTitle}</a></li>
          {#each map.crumbs as c (c.id)}
            <li class="flex items-baseline gap-2"><span aria-hidden="true" class="text-muted">›</span><a href="/carte?code={map.code}&s={c.id}">{c.title}</a></li>
          {/each}
          <li class="flex items-baseline gap-2"><span aria-hidden="true" class="text-muted">›</span><span aria-current="page" class="font-semibold">{map.focus.title}</span></li>
        {/if}
      </ol>
    </nav>
  </div>
</header>

<section class="border-t border-line bg-surface" aria-labelledby="carte-titre">
  <div class="container-wide space-y-6 py-10 sm:py-14">
    <div class="max-w-3xl space-y-2">
      <h2 id="carte-titre" class="text-2xl sm:text-3xl">{map.focus.title}</h2>
      {#if map.ingested}
        <p><strong>{plural(total, 'article en vigueur', 'articles en vigueur')}</strong> sur la carte.</p>
        {#if total > 0}
          <p class="text-sm text-muted">{breakdown}</p>
        {/if}
        {#if map.outsideTree > 0}
          <p class="text-sm leading-relaxed text-muted">
            {#if map.outsideTree === 1}
              Un autre article en vigueur n’est rattaché à aucun chapitre dans les fichiers officiels. Il est inclus dans
              le total de l’accueil, mais ne peut pas être placé sur la carte.
            {:else}
              S’y ajoutent {formatInt(map.outsideTree)} articles en vigueur qui ne sont rattachés à aucun chapitre
              dans les fichiers officiels. Ils sont inclus dans le total de l’accueil, mais ne peuvent pas être placés sur la carte.
            {/if}
          </p>
        {/if}
        {#if map.truncated}
          <p class="text-sm text-muted">
            L’affichage est limité aux {formatInt(map.articles.length)} premiers articles rattachés directement à cette section.
          </p>
        {/if}
      {/if}
    </div>

    {#if !map.ingested}
      <EmptyState title="La carte de ce code n’est pas encore disponible.">
        Elle apparaîtra quand ses articles auront été chargés depuis les archives officielles de Légifrance.
      </EmptyState>
    {:else if total === 0}
      <EmptyState title="Aucun article en vigueur à afficher ici." />
    {:else}
      <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <figure class="min-w-0">
          <Treemap root={tree} code={map.code} />
          <figcaption class="mt-3 text-sm text-muted">
            Vous pouvez aussi <a href="#liste">parcourir la carte sous forme de liste accessible au clavier</a>.
          </figcaption>
        </figure>
        <aside class="space-y-4 border-t border-line pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0" aria-labelledby="legende">
          <h3 id="legende" class="text-xl">Lire la légende</h3>
          <LevelLegend compact />
          <p class="text-sm leading-relaxed text-muted">
            Les bandes colorées ou hachurées montrent la part des articles à chaque niveau de vérification.
            Un contour orange en pointillés signale une objection en cours d’examen.
          </p>
          <p class="text-sm"><a href="/methode#niveaux">Comprendre les niveaux de vérification</a></p>
        </aside>
      </div>
    {/if}
  </div>
</section>

{#if map.ingested}
  <section id="liste" class="border-t border-line bg-bg" aria-labelledby="liste-titre">
    <div class="container-wide space-y-4 py-12 sm:py-16">
      <h2 id="liste-titre" class="text-2xl sm:text-3xl">Parcourir par chapitre et par article</h2>
      <p class="max-w-3xl leading-relaxed text-muted">
        Utilisez les flèches haut et bas pour parcourir la liste. La flèche droite déplie une section, la flèche
        gauche la replie. Appuyez sur Entrée pour ouvrir la section ou lire l’article sélectionné.
      </p>
      <MapTreeList root={tree} code={map.code} label="Sections et articles de {map.focus.title}" />
    </div>
  </section>
{/if}
