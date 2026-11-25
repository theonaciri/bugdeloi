<script lang="ts">
import EmptyState from '#lib/components/EmptyState.svelte'
import LevelBadge from '#lib/components/LevelBadge.svelte'
import {
  etatLabel,
  formatDateTime,
  formatLegiDate,
  formatPeriod,
  linkTypeLabel,
  plural,
} from '#lib/format.ts'
import { LEVEL_INFO } from '#lib/levels.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()
const a = $derived(data.article)
const title = $derived(a.num ? `Article ${a.num}` : a.id)
const codeParam = $derived(a.text.code ?? 'CGI')
</script>

<svelte:head>
  <title>{title} · {a.text.short ?? a.text.title} · BugDeLoi</title>
  <meta name="description" content="{title} du {a.text.title} : texte officiel (LEGI), versions, liens et niveau de preuve." />
</svelte:head>

<article class="container-page mt-8">
  <nav aria-label="Fil d’Ariane" class="text-sm">
    <ol class="flex flex-wrap items-center gap-x-1 gap-y-1">
      <li>
        {#if a.text.code}<a href="/carte?code={a.text.code}">{a.text.title}</a>{:else}{a.text.title}{/if}
      </li>
      {#each a.crumbs as c (c.id)}
        <li class="flex items-center gap-1">
          <span aria-hidden="true" class="text-muted">›</span>
          {#if a.text.code}<a href="/carte?code={codeParam}&s={c.id}">{c.title}</a>{:else}{c.title}{/if}
        </li>
      {/each}
    </ol>
  </nav>

  <header class="mt-4">
    <p class="kicker">{a.text.title}</p>
    <h1 class="mt-1 text-3xl font-semibold sm:text-4xl">{title}</h1>
    <p class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <span class="font-semibold">{etatLabel(a.etat)}</span>
      <span class="text-muted">· version applicable {formatPeriod(a.dateDebut, a.dateFin)}</span>
    </p>
    <p class="mt-3">
      <a href={data.legifrance} rel="external">Lire cet article sur Légifrance</a>
      <span class="text-sm text-muted">— le texte publié sur Légifrance est celui qui fait foi.</span>
    </p>
  </header>

  <div class="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem]">
    <div class="min-w-0 space-y-10">
      <section aria-labelledby="texte">
        <h2 id="texte" class="text-xl font-semibold">Texte officiel</h2>
        <p class="mt-1 text-sm text-muted">Tel qu’ingéré depuis la base LEGI de la DILA (Licence Ouverte), mise en forme simplifiée.</p>
        {#if data.contentSafe}
          <div class="legal-text card mt-3 p-5">{@html data.contentSafe}</div>
        {:else}
          <div class="mt-3"><EmptyState title="Texte vide dans LEGI pour cette version." /></div>
        {/if}
        {#if data.notaSafe}
          <h3 class="mt-6 text-lg font-semibold">Nota</h3>
          <div class="legal-text mt-2 text-base">{@html data.notaSafe}</div>
        {/if}
      </section>

      <section aria-labelledby="versions">
        <h2 id="versions" class="text-xl font-semibold">Versions</h2>
        <p class="mt-1 text-sm text-muted">
          Chaque version d’un article a son propre identifiant LEGIARTI.
          {plural(a.versions.length, 'version connue', 'versions connues')}.
        </p>
        <div class="mt-3 overflow-x-auto">
          <table class="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead>
              <tr class="border-b border-line-strong">
                <th scope="col" class="py-2 pr-3">Identifiant</th>
                <th scope="col" class="py-2 pr-3">État</th>
                <th scope="col" class="py-2 pr-3">Début</th>
                <th scope="col" class="py-2">Fin</th>
              </tr>
            </thead>
            <tbody>
              {#each a.versions as v (v.id)}
                <tr class="border-b border-line" aria-current={v.id === a.id ? 'true' : undefined}>
                  <td class="py-2 pr-3">
                    {#if v.id === a.id}
                      <span class="mono font-semibold">{v.id}</span> <span class="text-muted">(cette page)</span>
                    {:else if v.inDb}
                      <a class="mono" href="/article/{v.id}">{v.id}</a>
                    {:else}
                      <a class="mono" href={data.versionLinks[v.id]} rel="external">{v.id}</a>
                      <span class="text-muted">(Légifrance)</span>
                    {/if}
                  </td>
                  <td class="py-2 pr-3">{v.inDb ? etatLabel(v.etat) : 'non ingérée'}</td>
                  <td class="py-2 pr-3">{formatLegiDate(v.dateDebut)}</td>
                  <td class="py-2">{formatLegiDate(v.dateFin)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="liens">
        <h2 id="liens" class="text-xl font-semibold">Liens LEGI</h2>
        <p class="mt-1 text-sm text-muted">
          Relations déclarées par la DILA (citations, modifications, créations, abrogations…). « Sortant » : cet article
          vers la cible ; « entrant » : la cible vers cet article.
        </p>
        {#if a.links.length === 0}
          <div class="mt-3"><EmptyState title="Aucun lien enregistré pour cette version." /></div>
        {:else}
          <div class="mt-3 overflow-x-auto">
            <table class="w-full min-w-[34rem] border-collapse text-left text-sm">
              <thead>
                <tr class="border-b border-line-strong">
                  <th scope="col" class="py-2 pr-3">Type</th>
                  <th scope="col" class="py-2 pr-3">Sens</th>
                  <th scope="col" class="py-2">Cible</th>
                </tr>
              </thead>
              <tbody>
                {#each a.links as l, i (i)}
                  <tr class="border-b border-line align-top">
                    <td class="py-2 pr-3">{linkTypeLabel(l.typeLien)} <span class="mono text-xs text-muted">{l.typeLien}</span></td>
                    <td class="py-2 pr-3">{l.sens === 'source' ? 'sortant' : l.sens === 'cible' ? 'entrant' : l.sens}</td>
                    <td class="py-2">
                      {#if l.label}<span class="block">{l.label}</span>{/if}
                      <span class="text-muted">
                        {[l.targetNature, l.targetTextNum, l.targetNum ? `art. ${l.targetNum}` : null, l.targetDate ? formatLegiDate(l.targetDate) : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      {#if l.targetId}
                        <span class="block">
                          {#if l.internal}
                            <a class="mono" href="/article/{l.targetId}">{l.targetId}</a>
                          {:else if data.targetLinks[l.targetId]}
                            <a class="mono" href={data.targetLinks[l.targetId]} rel="external">{l.targetId}</a>
                            <span class="text-muted">(Légifrance)</span>
                          {:else}
                            <span class="mono">{l.targetId}</span>
                          {/if}
                        </span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          {#if a.linksTruncated}<p class="mt-2 text-sm text-muted">Liste limitée aux {a.links.length} premiers liens.</p>{/if}
        {/if}
      </section>
    </div>

    <aside class="space-y-6">
      <section class="card p-4" aria-labelledby="niveau">
        <h2 id="niveau" class="text-lg font-semibold">Niveau de preuve</h2>
        <div class="mt-2"><LevelBadge level={a.level} flags={a.flags} /></div>
        <p class="mt-2 text-sm">{LEVEL_INFO[a.level].meaning}</p>
        {#if a.level === 'N0'}
          <p class="mt-2 text-sm text-muted">
            Aucune formalisation de cet article n’a encore passé de contrôle : seul le texte officiel est enregistré.
          </p>
        {/if}
        {#if a.levelUpdatedAt}<p class="mt-2 text-xs text-muted">Niveau mis à jour le {formatDateTime(a.levelUpdatedAt)}.</p>{/if}
        <p class="mt-2 text-sm"><a href="/methode#niveaux">L’échelle complète</a></p>
      </section>

      <section class="card p-4" aria-labelledby="couverture">
        <h2 id="couverture" class="text-lg font-semibold">Couverture par la recherche</h2>
        {#if a.coverage.length === 0}
          <p class="mt-2 text-sm text-muted">
            Aucune formalisation de référence connue (Inria, DGFiP…) ne cite cet article ou ses versions.
          </p>
        {:else}
          <ul class="mt-2 space-y-2 text-sm">
            {#each a.coverage as c (`${c.source}:${c.file}:${c.legiarti}`)}
              <li>
                <span class="font-semibold">{c.source}</span>
                <span class="mono text-xs text-muted">@{c.sourceCommit.slice(0, 12)}</span>
                <span class="block mono text-xs">{c.file}{c.line ? `:${c.line}` : ''}</span>
                {#if c.heading}<span class="block text-muted">{c.heading}</span>{/if}
                {#if c.legiarti !== a.id}<span class="block text-xs text-muted">cite la version {c.legiarti}</span>{/if}
              </li>
            {/each}
          </ul>
          <p class="mt-2 text-xs text-muted">
            Être cité par une formalisation de référence ne donne pas le niveau ★ : il faut aussi que sa suite de tests soit
            rejouée chez nous.
          </p>
        {/if}
      </section>

      <section class="card p-4" aria-labelledby="empreinte">
        <h2 id="empreinte" class="text-lg font-semibold">Identifiants et empreinte</h2>
        <dl class="mt-2 space-y-2 text-sm">
          <div><dt class="text-muted">LEGIARTI</dt><dd class="mono">{a.id}</dd></div>
          {#if a.type}<div><dt class="text-muted">Type LEGI</dt><dd class="mono">{a.type}</dd></div>{/if}
          <div>
            <dt class="text-muted">Empreinte <span class="mono">text_sha256</span></dt>
            <dd class="mono break-all text-xs">{a.textSha256}</dd>
          </div>
          <div><dt class="text-muted">Enregistré en base le</dt><dd>{formatDateTime(a.updatedAt)}</dd></div>
        </dl>
        <p class="mt-2 text-xs text-muted">
          SHA-256 du texte normalisé (balises retirées, espaces et guillemets unifiés). Toute modification du texte change
          l’empreinte : c’est ce qui permet de vérifier qu’une formalisation cite le texte à l’identique.
          <a href="/methode#empreinte">En savoir plus</a>
        </p>
      </section>
    </aside>
  </div>
</article>
