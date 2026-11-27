<script lang="ts">
import type { PageProps } from './$types'

let { data }: PageProps = $props()

const KIND_LABEL = {
  prescrit: 'Arrondi fixé par le texte',
  choisi: 'Arrondi choisi, texte muet',
  implicite: 'Arrondi implicite au centime',
} as const

const KIND_HELP = {
  prescrit: 'La traduction applique un arrondi que le texte impose, avec la citation au-dessus du code.',
  choisi:
    'Le texte ne fixe pas d’arrondi. La traduction a fait un choix et l’a écrit dans un « TODO juridique » pour la relecture.',
  implicite:
    'Un montant est multiplié ou divisé par un taux ou un décimal. Catala arrondit alors le résultat au centime. Aucune note d’arrondi n’accompagne le code.',
} as const

const KIND_MARK = { prescrit: '=', choisi: '?', implicite: '~' } as const

const total = $derived(data.byKind.prescrit + data.byKind.choisi + data.byKind.implicite)

const repo = 'https://github.com/theonaciri/bugdeloi/blob/main'
const scanner = `${repo}/apps/web/src/lib/server/rounding.ts`
const report = `${repo}/replications/c0.8-openfisca/REPORT.md`
const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
</script>

<svelte:head>
  <title>Points d’arrondi du corpus · BugDeLoi</title>
  <meta
    name="description"
    content="Les endroits où les traductions Catala de BugDeLoi arrondissent un montant, classés selon que le texte fixe l’arrondi ou non."
  />
</svelte:head>

<header class="bg-bg">
  <div class="container-wide space-y-5 py-12 sm:py-16">
    <p class="text-sm"><a href="/anomalies">← Retour aux anomalies</a></p>
    <h1 class="text-4xl tracking-tight sm:text-5xl">Points d’arrondi du corpus</h1>
    <p class="max-w-3xl font-display text-xl leading-relaxed text-ink/90">
      Cette page liste les endroits où nos traductions arrondissent un montant. Il ne s’agit pas d’anomalies. Elle
      montre où le résultat dépend d’un arrondi et si le texte de loi fixe cet arrondi.
    </p>
    <p class="max-w-3xl leading-relaxed text-muted">
      La liste est calculée à chaque déploiement par une
      <a href={scanner} rel="external">lecture mécanique des fichiers Catala</a>. Les cas de test sont ignorés. Pour
      chaque opération, l’écart dû à un arrondi au centime reste inférieur à 1 €. Un signalement
      <code>ARRONDI</code> suppose deux façons d’arrondir permises par le texte et un écart de plus de 1 € entre leurs
      résultats (<a href="/methode">méthode</a>).
    </p>
  </div>
</header>

