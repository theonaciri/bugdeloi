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

<article>
  <header class="bg-bg">
    <div class="container-wide space-y-4 py-12 sm:py-16">
      <p class="text-sm"><a href="/journal">← Retour au journal</a></p>
      <h1 class="font-serif text-3xl font-semibold tracking-tight sm:text-5xl">{entry.headline}</h1>
      <p class="text-sm text-muted"><time datetime={entry.ts}>{formatDateTime(entry.ts)}</time></p>
      {#if entry.detail}<p class="max-w-[68ch] text-lg leading-relaxed text-muted">{entry.detail}</p>{/if}
    </div>
  </header>

  <div class="bg-surface border-t border-line">
    <div class="container-wide py-12 sm:py-16">
      <div class="max-w-[68ch] space-y-8">
        <section class="space-y-3">
          <h2 class="font-serif text-2xl font-semibold sm:text-3xl">Pourquoi cette étape existe</h2>
          <p>{explanation.why}</p>
          {#if explanation.diagram}
            {@const diagram = explanation.diagram}
            <figure class="rounded-xl bg-bg p-4 sm:p-5">
              <FlowDiagram title={explanation.title} description={diagram.secondSource ? `${diagram.from} et ${diagram.secondSource} : ${diagram.to}.` : `${diagram.from} → ${diagram.to}.`} {...diagram} detail={diagramDetail} />
              {#if diagram.example}
                <figcaption class="mt-2 text-sm text-muted">Exemple de renvoi recherché pendant le contrôle.</figcaption>
              {/if}
            </figure>
          {/if}
        </section>
        <section class="space-y-3 border-t border-line pt-6">
          <h2 class="font-serif text-2xl font-semibold sm:text-3xl">Ce que montre concrètement cette opération</h2>
          <p>{explanation.meaning}</p>
          {#if entry.scopes.length}
            <ul class="space-y-2">
              {#each entry.scopes as scope (scope.code)}
                <li>
                  {scope.code} ·
                  {#if entry.type === 'sweep.finished'}
                    {plural(scope.total, 'article en vigueur examiné', 'articles en vigueur examinés')}
                  {:else}
                    {plural(scope.total, 'version enregistrée', 'versions enregistrées')}
                  {/if}
                  {#if scope.date} au {formatLegiDate(scope.date)}{/if}
                </li>
              {/each}
            </ul>
            <p class="text-sm"><a href={entry.type === 'sweep.finished' ? '/methode#compteur-journal' : '/methode#compteur-articles'}>Méthode de calcul</a></p>
          {/if}
          {#if entry.reference !== null}
            <p>{plural(entry.reference, 'article portant le marqueur ★', 'articles portant le marqueur ★')} · <a href="/methode#compteur-avancement">Conditions d’attribution de l’étoile ★</a></p>
          {/if}
          {#if replayCounts.length}
            <ul class="space-y-2">
              {#each replayCounts as [status, runs] (status)}
                <li>{plural(runs?.length ?? 0, 'suite')} · {replayStatus(status)}</li>
              {/each}
            </ul>
            <p class="text-sm"><a href="/methode#compteur-rejeux">Méthode de calcul du compteur des tests de référence</a></p>
          {/if}
          {#if entry.promotedArticles.length}
            <div class="overflow-x-auto rounded-xl border border-line bg-bg">
              <table class="w-full min-w-[34rem] border-collapse text-left text-sm">
                <thead>
                  <tr class="border-b border-line bg-surface text-xs uppercase tracking-wide text-muted">
                    <th scope="col" class="px-4 py-3 font-semibold">Article</th>
                    <th scope="col" class="px-4 py-3 font-semibold">Identifiant LEGIARTI</th>
                    <th scope="col" class="px-4 py-3 font-semibold">Niveau</th>
                    <th scope="col" class="px-4 py-3 font-semibold">Source Catala</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-line">
                  {#each entry.promotedArticles as art (art.id)}
                    <tr>
                      <td class="px-4 py-3 font-semibold text-ink">
                        <a href="/article/{art.id}" class="text-brand-strong no-underline hover:underline">
                          {art.code} {art.num}
                        </a>
                      </td>
                      <td class="px-4 py-3 font-mono text-xs text-muted">{art.id}</td>
                      <td class="px-4 py-3">
                        <span class="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-strong">
                          {entry.promotedLevel ?? 'N2'}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-xs">
                        {#if art.file}
                          <a
                            href="https://github.com/theonaciri/bugdeloi/blob/main/corpus/{art.file}"
                            rel="external"
                            class="font-mono text-brand-strong no-underline hover:underline"
                          >
                            corpus/{art.file} →
                          </a>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
          {#if entry.findingHref}
            <p><a href={entry.findingHref}>Lire la fiche {entry.subject}</a></p>
          {:else if entry.article}
            <p><a href="/article/{entry.article.id}">Lire la fiche de l’article {entry.article.num ?? entry.article.id}</a></p>
          {/if}
        </section>
        <section class="space-y-3 border-t border-line pt-6">
          <h2 class="font-serif text-2xl font-semibold sm:text-3xl">Quelle est la suite ?</h2>
          <p>{explanation.next}</p>
        </section>
        <details class="mt-8 border-t border-line pt-3">
          <summary class="cursor-pointer font-semibold">Informations techniques du journal</summary>
          <dl class="mt-2 grid gap-2 text-sm">
            <div><dt class="font-medium">Type</dt><dd><code>{entry.type}</code></dd></div>
            <div><dt class="font-medium">Acteur</dt><dd><code>{entry.actor}</code></dd></div>
            {#if entry.subject}<div><dt class="font-medium">Référence</dt><dd><code class="wrap-anywhere">{entry.subject}</code></dd></div>{/if}
            {#if entry.archive}<div><dt class="font-medium">Archive</dt><dd><code class="wrap-anywhere">{entry.archive}</code></dd></div>{/if}
          </dl>
        </details>
      </div>
    </div>
  </div>
</article>
