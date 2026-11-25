<script lang="ts">
import { VERDICT_LABEL } from '@bugdeloi/core/findings'
import { formatDateTime, formatLegiDate } from '#lib/format.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()
</script>

<svelte:head><title>Anomalies · BugDeLoi</title></svelte:head>

<div class="container-page mt-8">
  <h1 class="text-3xl font-semibold sm:text-4xl">Anomalies qualifiées</h1>
  <p class="mt-2 text-muted">
    <a href="/methode#cycle">Comment une anomalie est qualifiée</a> ·
    <a href="/anomalies/cimetiere">Cimetière des constats rejetés</a>
  </p>

  {#if data.findings.length}
    <ul class="mt-6 grid max-w-4xl gap-3">
      {#each data.findings as item (item.id)}
        <li class="card p-4">
          <p class="text-sm text-muted">{item.typeLabel} · {item.status === 'published' ? 'Publié' : 'Qualifié'}</p>
          <h2 class="mt-1 text-lg font-semibold"><a href="/anomalies/{item.id}">{item.id}</a></h2>
          <p>{item.claim}</p>
          {#if item.articles.length}
            <ul aria-label="Versions d’articles" class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
              {#each item.articles as article (article.id)}
                <li><a href={article.url}>{article.id}</a>{#if article.dateDebut} · {formatLegiDate(article.dateDebut)}{/if}</li>
              {/each}
            </ul>
          {/if}
          {#if item.qualification}
            <p class="mt-2 text-sm">
              {VERDICT_LABEL[item.qualification.verdict]} · @{item.qualification.reviewer} ·
              <time datetime={item.qualification.qualified_at}>{formatDateTime(item.qualification.qualified_at)}</time>
            </p>
          {:else}
            <p class="mt-2 text-sm text-muted">Détail du verdict indisponible dans le certificat.</p>
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p class="mt-6">Aucune anomalie qualifiée par un humain à ce jour.</p>
  {/if}
</div>
