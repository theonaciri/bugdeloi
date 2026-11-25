<script lang="ts">
import { VERDICT_LABEL } from '@bugdeloi/core/findings'
import { etatLabel, formatDateTime, formatLegiDate } from '#lib/format.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()
let item = $derived(data.finding)
let rejected = $derived(item.status === 'rejected')
</script>

<svelte:head><title>{item.id} · Anomalies · BugDeLoi</title></svelte:head>

<div class="container-page mt-8">
  <div class="prose-page">
    <p><a href={rejected ? '/anomalies/cimetiere' : '/anomalies'}>{rejected ? 'Cimetière des constats rejetés' : 'Anomalies qualifiées'}</a></p>
    <h1 class="text-3xl font-semibold sm:text-4xl">{item.id} · {item.typeLabel}</h1>
    <p class="text-muted">{rejected ? 'Rejeté par un humain' : item.status === 'published' ? 'Publié' : 'Qualifié'}</p>
    <p>{item.claim}</p>

    <h2>Versions d’articles</h2>
    {#if item.projectionDate}
      <p>Date de projection du balayage · {formatLegiDate(item.projectionDate)}</p>
    {/if}
    {@render version('Article source', item.source)}
    {@render version('Dernière version connue de la cible', item.target)}
    {#if item.articles.length}
      <ul aria-label="Unités légales">
        {#each item.articles as article (article.id)}
          <li><a href={article.url}>{article.id} sur Légifrance</a>{#if article.dateDebut} · début le {formatLegiDate(article.dateDebut)}{/if}</li>
        {/each}
      </ul>
    {/if}

    <h2>Extraits du certificat</h2>
    {#each item.excerpts as excerpt}
      <blockquote class="border-l-2 border-line pl-4 whitespace-pre-wrap">{excerpt.before}<mark>{excerpt.marked}</mark>{excerpt.after}</blockquote>
    {:else}
      <p>Aucun extrait dans le certificat.</p>
    {/each}
    {#if item.hints.length}
      <h3>Indices dans le texte</h3>
      <ul>
        {#each item.hints as hint}<li>« {hint} »</li>{/each}
      </ul>
    {/if}

    <h2>Reproduction indépendante</h2>
    {#if typeof item.reproduction.verdict === 'string'}
      <dl>
        <dt>Verdict du rejeu</dt>
        <dd>{item.reproduction.verdict}</dd>
        {#if typeof item.reproduction.source === 'string'}
          <dt>Source</dt>
          <dd>{item.reproduction.source}</dd>
        {/if}
        {#if typeof item.reproduction.checked_at === 'string'}
          <dt>Date du rejeu</dt>
          <dd>{formatDateTime(item.reproduction.checked_at)}</dd>
        {/if}
      </dl>
    {:else}
      <p>Aucun verdict de reproduction indépendante dans le certificat.</p>
    {/if}

    <h2>Verdict humain</h2>
    {#if item.qualification}
      <p>
        <strong>{VERDICT_LABEL[item.qualification.verdict]}</strong> · @{item.qualification.reviewer} ·
        <time datetime={item.qualification.qualified_at}>{formatDateTime(item.qualification.qualified_at)}</time>
      </p>
      <p class="whitespace-pre-wrap">{item.qualification.note}</p>
      <p><a href="https://github.com/theonaciri/bugdeloi/commit/{item.qualification.commit}">Commit du verdict sur GitHub</a> · <code class="wrap-anywhere">{item.qualification.file}</code></p>
    {:else}
      <p>Détail du verdict indisponible dans le certificat.</p>
    {/if}

    <h2>Rejouer le certificat</h2>
    {#if item.replay}
      <pre class="wrap-anywhere whitespace-pre-wrap rounded-lg bg-surface-2 p-4"><code>{item.replay}</code></pre>
    {:else}
      <p>Aucune commande de rejeu dans le certificat.</p>
    {/if}

    <details class="mt-6">
      <summary>Certificat complet (JSON)</summary>
      <pre class="wrap-anywhere whitespace-pre-wrap rounded-lg bg-surface-2 p-4"><code>{item.certificate}</code></pre>
    </details>
  </div>
</div>

{#snippet version(label: string, ref: typeof item.source)}
  {#if ref}
    <h3>{label}</h3>
    <p>
      {#if ref.code || ref.num}{[ref.code, ref.num].filter(Boolean).join(' · ')} · {/if}
      <a href={ref.url}>{ref.id} sur Légifrance</a>
    </p>
    <dl>
      <dt>État dans le certificat</dt>
      <dd>{etatLabel(ref.etat)}</dd>
      <dt>Début de la version</dt>
      <dd>{formatLegiDate(ref.dateDebut)}</dd>
      <dt>Fin de la version</dt>
      <dd>{formatLegiDate(ref.dateFin)}</dd>
    </dl>
  {/if}
{/snippet}
