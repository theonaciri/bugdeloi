<script lang="ts">
import { plural } from '#lib/format.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()
</script>

<svelte:head><title>Articles de référence ★ — BugDeLoi</title></svelte:head>

<section class="container-page pt-8 sm:pt-12">
  <h1 class="text-4xl font-semibold">Articles de référence ★</h1>
  <p class="mt-3 max-w-[65ch]">
    Ces articles en vigueur figurent dans les fichiers de programmes de chercheurs ou d’une administration dont BugDeLoi a relancé les tests avec succès.
    <a href="/methode#compteur-avancement">Méthode</a>
  </p>
  <p class="mt-4"><strong>{plural(data.articles.length, 'article')}</strong>{#if data.exclude} · <a href="/references">Inclure l’exemple de l’accueil</a>{/if}</p>
  <ul class="mt-4 divide-y divide-line border-y border-line">
    {#each data.articles as article (article.id)}
      <li class="py-2"><a href={`/article/${article.id}`}>Article {article.num ?? 'sans numéro'} du {article.code}</a></li>
    {/each}
  </ul>
</section>
