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
          Cette page est introuvable.
        </h1>
        <p class="text-lg leading-relaxed text-muted">
          {page.error?.message && page.error.message !== 'Page introuvable' ? `${page.error.message}. ` : ''}L’adresse
          demandée n’existe pas, ou cet élément ne figure pas encore dans notre base.
        </p>
        {#if page.url.pathname.startsWith('/article/')}
          <p class="text-base leading-relaxed text-muted">
            Si le numéro d’article est correct, il appartient peut-être à un code qui n’a pas encore été chargé.
            Vous pouvez le consulter directement sur <a href="https://www.legifrance.gouv.fr" rel="external">Légifrance</a>.
          </p>
        {/if}
      {:else}
        <h1 class="text-4xl tracking-tight text-ink sm:text-5xl">
          Le service n’a pas pu répondre.
        </h1>
        <p class="text-lg leading-relaxed text-muted">
          Une erreur technique s’est produite lors du chargement de cette page. Nous préférons l’indiquer clairement
          plutôt que d’afficher des chiffres incomplets.
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
