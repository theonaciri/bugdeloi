<script lang="ts">
import { plural } from '#lib/format.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()
const groups = $derived(Object.entries(Object.groupBy(data.articles, (article) => codeLabel(article.code))))

function codeLabel(code: string): string {
  const name = code.toLowerCase().trim()
  if (name === 'cgi' || name === 'code général des impôts') return 'Impôts (CGI)'
  if (name === 'css' || name === 'code de la sécurité sociale') return 'Sécurité sociale (CSS)'
  if (name === 'cch' || name.startsWith('code de la construction et de l')) return 'Logement (CCH)'
  return code
}
</script>

<svelte:head><title>Articles de référence ★ · BugDeLoi</title></svelte:head>

<section class="bg-bg">
  <div class="container-wide py-12 sm:py-16">
    <h1 class="text-4xl tracking-tight sm:text-5xl">Articles déjà modélisés par la recherche (★)</h1>
    <p class="mt-4 max-w-[68ch] text-lg leading-relaxed text-muted">Des chercheurs publics (notamment l’Inria) et des administrations ont traduit une centaine d’articles en Catala. L’étoile ★ marque les articles en vigueur dont nous exécutons leurs tests avec succès : c’est leur travail, pas le nôtre, et il nous sert de point de comparaison.</p>
    <p class="mt-5"><a href="/methode#compteur-avancement">Comment l’étoile ★ est attribuée</a></p>
    <p class="mt-3"><strong>{plural(data.articles.length, 'article')} ★ dans cette liste</strong>{#if data.exclude} · <a href="/references">Inclure l’exemple de l’accueil</a>{/if}</p>
  </div>
</section>

<section class="bg-surface border-t border-line">
  <div class="container-wide py-12 sm:py-16">
    {#if groups.length === 0}
      <p class="text-muted">Aucun article à afficher.</p>
    {/if}
    <div class="divide-y divide-line">
      {#each groups as [code, articles] (code)}
        <section class="py-7 first:pt-0 last:pb-0">
          <h2 class="text-2xl sm:text-3xl">{code}</h2>
          <p class="mt-2 text-sm text-muted">{plural(articles?.length ?? 0, 'article')} ★</p>
          <ul class="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {#each articles ?? [] as article (article.id)}
              <li><a href={`/article/${article.id}`}>Article {article.num ?? 'sans numéro'}</a></li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>
  </div>
</section>
