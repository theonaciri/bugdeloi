<script lang="ts">
import { page } from '$app/state'
</script>

<svelte:head>
  <title>{page.status === 404 ? 'Page introuvable' : 'Problème technique'} · BugDeLoi</title>
</svelte:head>

<section class="bg-bg">
  <div class="container-wide py-16 sm:py-24">
    <div class="max-w-2xl space-y-5">
      <p class="font-mono text-sm text-muted">Erreur {page.status}</p>
      {#if page.status === 404}
        <h1 class="text-4xl tracking-tight text-ink sm:text-5xl">
          Page introuvable
        </h1>
        <p class="text-lg leading-relaxed text-muted">
          {page.error?.message && page.error.message !== 'Page introuvable' ? `${page.error.message}. ` : ''}L’adresse
          demandée n’existe pas, ou cette ressource ne figure pas encore dans la base de données.
        </p>
        {#if page.url.pathname.startsWith('/article/')}
          <p class="text-base leading-relaxed text-muted">
            Si l’identifiant d’article est exact, il appartient probablement à un code qui n’est pas encore importé.
            Vous pouvez consulter le texte officiel sur <a href="https://www.legifrance.gouv.fr" rel="external">Légifrance</a>.
          </p>
        {/if}
      {:else}
        <h1 class="text-4xl tracking-tight text-ink sm:text-5xl">
          Service temporairement indisponible
        </h1>
        <p class="text-lg leading-relaxed text-muted">
          Une erreur technique s’est produite lors du chargement de cette page. Aucune donnée partielle n’est affichée
          en l’absence d’une réponse complète du serveur.
        </p>
      {/if}
      <div class="flex flex-wrap items-center gap-4 pt-4">
        <a
          href="/"
          class="inline-flex items-center rounded-[var(--radius)] bg-brand px-5 py-2.5 text-sm font-semibold text-white no-underline hover:bg-brand-strong"
        >
          Revenir à l’accueil
        </a>
        <a href="/carte" class="text-sm font-medium">Explorer la carte des codes</a>
        <a href="/status" class="text-sm font-medium text-muted">État du service</a>
      </div>
    </div>
  </div>
</section>