<section class="border-t border-line bg-surface" aria-labelledby="categories">
  <div class="container-wide space-y-6 py-12 sm:py-16">
    <h2 id="categories" class="text-2xl sm:text-3xl">
      {total} points d’arrondi dans {data.files.length} fichiers
    </h2>
    <dl class="grid max-w-5xl gap-4 sm:grid-cols-3">
      {#each ['prescrit', 'choisi', 'implicite'] as const as kind (kind)}
        <div class="space-y-2 border-t border-line pt-4">
          <dt class="font-semibold">
            <span aria-hidden="true" class="mono mr-1 text-muted">{KIND_MARK[kind]}</span>{KIND_LABEL[kind]}
          </dt>
          <dd class="text-3xl">{data.byKind[kind]}</dd>
          <dd class="text-sm leading-relaxed text-muted">{KIND_HELP[kind]}</dd>
        </div>
      {/each}
    </dl>
  </div>
</section>

<section class="border-t border-line bg-bg" aria-labelledby="fichiers">
  <div class="container-wide space-y-8 py-12 sm:py-16">
    <h2 id="fichiers" class="text-2xl sm:text-3xl">Par fichier</h2>
    {#each data.files as entry (entry.file)}
      <article class="max-w-5xl space-y-3">
        <h3 class="mono text-sm [overflow-wrap:anywhere]">
          <a href="{repo}/corpus/{entry.file}" rel="external">{entry.file}</a>
        </h3>
        <ul class="divide-y divide-line border-y border-line">
          {#each entry.points as point (point.lines[0])}
            <li class="grid gap-2 py-4 sm:grid-cols-12">
              <div class="sm:col-span-4">
                <p class="text-sm font-semibold">
                  <span aria-hidden="true" class="mono mr-1 text-muted">{KIND_MARK[point.kind]}</span>{KIND_LABEL[
                    point.kind
                  ]}
                </p>
                {#if point.article}
                  <p class="text-sm">
                    <a href="/article/{point.article.legiarti}">Article {point.article.num}</a>
                  </p>
                {/if}
              </div>
              <div class="min-w-0 space-y-1 sm:col-span-8">
                <p class="text-sm">
                  {#if point.definition}<code>{point.definition}</code> ·{/if}
                  {point.lines.length > 1 ? 'lignes' : 'ligne'}
                  {#each point.lines as line, i (line)}{i > 0 ? ', ' : ''}<a
                      href="{repo}/corpus/{entry.file}#L{line}"
                      rel="external">{line}</a
                    >{/each}
                </p>
                <pre class="mono overflow-x-auto text-xs text-muted"><code>{point.code}</code></pre>
                {#if point.note}
                  <p class="text-sm leading-relaxed">{point.note}</p>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      </article>
    {/each}
  </div>
</section>

<section class="border-t border-line bg-surface" aria-labelledby="candidats">
  <div class="container-wide max-w-5xl space-y-5 py-12 sm:py-16">
    <h2 id="candidats" class="text-2xl sm:text-3xl">Ordre des arrondis comparé à OpenFisca</h2>
    <p class="max-w-3xl leading-relaxed text-muted">
      OpenFisca-France {data.openfiscaVersion} arrondit à l’euro avant la décote et sur la décote ; notre noyau
      arrondit en fin de calcul. L’impôt calculé diffère alors de 1 €, ce qui reste sous le seuil d’un signalement
      <code>ARRONDI</code>. Près du seuil de recouvrement de 61 € (CGI, art. 1657, 1 bis), ce même euro place l’impôt
      d’un côté ou de l’autre du seuil. C’est une observation mineure, pas une anomalie.
    </p>
    {#if data.candidates.length > 0}
      {#each data.candidates as candidate (candidate.motif)}
        <div class="space-y-3">
          <p>
            Impôt sur le revenu : {candidate.nombre} foyers concernés, tous près du seuil de
            61 €. <a href="/experiences/openfisca">Voir la comparaison</a> ou
            <a href={report}>le rapport complet</a>.
          </p>
          <div class="overflow-x-auto">
            <table class="text-sm">
              <caption class="sr-only">Exemples de foyers près du seuil de 61 €</caption>
              <thead>
                <tr>
                  <th scope="col" class="pr-6 text-left">Revenu</th>
                  <th scope="col" class="pr-6 text-left">Situation</th>
                  <th scope="col" class="pr-6 text-right">Impôt BugDeLoi</th>
                  <th scope="col" class="text-right">Impôt OpenFisca</th>
                </tr>
              </thead>
              <tbody>
                {#each candidate.exemples as example (`${example.revenu}-${example.situation}`)}
                  <tr>
                    <td class="pr-6">{euros.format(example.revenu)}</td>
                    <td class="pr-6">{example.situation}</td>
                    <td class="pr-6 text-right">{euros.format(example.bugdeloi)}</td>
                    <td class="text-right">{euros.format(example.openfisca)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/each}
    {:else}
      <p class="text-muted">Aucune différence d’ordre d’arrondi avec OpenFisca à ce jour.</p>
    {/if}
  </div>
</section>
