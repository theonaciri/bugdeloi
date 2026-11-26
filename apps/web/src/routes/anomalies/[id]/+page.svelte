<script lang="ts">
import { VERDICT_LABEL } from '@bugdeloi/core/findings'
import FlowDiagram from '#lib/components/FlowDiagram.svelte'
import { findingSteps } from '#lib/finding-guide.ts'
import { etatLabel, formatDateTime, formatLegiDate } from '#lib/format.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()
let item = $derived(data.finding)
let rejected = $derived(item.status === 'rejected')
let pending = $derived(item.status === 'candidate' || item.status === 'reproduced')
const currentStep = $derived(findingSteps.findIndex((step) => step.status === item.status))
const abrogation = $derived(
  item.target?.etat === 'ABROGE' && item.target.dateFin && !item.target.dateFin.startsWith('2999')
    ? `Abrogé le ${formatLegiDate(item.target.dateFin)}`
    : null,
)

function articleLabel(ref: typeof item.source, fallback: string) {
  const label = ref?.num ? [ref.code, ref.num].filter(Boolean).join(' · ') : null
  return label && label.length <= 20 ? `Art. ${label}` : fallback
}
</script>

<svelte:head><title>{item.id} · Anomalies · BugDeLoi</title></svelte:head>

<div class="container-page mt-8">
  <div class="prose-page">
    <p><a href={rejected ? '/anomalies/cimetiere' : '/anomalies'}>{rejected ? 'Cimetière des constats rejetés' : 'Anomalies qualifiées'}</a></p>
    <h1 class="text-3xl font-semibold sm:text-4xl">{item.typeLabel}</h1>
    <p class="text-muted">
      <code class="mr-2 text-xs">{item.id}</code>
      {pending ? 'En attente de qualification' : rejected ? 'Rejeté par un humain' : item.status === 'published' ? 'Publié après verdict humain' : 'Qualifié par un humain'}
      <code class="ml-2 text-xs">{item.type} · {item.status}</code>
    </p>

    {#if pending}
      <p class="rounded-lg border border-line bg-surface-2 p-4">
        {item.status === 'reproduced'
          ? 'Constat non qualifié par un humain — reproduit par machine, en attente de verdict humain (pas encore compté parmi les anomalies qualifiées)'
          : 'Constat non qualifié par un humain — candidat détecté par machine, en attente de reproduction et de verdict humain (pas encore compté parmi les anomalies qualifiées)'}
      </p>
    {/if}

    <h2>Ce que le contrôle a relevé</h2>
    {#if item.type === 'REF_MORTE'}
      <p>Le programme a repéré un renvoi vers un article qu’il a identifié comme abrogé à la date du contrôle.</p>
      <figure>
        <FlowDiagram
          title="Le renvoi signalé"
          description={`${articleLabel(item.source, 'L’article source')} cite ${articleLabel(item.target, 'l’article cité')}.`}
          from={articleLabel(item.source, 'Article source')}
          to={articleLabel(item.target, 'Article cité')}
          relation="Cite"
          detail={abrogation}
        />
        <figcaption class="mt-2 text-sm text-muted">Le schéma reprend les versions enregistrées dans le certificat.</figcaption>
      </figure>
      <p>Un renvoi vers une ancienne version peut être volontaire. {pending ? 'La relecture humaine doit examiner ce renvoi.' : 'Le verdict humain précise ce qui a été retenu dans ce cas.'}</p>
      <details>
        <summary>Constat enregistré par le programme</summary>
        <p class="mt-2">{item.claim}</p>
      </details>
    {:else}
      <p>{item.claim}</p>
    {/if}

    <h2>Où en est ce constat ?</h2>
    <ol class="mt-4 grid list-none gap-y-2 border-y border-line p-0 sm:grid-cols-4" aria-label="Cycle du constat">
      {#each findingSteps as step, index (step.status)}
        {@const reached = rejected ? index < 2 : index <= currentStep}
        <li class="m-0 border-t border-line px-3 py-3 first:border-0 sm:border-l sm:border-t-0" aria-current={item.status === step.status ? 'step' : undefined}>
          <p class="font-semibold">{step.term}</p>
          <p class="text-xs {item.status === step.status ? 'font-semibold text-brand-strong' : 'text-muted'}">
            {item.status === step.status ? 'Étape actuelle' : reached ? 'Étape passée' : rejected ? 'Étape écartée' : 'Étape suivante'}
          </p>
          <p class="mt-1 text-sm">{step.definition}</p>
        </li>
      {/each}
    </ol>
    {#if rejected}
      <p>Le relecteur a écarté le constat après sa reproduction. <a href="#verdict">Lire son motif</a>.</p>
    {:else if item.status === 'qualified'}
      <p><a href="#verdict">Lire le verdict</a>. Une entrée de publication pourra ensuite être ajoutée au journal.</p>
    {:else if item.status === 'published'}
      <p>Vous pouvez <a href="#verdict">lire le verdict</a> et relancer le contrôle à partir du certificat.</p>
    {/if}

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
        <dd>
          {item.reproduction.verdict === 'confirmé' ? 'La chaîne indépendante a retrouvé le constat.' : 'Le certificat consigne le résultat du contrôle.'}
          <code class="ml-2 text-xs text-muted">{item.reproduction.verdict}</code>
        </dd>
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

    <h2 id="verdict">Verdict humain</h2>
    {#if item.qualification}
      <p>
        <strong>{VERDICT_LABEL[item.qualification.verdict]}</strong> · @{item.qualification.reviewer} ·
        <time datetime={item.qualification.qualified_at}>{formatDateTime(item.qualification.qualified_at)}</time>
      </p>
      <p class="whitespace-pre-wrap">{item.qualification.note}</p>
      <p><a href="https://github.com/theonaciri/bugdeloi/commit/{item.qualification.commit}">Commit du verdict sur GitHub</a> · <code class="wrap-anywhere">{item.qualification.file}</code></p>
    {:else if pending}
      <p>En attente de verdict humain.</p>
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
