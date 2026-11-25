<script lang="ts">
import FlowDiagram from '#lib/components/FlowDiagram.svelte'
import { explainEvent, replayStatus } from '#lib/events.ts'
import { formatDateTime, formatLegiDate, plural } from '#lib/format.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()
const entry = $derived(data.entry)
const explanation = $derived(explainEvent(entry.type))
const diagramDetail = $derived.by(() => {
  if (entry.reference !== null)
    return plural(entry.reference, 'article portant le marqueur ★', 'articles portant le marqueur ★')
  if (entry.type === 'sweep.finished' && entry.scopes.length) {
    return plural(
      entry.scopes.reduce((sum, scope) => sum + scope.total, 0),
      'article examiné',
      'articles examinés',
    )
  }
  if (entry.projectionDate) return `Textes au ${formatLegiDate(entry.projectionDate)}`
  if (entry.article?.num && entry.article.num.length <= 24) return `Article ${entry.article.num}`
  if (entry.findingHref) return entry.subject
  return null
})
const replayCounts = $derived(Object.entries(Object.groupBy(entry.replayStatuses, (status) => status)))
</script>

<svelte:head><title>{explanation.title} · BugDeLoi</title></svelte:head>

<article class="container-page mt-8">
  <div class="prose-page">
    <p><a href="/#journal">Journal des événements</a></p>
    <h1 class="text-3xl font-semibold sm:text-4xl">{explanation.title}</h1>
    <p class="text-muted"><time datetime={entry.ts}>{formatDateTime(entry.ts)}</time></p>
    {#if entry.summary && entry.type !== 'sweep.finished'}<p>{entry.summary}</p>{/if}
    {#if explanation.diagram}
      {@const diagram = explanation.diagram}
      <figure class="mt-6">
        <FlowDiagram title={explanation.title} description={diagram.secondSource ? `${diagram.from} et ${diagram.secondSource} : ${diagram.to}.` : `${diagram.from} → ${diagram.to}.`} {...diagram} detail={diagramDetail} />
        {#if diagram.example}
          <figcaption class="mt-2 text-sm text-muted">Exemple de renvoi recherché pendant le contrôle.</figcaption>
        {/if}
      </figure>
    {/if}
    <h2>Pourquoi cette étape ?</h2>
    <p>{explanation.why}</p>
    {#if entry.scopes.length}
      <ul>
        {#each entry.scopes as scope (scope.code)}
          <li>
            {scope.code} ·
            {#if entry.type === 'sweep.finished'}
              {plural(scope.total, 'article en vigueur examiné', 'articles en vigueur examinés')}
            {:else}
              {plural(scope.total, 'version en base', 'versions en base')}
            {/if}
            {#if scope.date} au {formatLegiDate(scope.date)}{/if}
          </li>
        {/each}
      </ul>
      <p class="text-sm"><a href={entry.type === 'sweep.finished' ? '/methode#compteur-journal' : '/methode#compteur-articles'}>Méthode de calcul</a></p>
    {/if}
    {#if entry.reference !== null}<p><a href="/methode#niveaux">Conditions d’attribution du marqueur ★</a></p>{/if}
    {#if replayCounts.length}
      <ul>
        {#each replayCounts as [status, runs] (status)}
          <li>{plural(runs?.length ?? 0, 'suite')} · {replayStatus(status)} <code class="text-muted">{status}</code></li>
        {/each}
      </ul>
      <p class="text-sm"><a href="/methode#compteur-rejeux">Méthode de calcul des rejeux</a></p>
    {/if}
    <h2>Ce que montre cette entrée</h2>
    <p>{explanation.meaning}</p>
    <h2>La suite</h2>
    <p>{explanation.next}</p>
    {#if entry.findingHref}
      <p><a href={entry.findingHref}>Lire la fiche {entry.subject}</a></p>
    {:else if entry.article}
      <p><a href="/article/{entry.article.id}">Lire la fiche de l’article {entry.article.num ?? entry.article.id}</a></p>
    {/if}
    <details class="mt-8 border-t border-line pt-3">
      <summary>Détails du journal</summary>
      <dl class="mt-2 grid gap-2 text-sm">
        <div><dt class="font-medium">Type</dt><dd><code>{entry.type}</code></dd></div>
        <div><dt class="font-medium">Acteur</dt><dd><code>{entry.actor}</code></dd></div>
        {#if entry.subject}<div><dt class="font-medium">Référence</dt><dd><code class="wrap-anywhere">{entry.subject}</code></dd></div>{/if}
        {#if entry.archive}<div><dt class="font-medium">Archive</dt><dd><code class="wrap-anywhere">{entry.archive}</code></dd></div>{/if}
      </dl>
    </details>
  </div>
</article>
