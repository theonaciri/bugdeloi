<script lang="ts">
import EmptyState from '#lib/components/EmptyState.svelte'
import LevelBadge from '#lib/components/LevelBadge.svelte'
import { etatLabel, formatDateTime, formatLegiDate, formatPeriod, linkTypeLabel } from '#lib/format.ts'
import { LEVEL_INFO } from '#lib/levels.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()
const a = $derived(data.article)
const title = $derived(a.num ? `Article ${a.num}` : a.id)
</script>

<svelte:head>
  <title>{title} · {a.text.short ?? a.text.title} · BugDeLoi</title>
  <meta name="description" content="{title} du {a.text.title} : texte officiel, historique des versions et état des vérifications." />
</svelte:head>

<article>
  <header class="bg-bg">
    <div class="container-wide space-y-5 py-12 sm:py-16">
      <nav aria-label="Fil d’Ariane" class="text-sm">
        <ol class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <li>
            {#if a.text.code}<a href="/carte?code={a.text.code}">{a.text.title}</a>{:else}{a.text.title}{/if}
          </li>
          {#each a.crumbs as c (c.id)}
            <li class="flex items-baseline gap-2">
              <span aria-hidden="true" class="text-muted">›</span>
              {#if a.text.code}<a href="/carte?code={a.text.code}&s={c.id}">{c.title}</a>{:else}{c.title}{/if}
            </li>
          {/each}
          <li class="flex items-baseline gap-2">
            <span aria-hidden="true" class="text-muted">›</span>
            <span aria-current="page" class="font-semibold">{title}</span>
          </li>
        </ol>
      </nav>

      <div class="space-y-3">
        <h1 class="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p class="font-serif text-xl leading-relaxed text-ink/90">{a.text.title}</p>
        <p class="text-muted">
          <strong class="text-ink">{etatLabel(a.etat)}</strong> · version applicable {formatPeriod(a.dateDebut, a.dateFin)}
        </p>
      </div>
      <p>
        <a href={data.legifrance} rel="external">Lire cet article sur Légifrance</a>
        <span class="text-sm text-muted">(seul le texte publié sur Légifrance fait foi).</span>
      </p>
    </div>
  </header>

  <div class="border-t border-line bg-surface">
    <div class="container-wide grid gap-12 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div class="min-w-0 space-y-12">
        <section aria-labelledby="texte">
          <h2 id="texte" class="font-serif text-2xl font-semibold sm:text-3xl">Texte officiel de l’article</h2>
          <p class="mt-1 text-sm text-muted">Texte issu des archives publiques de Légifrance, présenté sans mise en page complexe.</p>
          {#if data.contentSafe}
            <div class="legal-text mt-4 overflow-x-auto rounded-xl bg-bg p-6 sm:p-8">{@html data.contentSafe}</div>
          {:else}
            <div class="mt-3"><EmptyState title="Les archives ne contiennent pas de texte pour cette version." /></div>
          {/if}
          {#if data.notaSafe}
            <h3 class="mt-6 font-serif text-xl font-semibold">Nota</h3>
            <div class="legal-text mt-2 text-base">{@html data.notaSafe}</div>
          {/if}
        </section>

        <section aria-labelledby="versions">
          <h2 id="versions" class="font-serif text-2xl font-semibold sm:text-3xl">Historique des versions</h2>
          <p class="mt-1 text-sm text-muted">
            Quand le Parlement ou le gouvernement modifie un article, une nouvelle version datée est créée.
            Chaque version possède son propre identifiant officiel.
          </p>
          <div class="mt-3 overflow-x-auto">
            <table class="w-full min-w-[34rem] border-collapse text-left text-sm">
              <thead>
                <tr class="border-b border-line">
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
                    <td class="py-2 pr-3">{v.inDb ? etatLabel(v.etat) : 'Non disponible ici'}</td>
                    <td class="py-2 pr-3">{v.dateDebut ? formatLegiDate(v.dateDebut) : 'Date inconnue'}</td>
                    <td class="py-2">{v.dateFin ? formatLegiDate(v.dateFin) : 'Date inconnue'}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="liens">
          <h2 id="liens" class="font-serif text-2xl font-semibold sm:text-3xl">Articles liés</h2>
          <p class="mt-1 text-sm text-muted">
            Les textes de loi se citent et se modifient entre eux. « Cet article cite » indique un renvoi fait par cet
            article. « Cité par » indique qu’un autre texte fait référence à celui-ci.
          </p>
          {#if a.links.length === 0}
            <div class="mt-3"><EmptyState title="Aucun lien enregistré pour cette version." /></div>
          {:else}
            <div class="mt-3 overflow-x-auto">
              <table class="w-full min-w-[34rem] border-collapse text-left text-sm">
                <thead>
                  <tr class="border-b border-line">
                    <th scope="col" class="py-2 pr-3">Type</th>
                    <th scope="col" class="py-2 pr-3">Sens</th>
                    <th scope="col" class="py-2">Texte lié</th>
                  </tr>
                </thead>
                <tbody>
                  {#each a.links as l, i (i)}
                    <tr class="border-b border-line align-top">
                      <td class="py-2 pr-3">{linkTypeLabel(l.typeLien)}</td>
                      <td class="py-2 pr-3">{#if l.sens === 'source'}
                        {l.typeLien === 'CITATION' ? 'Cet article cite' : 'Depuis cet article'}
                      {:else if l.sens === 'cible'}
                        {l.typeLien === 'CITATION' ? 'Cité par' : 'Vers cet article'}
                      {:else}
                        Sens non précisé
                      {/if}</td>
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

      <aside class="min-w-0 space-y-8 lg:border-l lg:border-line lg:pl-8">
        <section class="space-y-3" aria-labelledby="niveau">
          <h2 id="niveau" class="font-serif text-xl font-semibold">Où en est la vérification ?</h2>
          <LevelBadge level={a.level} flags={a.flags} />
          {#if a.level === 'N0'}
            <p class="text-sm leading-relaxed text-muted">
              Seul le texte officiel est enregistré pour l’instant. Aucun programme de calcul ayant passé
              nos contrôles n’a encore été rattaché à cet article.
            </p>
          {:else}
            <p class="text-sm leading-relaxed text-muted">{LEVEL_INFO[a.level].meaning}</p>
          {/if}
          {#if a.levelUpdatedAt}<p class="text-xs text-muted">Niveau mis à jour le {formatDateTime(a.levelUpdatedAt)}.</p>{/if}
          <p class="text-sm"><a href="/methode#niveaux">Comprendre les niveaux de vérification</a></p>
        </section>

        <section class="space-y-3 border-t border-line pt-6" aria-labelledby="couverture">
          <h2 id="couverture" class="font-serif text-xl font-semibold">Déjà programmé par la recherche ?</h2>
          {#if a.level === 'REF'}
            <p class="text-sm leading-relaxed text-muted">
              Une équipe de recherche ou une administration a traduit cette version en programme. Ses tests
              automatiques réussissent dans notre environnement.
            </p>
          {:else if a.coverage.length === 0}
            <p class="text-sm leading-relaxed text-muted">
              Nous n’avons trouvé aucune mention de cet article ou de ses anciennes versions dans les programmes
              de recherche ou d’administrations publiques que nous suivons.
            </p>
          {:else}
            <p class="text-sm leading-relaxed text-muted">
              Des programmes de recherche ou d’administrations publiques citent cet article ou une de ses versions.
            </p>
          {/if}
          {#if a.coverage.length > 0}
            <ul class="divide-y divide-line text-sm">
              {#each a.coverage as c (`${c.source}:${c.file}:${c.legiarti}`)}
                <li class="py-2">
                  <span class="font-semibold">{c.source}</span>
                  <span class="mono text-xs text-muted">@{c.sourceCommit.slice(0, 12)}</span>
                  <span class="mono block wrap-anywhere text-xs">{c.file}{c.line ? `:${c.line}` : ''}</span>
                  {#if c.heading}<span class="block text-muted">{c.heading}</span>{/if}
                  {#if c.legiarti !== a.id}<span class="block text-xs text-muted">Cite la version {c.legiarti}</span>{/if}
                </li>
              {/each}
            </ul>
          {/if}
          <p class="text-sm leading-relaxed text-muted">
            L’étoile ★ indique que le programme met en code la version en vigueur et que sa suite de tests
            automatiques réussit chez nous. Une simple citation ne suffit pas.
          </p>
        </section>

        <section class="space-y-3 border-t border-line pt-6" aria-labelledby="empreinte">
          <h2 id="empreinte" class="font-serif text-xl font-semibold">Preuve d’authenticité technique</h2>
          <details class="text-sm">
            <summary class="cursor-pointer font-semibold">Afficher l’identifiant officiel et l’empreinte numérique</summary>
            <p class="mt-3 leading-relaxed text-muted">
              L’empreinte numérique SHA-256 fonctionne comme un scellé : si une virgule du texte change,
              l’empreinte change aussi. En comparant les empreintes, nous pouvons nous assurer que les programmes
              utilisent le même texte une fois sa mise en forme harmonisée.
            </p>
            <dl class="mt-4 space-y-3">
              <div><dt class="text-muted">Identifiant officiel (LEGIARTI)</dt><dd class="mono">{a.id}</dd></div>
              {#if a.type}<div><dt class="text-muted">Type LEGI</dt><dd class="mono">{a.type}</dd></div>{/if}
              <div>
                <dt class="text-muted">Empreinte SHA-256</dt>
                <dd class="mono break-all text-xs">{a.textSha256}</dd>
              </div>
              <div><dt class="text-muted">Dernière mise à jour en base</dt><dd>{formatDateTime(a.updatedAt)}</dd></div>
            </dl>
            <p class="mt-3"><a href="/methode#empreinte">Comment l’empreinte est calculée</a></p>
          </details>
        </section>
      </aside>
    </div>
  </div>
</article>
