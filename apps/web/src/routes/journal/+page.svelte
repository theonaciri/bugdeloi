<script lang="ts">
import JournalList from '#lib/components/JournalList.svelte'
import type { PageProps } from './$types'

let { data }: PageProps = $props()
</script>

<svelte:head><title>Journal — BugDeLoi</title></svelte:head>

<section class="container-page pt-8 sm:pt-12">
  <h1 class="text-4xl font-semibold">Journal du projet</h1>
  <p class="mt-3 max-w-[65ch]">Les opérations répétées dans la même journée sont regroupées. Ouvrez un groupe pour accéder à chaque entrée.</p>
  <p class="mt-2 text-sm"><a href="/methode#compteur-journal">Comment est tenu le journal ?</a> · <a href="/feed.atom">S’abonner au journal</a></p>
  <div class="mt-6"><JournalList entries={data.entries} /></div>
  {#if data.before || data.older}
    <nav class="mt-4 flex flex-wrap gap-4" aria-label="Pages du journal">
      {#if data.before}<a href="/journal">Entrées les plus récentes</a>{/if}
      {#if data.older}<a href={`/journal?avant=${data.older}`}>Entrées plus anciennes</a>{/if}
    </nav>
  {/if}
</section>
