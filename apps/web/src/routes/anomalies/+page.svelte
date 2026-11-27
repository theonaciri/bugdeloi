<script lang="ts">
import { VERDICT_LABEL } from '@bugdeloi/core/findings'
import { etatLabel, formatDateTime, formatInt, formatLegiDate, plural } from '#lib/format.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()
const pending = $derived(data.pending)
const totalAll = $derived(pending.refMorteCount + pending.syntaxeCount)
const lastPage = $derived(Math.max(1, Math.ceil(pending.total / pending.pageSize)))
const filters = $derived([
  { type: null, label: 'Tous', count: totalAll },
  { type: 'REF_MORTE', label: 'Renvois vers un article abrogé', count: pending.refMorteCount },
  { type: 'SYNTAXE', label: 'Fautes de ponctuation', count: pending.syntaxeCount },
])

function listHref(type: string | null, page = 1) {
  const params = new URLSearchParams()
  if (type) params.set('type', type)
  if (page > 1) params.set('page', String(page))
  const query = params.toString()
  return query ? `/anomalies?${query}` : '/anomalies'
}

function readableClaim(claim: string) {
  return claim
    .replace(/ \(LEGIARTI[0-9]+\)/gu, '')
    .replace(/\b[0-9]{4}-[0-9]{2}-[0-9]{2}\b/gu, formatLegiDate)
    .replace(' a un lien de citation vers ', ' cite ')
    .replace(
      /, la dernière a l'état ([A-Z_]+)/u,
      (_, status: string) => `. Statut de la dernière version : ${etatLabel(status).toLowerCase()}`,
    )
    .replace(' ; fin le ', ', avec une fin au ')
}
</script>

<svelte:head>
  <title>Anomalies et signalements · BugDeLoi</title>
  <meta name="description" content="Consultez les anomalies qualifiées par un juriste et les signalements en attente de relecture humaine." />
</svelte:head>

<header class="bg-bg">
  <div class="container-wide space-y-5 py-12 sm:py-16">
    <h1 class="text-4xl tracking-tight sm:text-5xl">Anomalies et signalements</h1>
    <p class="max-w-3xl font-display text-xl leading-relaxed text-ink/90">
      Les programmes de BugDeLoi repèrent des problèmes possibles dans la loi française : des renvois vers des
      articles abrogés, des fautes de ponctuation ou des effets de seuil, par exemple quand gagner un euro fait
      perdre plus d’un euro d’aide.
    </p>
    <p class="max-w-3xl leading-relaxed text-muted">
      Une règle temporaire peut renvoyer volontairement à un ancien texte et tromper un programme.
      <strong class="text-ink">Une anomalie entre au compteur après relecture et verdict signé par un juriste.</strong>
    </p>
    <nav aria-label="En savoir plus sur les signalements" class="flex flex-wrap gap-x-5 gap-y-2 text-sm">
      <a href="/methode#cycle">Comprendre le processus de vérification</a>
      <a href="/anomalies/cimetiere">Voir les signalements rejetés (cimetière)</a>
    </nav>
  </div>
</header>

