<script lang="ts">
import JournalList from '#lib/components/JournalList.svelte'
import type { PageProps } from './$types'

let { data }: PageProps = $props()
</script>

<svelte:head><title>Journal · BugDeLoi</title></svelte:head>

<section class="bg-bg">
  <div class="container-wide py-12 sm:py-16">
    <h1 class="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Journal public d’activité</h1>
    <p class="mt-4 max-w-[68ch] text-lg leading-relaxed text-muted">Chaque chargement des textes officiels, chaque contrôle automatique et chaque vérification croisée est consigné ici publiquement, dans l’ordre chronologique. Les opérations répétées au cours d’une même journée sont regroupées pour garder le fil lisible.</p>
    <div class="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
      <a href="/methode#compteur-journal">Comment ce journal est tenu</a>
      <a href="/feed.atom">S’abonner au fil RSS / Atom</a>
    </div>
  </div>
</section>

<section class="bg-surface border-t border-line">
  <div class="container-wide py-10 sm:py-14">
    <JournalList entries={data.entries} />
    {#if data.before || data.older}
      <nav class="mt-6 flex flex-wrap gap-4" aria-label="Pages du journal">
        {#if data.before}<a href="/journal">Entrées plus récentes</a>{/if}
        {#if data.older}<a href={`/journal?avant=${data.older}`}>Entrées plus anciennes</a>{/if}
      </nav>
    {/if}
  </div>
</section>
