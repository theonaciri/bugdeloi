<script lang="ts">
import { VERDICT_LABEL } from '@bugdeloi/core/findings'
import FlowDiagram from '#lib/components/FlowDiagram.svelte'
import { findingSteps } from '#lib/finding-guide.ts'
import { etatLabel, formatDateTime, formatLegiDate } from '#lib/format.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()
const item = $derived(data.finding)
const rejected = $derived(item.status === 'rejected')
const pending = $derived(item.status === 'candidate' || item.status === 'reproduced')
const title = $derived(item.type === 'SYNTAXE' ? 'Faute de ponctuation' : item.typeLabel)
const currentStep = $derived(findingSteps.findIndex((step) => step.status === item.status))
const otherArticles = $derived(
  item.articles.filter((article) => article.id !== item.source?.id && article.id !== item.target?.id),
)
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

<svelte:head>
  <title>{title} · {item.id} · BugDeLoi</title>
  <meta name="description" content="Le texte concerné, les contrôles effectués et l’état de la relecture humaine pour le dossier {item.id}." />
</svelte:head>

<article>
  <header class="bg-bg">
    <div class="container-wide space-y-5 py-12 sm:py-16">
      <p class="text-sm">
        <a href={rejected ? '/anomalies/cimetiere' : '/anomalies'}>
          {rejected ? '← Retour aux signalements écartés' : '← Retour aux anomalies'}
        </a>
      </p>
      <h1 class="text-4xl tracking-tight sm:text-5xl">{title}</h1>
      <p class="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-muted">
        <code class="text-sm">{item.id}</code>
        {#if rejected}
          <strong class="text-ink">Écarté par un juriste</strong>
        {:else if item.status === 'published'}
          <strong class="text-ink">Publié après verdict humain</strong>
        {:else if item.status === 'qualified'}
          <strong class="text-ink">Qualifié par un juriste</strong>
        {/if}
      </p>

      {#if pending}
        <div class="max-w-3xl space-y-1 rounded-xl bg-notice/70 p-5 text-notice-ink">
          <p class="font-semibold">En attente de qualification</p>
          <p class="text-sm leading-relaxed">
            {#if item.status === 'reproduced'}
              Deux programmes indépendants ont retrouvé ce signalement. Un juriste doit encore relire le texte et
              signer son verdict. Le signalement ne compte pas parmi les anomalies qualifiées.
            {:else}
              Un premier programme a repéré ce signalement. Un contrôle indépendant doit d’abord retrouver le résultat.
              Si ce contrôle le confirme, un juriste pourra examiner le dossier. Le signalement ne compte pas parmi
              les anomalies qualifiées.
            {/if}
          </p>
        </div>
      {/if}
    </div>
  </header>

  <div class="border-t border-line bg-surface">
    <div class="container-wide space-y-12 py-12 sm:py-16">
      <section class="max-w-3xl space-y-4" aria-labelledby="constat">
        <h2 id="constat" class="text-2xl sm:text-3xl">Ce que le programme a repéré</h2>
        {#if item.type === 'REF_MORTE'}
          <p class="leading-relaxed">Un article en vigueur renvoie à un article que le programme a identifié comme abrogé à la date du contrôle.</p>
          <FlowDiagram
            title="Le renvoi signalé"
            description={`${articleLabel(item.source, 'L’article qui fait le renvoi')} cite ${articleLabel(item.target, 'l’article cité')}.`}
            from={articleLabel(item.source, 'Article source')}
            to={articleLabel(item.target, 'Article cité')}
            relation="Cite"
            detail={abrogation}
          />
          <p class="leading-relaxed text-muted">
            Un renvoi à un ancien texte peut être volontaire. Une règle de transition peut, par exemple, maintenir
            les anciennes règles pour certaines situations. Un juriste examine le contexte du renvoi pour trancher.
          </p>
          <details class="text-sm">
            <summary class="cursor-pointer font-semibold">Afficher le signalement enregistré par le programme</summary>
            <p class="mt-2 leading-relaxed">{item.claim}</p>
          </details>
        {:else}
          <p class="leading-relaxed">{item.claim}</p>
        {/if}
      </section>

      <section class="space-y-4 border-t border-line pt-8" aria-labelledby="verification">
        <h2 id="verification" class="text-2xl sm:text-3xl">Où en sont les contrôles ?</h2>
        <ol class="grid border-y border-line sm:grid-cols-2 lg:grid-cols-4" aria-label="Étapes de vérification du signalement">
          {#each findingSteps as step, index (step.status)}
            {@const reached = rejected ? index < 2 : index < currentStep}
            {@const active = item.status === step.status}
            <li
              class="border-line px-4 py-4 max-sm:border-b max-sm:last:border-b-0 sm:border-l sm:nth-[odd]:border-l-0 lg:nth-[odd]:border-l lg:first:border-l-0 {active ? 'bg-brand-soft' : ''}"
              aria-current={active ? 'step' : undefined}
            >
              <p class="font-semibold">{step.term}</p>
              <p class="mt-1 text-xs {active ? 'font-semibold text-brand-strong' : 'text-muted'}">
                {active ? 'Étape actuelle' : reached ? 'Étape terminée' : rejected ? 'Étape non atteinte' : 'Étape à venir'}
              </p>
              <p class="mt-2 text-sm leading-relaxed">{step.definition}</p>
            </li>
          {/each}
        </ol>
        {#if rejected}
          <p class="text-sm text-muted">Un juriste a écarté le signalement. <a href="#verdict">Lire son motif</a>.</p>
        {:else if item.humanQualified}
          <p class="text-sm"><a href="#verdict">Lire le verdict du juriste</a></p>
        {/if}
      </section>

      <section class="max-w-3xl space-y-4" aria-labelledby="passage">
        <h2 id="passage" class="text-2xl sm:text-3xl">Passage exact du texte de loi</h2>
        {#if item.excerpts.length > 0}
          <p class="text-sm leading-relaxed text-muted">Le surlignage montre le passage relevé par le programme dans les extraits du certificat.</p>
          {#each item.excerpts as excerpt}
            <blockquote class="wrap-anywhere whitespace-pre-wrap rounded-xl bg-bg p-5 font-law text-lg leading-relaxed">{excerpt.before}<mark class="rounded bg-notice text-notice-ink">{excerpt.marked}</mark>{excerpt.after}</blockquote>
          {/each}
        {:else}
          <p class="text-muted">Le dossier ne contient pas d’extrait. Les liens vers Légifrance ci-dessous donnent accès aux textes concernés.</p>
        {/if}
        {#if item.hints.length}
          <h3 class="text-xl">Mots et expressions à examiner</h3>
          <p class="text-sm leading-relaxed text-muted">Ces expressions proches du passage peuvent aider à comprendre le contexte du signalement.</p>
          <ul class="list-disc space-y-1 ps-5">
            {#each item.hints as hint}<li>« {hint} »</li>{/each}
          </ul>
        {/if}
      </section>

      <section class="max-w-4xl space-y-4 border-t border-line pt-8" aria-labelledby="articles">
        <h2 id="articles" class="text-2xl sm:text-3xl">Articles concernés</h2>
        {#if item.projectionDate}
          <p class="text-sm text-muted">Textes en vigueur examinés à la date du {formatLegiDate(item.projectionDate)}.</p>
        {/if}
        {#if item.source || item.target}
          <div class="grid gap-y-5 {item.source && item.target ? 'sm:grid-cols-2 sm:divide-x sm:divide-line' : ''}">
            {@render version(item.type === 'REF_MORTE' ? 'Article qui fait le renvoi' : 'Article signalé', item.source)}
            {@render version('Article cité (dernière version connue)', item.target, Boolean(item.source))}
          </div>
        {/if}
        {#if otherArticles.length}
          <ul aria-label="Versions d’articles sur Légifrance" class="space-y-2 text-sm">
            {#each otherArticles as article (article.id)}
              <li>
                <a href={article.url} rel="external">{article.id} sur Légifrance</a>{#if article.dateDebut} · version du {formatLegiDate(article.dateDebut)}{/if}
              </li>
            {/each}
          </ul>
        {:else if !item.source && !item.target}
          <p class="text-sm text-muted">Aucune référence d’article n’est disponible pour ce dossier.</p>
        {/if}
      </section>

      <div class="grid gap-8 border-t border-line pt-8 lg:grid-cols-2">
        <section class="min-w-0 space-y-3" aria-labelledby="controle-independant">
          <h2 id="controle-independant" class="text-2xl sm:text-3xl">Contrôle indépendant</h2>
          <p class="leading-relaxed text-muted">
            Un second programme examine les archives séparément pour voir s’il retrouve le même signalement.
          </p>
          {#if typeof item.reproduction.verdict === 'string'}
            <p class="font-semibold">
              {item.reproduction.verdict === 'confirmé'
                ? 'Le second programme a retrouvé le même résultat.'
                : `Résultat enregistré : ${item.reproduction.verdict}`}
            </p>
            <dl class="space-y-2 text-sm">
              {#if typeof item.reproduction.source === 'string'}
                <div><dt class="text-muted">Source du contrôle</dt><dd class="wrap-anywhere">{item.reproduction.source}</dd></div>
              {/if}
              {#if typeof item.reproduction.checked_at === 'string'}
                <div><dt class="text-muted">Date du contrôle</dt><dd>{formatDateTime(item.reproduction.checked_at)}</dd></div>
              {/if}
            </dl>
          {:else}
            <p class="text-sm text-muted">Le résultat de ce contrôle ne figure pas encore dans le dossier.</p>
          {/if}
        </section>

        <section class="min-w-0 space-y-3 border-t border-line pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0" aria-labelledby="verdict">
          <h2 id="verdict" class="text-2xl sm:text-3xl">Verdict humain</h2>
          {#if item.qualification}
            <p class="text-sm">
              <strong>{VERDICT_LABEL[item.qualification.verdict]}</strong> · @{item.qualification.reviewer} ·
              <time datetime={item.qualification.qualified_at}>{formatDateTime(item.qualification.qualified_at)}</time>
            </p>
            <p class="whitespace-pre-wrap leading-relaxed">{item.qualification.note}</p>
            <p class="text-sm"><a href="https://github.com/theonaciri/bugdeloi/commit/{item.qualification.commit}" rel="external">Consulter le verdict signé sur GitHub</a></p>
          {:else if pending}
            <p class="leading-relaxed text-muted">Un juriste doit encore déterminer si le signalement correspond à un défaut du texte, à une lacune ou à un choix volontaire.</p>
          {:else}
            <p class="text-muted">Le détail du verdict est indisponible dans ce dossier.</p>
          {/if}
        </section>
      </div>
    </div>
  </div>

  <section class="border-t border-line bg-bg" aria-labelledby="donnees-techniques">
    <div class="container-wide space-y-4 py-12 sm:py-16">
      <h2 id="donnees-techniques" class="text-2xl sm:text-3xl">Données techniques et reproductibilité</h2>
      <p class="max-w-3xl leading-relaxed text-muted">
        Le certificat regroupe les données et les versions utilisées pour le contrôle. La commande permet de relancer ce contrôle.
      </p>
      <div class="divide-y divide-line border-y border-line">
        <details class="py-4">
          <summary class="cursor-pointer font-semibold">Afficher la commande pour relancer le contrôle</summary>
          {#if item.replay}
            <pre class="mt-3 wrap-anywhere whitespace-pre-wrap rounded-xl bg-surface p-4 text-sm"><code>{item.replay}</code></pre>
          {:else}
            <p class="mt-3 text-sm text-muted">Le certificat ne contient aucune commande.</p>
          {/if}
        </details>
        <details class="py-4">
          <summary class="cursor-pointer font-semibold">Afficher le certificat complet (JSON)</summary>
          <pre class="mt-3 wrap-anywhere whitespace-pre-wrap rounded-xl bg-surface p-4 text-sm"><code>{item.certificate}</code></pre>
        </details>
      </div>
    </div>
  </section>
</article>

{#snippet version(label: string, ref: typeof item.source, separated = false)}
  {#if ref}
    <div class="min-w-0 space-y-2 pr-5 {separated ? 'sm:pl-5' : ''}">
      <h3 class="text-xl">{label}</h3>
      <p>
        {#if ref.code || ref.num}
          <strong>{[ref.code, ref.num ? `Article ${ref.num}` : null].filter(Boolean).join(' · ')}</strong>
        {:else}
          <strong>{ref.id}</strong>
        {/if}
      </p>
      <p class="text-sm">
        <a href={ref.url} target="_blank" rel="external noopener">Lire l’article sur Légifrance</a>
      </p>
      <dl class="space-y-1 text-sm">
        <div><dt class="inline text-muted">État.</dt> <dd class="inline">{etatLabel(ref.etat)}</dd></div>
        <div><dt class="inline text-muted">Début de la version.</dt> <dd class="inline">{ref.dateDebut ? formatLegiDate(ref.dateDebut) : 'Date inconnue'}</dd></div>
        <div><dt class="inline text-muted">Fin de la version.</dt> <dd class="inline">{ref.dateFin ? formatLegiDate(ref.dateFin) : 'Date inconnue'}</dd></div>
      </dl>
    </div>
  {/if}
{/snippet}
