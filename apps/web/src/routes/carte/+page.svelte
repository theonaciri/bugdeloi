<script lang="ts">
import EmptyState from '#lib/components/EmptyState.svelte'
import LevelLegend from '#lib/components/LevelLegend.svelte'
import MapTreeList from '#lib/components/MapTreeList.svelte'
import Treemap from '#lib/components/Treemap.svelte'
import { formatInt, plural } from '#lib/format.ts'
import { describeCounts, totalOf } from '#lib/levels.ts'
import { buildMapTree } from '#lib/map-tree.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()
const map = $derived(data.map)
const tree = $derived(buildMapTree(map.focus, map.sections, map.counts, map.articles))
const total = $derived(totalOf(tree.counts))
</script>

<svelte:head>
  <title>{map.focus.isRoot ? `Carte du ${map.code}` : map.focus.title} · Carte · BugDeLoi</title>
  <meta name="description" content="Carte des articles en vigueur du {map.codeTitle}, colorée par niveau de preuve." />
</svelte:head>

<div class="container-page mt-8">
  <h1 class="text-3xl font-semibold">Carte des codes</h1>
  <p class="mt-2 max-w-3xl text-muted">
    Chaque tuile est une section ou un article ; sa surface est proportionnelle au nombre d’articles en vigueur, sa
    couleur et son motif indiquent le niveau de preuve. Cliquer sur une tuile descend dans la section.
  </p>

  <nav aria-label="Choix du code" class="mt-6">
    <ul class="flex flex-wrap gap-2">
      {#each data.codes as c (c.key)}
        <li>
          <a
            href="/carte?code={c.key}"
            aria-current={map.code === c.key ? 'page' : undefined}
            class="block rounded-full border border-line px-4 py-1.5 font-semibold no-underline hover:bg-surface-2 aria-[current=page]:border-brand aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-strong"
            title={c.title}
          >
            {c.key}
          </a>
        </li>
      {/each}
    </ul>
  </nav>

  <nav aria-label="Fil d’Ariane" class="mt-4 text-sm">
    <ol class="flex flex-wrap items-center gap-x-1 gap-y-1">
      <li><a href="/carte?code={map.code}">{map.codeTitle}</a></li>
      {#each map.crumbs as c (c.id)}
        <li class="flex items-center gap-1"><span aria-hidden="true" class="text-muted">›</span><a href="/carte?code={map.code}&s={c.id}">{c.title}</a></li>
      {/each}
      {#if !map.focus.isRoot}
        <li class="flex items-center gap-1"><span aria-hidden="true" class="text-muted">›</span><span aria-current="page" class="font-semibold">{map.focus.title}</span></li>
      {/if}
    </ol>
  </nav>

  {#if !map.ingested}
    <div class="mt-6">
      <EmptyState title="Ce code n’est pas encore ingéré.">
        La carte apparaîtra quand le texte officiel du {map.codeTitle} aura été chargé depuis la base LEGI de la DILA
        (jalon J1). Nous ne dessinons pas de carte inventée.
      </EmptyState>
    </div>
  {:else}
    <p class="mt-4">
      <strong>{map.focus.isRoot ? map.codeTitle : map.focus.title}</strong> :
      {plural(total, 'article en vigueur', 'articles en vigueur')}{total > 0 ? ` (${describeCounts(tree.counts)})` : ''}.
    </p>
    {#if map.outsideTree > 0}
      <p class="mt-1 text-sm text-muted">
        S’y ajoutent {plural(map.outsideTree, 'article en vigueur rattaché', 'articles en vigueur rattachés')} à aucune section
        dans LEGI : ils sont comptés sur l’accueil mais n’apparaissent pas sur la carte.
      </p>
    {/if}
    {#if map.truncated}
      <p class="mt-2 text-sm font-semibold">
        Seuls les {formatInt(map.articles.length)} premiers articles de cette section sont affichés.
      </p>
    {/if}

    <div class="mt-4 grid gap-6 lg:grid-cols-[1fr_17rem]">
      <figure>
        {#if total === 0}
          <EmptyState title="Aucun article en vigueur dans cette section." />
        {:else}
          <Treemap root={tree} code={map.code} />
        {/if}
        <figcaption class="mt-2 text-sm text-muted">
          Version visuelle. La même information est disponible <a href="#liste">sous forme de liste navigable au
            clavier</a>.
        </figcaption>
      </figure>
      <aside aria-labelledby="legende">
        <h2 id="legende" class="text-lg font-semibold">Légende</h2>
        <div class="mt-2"><LevelLegend compact /></div>
        <p class="mt-3 text-sm text-muted">
          Une tuile de section est découpée en bandes selon la part de chaque niveau. Un cadre pointillé orange signale
          un article contesté. <a href="/methode#niveaux">Ce que garantit chaque niveau</a>
        </p>
      </aside>
    </div>

    <section id="liste" class="mt-10" aria-labelledby="liste-titre">
      <h2 id="liste-titre" class="text-2xl font-semibold">Liste des sections et articles</h2>
      <p class="mb-3 mt-1 text-sm text-muted">
        Flèches haut et bas pour se déplacer, flèche droite pour déplier, flèche gauche pour replier, Entrée pour
        ouvrir.
      </p>
      <MapTreeList root={tree} code={map.code} label="Sections et articles de {map.focus.title}" />
    </section>
  {/if}
</div>