<section class="border-t border-line bg-surface" aria-labelledby="anomalies-validees">
  <div class="container-wide space-y-5 py-12 sm:py-16">
    <h2 id="anomalies-validees" class="text-2xl sm:text-3xl">
      Anomalies qualifiées par un juriste ({formatInt(data.findings.length)})
    </h2>
    {#if data.findings.length > 0}
      <ul class="divide-y divide-line border-y border-line">
        {#each data.findings as item (item.id)}
          <li class="grid gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div class="space-y-2">
              <h3 class="text-xl"><a href="/anomalies/{item.id}">{item.typeLabel}</a></h3>
              <p class="max-w-[70ch]">{item.claim}</p>
              {#if item.articles.length}
                <ul aria-label="Versions d’articles" class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {#each item.articles as article (article.id)}
                    <li><a href={article.url} rel="external">{article.id}</a>{#if article.dateDebut} · {formatLegiDate(article.dateDebut)}{/if}</li>
                  {/each}
                </ul>
              {/if}
              {#if item.qualification}
                <p class="text-sm text-muted">
                  {VERDICT_LABEL[item.qualification.verdict]} · @{item.qualification.reviewer} ·
                  <time datetime={item.qualification.qualified_at}>{formatDateTime(item.qualification.qualified_at)}</time>
                </p>
              {:else}
                <p class="text-sm text-muted">Le détail du verdict est indisponible.</p>
              {/if}
            </div>
            <p class="text-sm text-muted sm:text-right">
              <span class="block">{item.status === 'published' ? 'Publié' : 'Qualifié par un humain'}</span>
              <span class="mono text-xs">{item.id}</span>
            </p>
          </li>
        {/each}
      </ul>
    {:else}
      <div class="max-w-3xl space-y-2 border-y border-line py-5">
        <p class="font-semibold">0 anomalie validée par un juriste à ce jour.</p>
        <p class="leading-relaxed text-muted">
          {#if totalAll > 0}
            Les programmes ont terminé leur vérification croisée sur les premiers signalements. Ces dossiers sont
            prêts pour la relecture humaine. Le compteur restera à zéro jusqu’au premier verdict qui confirme une anomalie.
          {:else}
            Les premiers dossiers seront soumis à un juriste après le contrôle par un second programme indépendant.
          {/if}
        </p>
      </div>
    {/if}
    <p class="text-sm"><a href="/methode#compteurs">Comment ce compteur est calculé</a></p>
  </div>
</section>

<section class="border-t border-line bg-bg" aria-labelledby="signalements">
  <div class="container-wide space-y-6 py-12 sm:py-16">
    <div class="space-y-2">
      <h2 id="signalements" class="text-2xl sm:text-3xl">
        Signalements en attente de relecture humaine ({formatInt(totalAll)})
      </h2>
      <p class="text-muted">
        {plural(totalAll, 'renvoi ou défaut de ponctuation confirmé par deux programmes indépendants', 'renvois ou défauts de ponctuation confirmés par deux programmes indépendants')}.
        {plural(pending.candidateCount, 'signalement en cours de contrôle', 'signalements en cours de contrôle')}.
        <a href="/methode#cycle">Les étapes du contrôle</a>
      </p>
    </div>
    {#if totalAll > 0}
      <p class="max-w-3xl rounded-xl bg-notice/70 p-5 text-sm leading-relaxed text-notice-ink">
        <strong>Travaux en cours.</strong> Deux programmes indépendants ont retrouvé ces signalements.
        Chaque dossier attend encore un verdict humain avant de pouvoir être compté comme anomalie qualifiée.
      </p>
    {/if}

    <nav aria-label="Filtrer les signalements par type">
      <ul class="flex flex-wrap gap-2">
        {#each filters as filter (filter.type)}
          <li>
            <a
              href={listHref(filter.type)}
              aria-current={pending.activeType === filter.type ? 'true' : undefined}
              class="block rounded-[var(--radius)] border border-line px-4 py-2 text-sm font-semibold text-ink no-underline hover:bg-surface-2 aria-[current=true]:border-brand aria-[current=true]:bg-brand-soft aria-[current=true]:text-brand-strong"
            >
              {filter.label} ({formatInt(filter.count)})
            </a>
          </li>
        {/each}
      </ul>
    </nav>

    {#if pending.items.length > 0}
      <ul class="divide-y divide-line border-y border-line">
        {#each pending.items as item (item.id)}
          <li class="grid gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div class="min-w-0 space-y-1.5">
              <h3 class="text-xl">
                {item.type === 'SYNTAXE' ? 'Faute de ponctuation' : item.typeLabel}
              </h3>
              <p class="max-w-[70ch] leading-relaxed">{readableClaim(item.claim)}</p>
              <p class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted">
                {#if item.articleCode || item.articleNum}
                  <span>{item.articleCode}{item.articleCode && item.articleNum ? ' · ' : ''}{item.articleNum ? `Article ${item.articleNum}` : ''}</span>
                {:else if item.articleId}
                  <span>{item.articleId}</span>
                {/if}
                <span class="mono text-xs">{item.id}</span>
              </p>
            </div>
            <a
              href="/anomalies/{item.id}"
              aria-label="Consulter le dossier {item.id}"
              class="justify-self-start text-sm font-semibold sm:justify-self-end"
            >Consulter le dossier <span aria-hidden="true">→</span></a>
          </li>
        {/each}
      </ul>
    {:else if pending.page > lastPage}
      <p class="text-muted">Cette page est vide. <a href={listHref(pending.activeType, lastPage)}>Aller à la dernière page disponible</a>.</p>
    {:else}
      <p class="border-t border-line py-5 text-muted">Aucun signalement en attente de relecture dans cette liste.</p>
    {/if}

    {#if pending.total > pending.pageSize && pending.page <= lastPage}
      <nav aria-label="Pages des signalements" class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {#if pending.page > 1}
          <a href={listHref(pending.activeType, pending.page - 1)} rel="prev">← Page précédente</a>
        {/if}
        <span class="text-muted">Page {formatInt(pending.page)} sur {formatInt(lastPage)}</span>
        {#if pending.page < lastPage}
          <a href={listHref(pending.activeType, pending.page + 1)} rel="next">Page suivante →</a>
        {/if}
      </nav>
    {/if}
  </div>
</section>
