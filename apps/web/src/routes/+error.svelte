<script lang="ts">
import { page } from '$app/state'
</script>

<svelte:head>
  <title>{page.status === 404 ? 'Page introuvable' : 'Erreur'} · BugDeLoi</title>
</svelte:head>

<div class="container-page mt-12 max-w-2xl">
  <p class="kicker">Erreur {page.status}</p>
  {#if page.status === 404}
    <h1 class="mt-1 text-3xl font-semibold">Page introuvable</h1>
    <p class="mt-3">
      {page.error?.message && page.error.message !== 'Page introuvable' ? `${page.error.message}. ` : ''}L’adresse
      demandée n’existe pas, ou l’élément n’est pas (encore) dans notre base.
    </p>
    {#if page.url.pathname.startsWith('/article/')}
      <p class="mt-2 text-muted">
        Si l’identifiant est correct, l’article n’a peut-être pas encore été ingéré. Vous pouvez le chercher sur
        Légifrance.
      </p>
    {/if}
  {:else}
    <h1 class="mt-1 text-3xl font-semibold">Une erreur est survenue</h1>
    <p class="mt-3">Le serveur n’a pas pu répondre. Nous préférons afficher cette page plutôt qu’un résultat incomplet.</p>
  {/if}
  <ul class="mt-6 flex flex-wrap gap-4">
    <li><a href="/">Accueil</a></li>
    <li><a href="/carte">Carte</a></li>
    <li><a href="/status">État du service</a></li>
  </ul>
</div>
