<script lang="ts">
import { formatDateTime, formatInt } from '#lib/format.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()

const roleLabels: Record<(typeof data.tasks)[number]['role'], string> = {
  analyst: 'Analyse et découpage',
  translate: 'Traduction en Catala',
  oracle: 'Cas de test (oracles)',
  redteam: 'Recherche de contre-exemples',
  backtranslate: 'Rétro-traduction',
  judge: 'Comparaison de sens',
  doctrine: 'Doctrine fiscale ou sociale',
  reduce: 'Découpage en sous-tâches',
}
</script>

<svelte:head>
  <title>@{data.handle} · BugDeLoi</title>
  <meta name="description" content="Les dernières tâches réservées par @{data.handle} sur BugDeLoi." />
</svelte:head>

<section class="bg-bg">
  <div class="container-wide py-12 sm:py-16">
    <a href="/live" class="text-sm font-semibold text-brand-strong">← Activité en direct</a>
    <h1 class="mt-5 wrap-anywhere text-4xl tracking-tight text-ink sm:text-5xl">
      @{data.handle}
    </h1>
    {#if data.families.length > 0}
      <p class="mt-3 text-sm text-muted">Familles de modèles déclarées : {data.families.join(', ')}</p>
    {/if}

    {#if data.tasks.length > 0}
      <dl class="mt-8 grid grid-cols-1 gap-5 border-y border-line py-5 sm:grid-cols-3">
        <div>
          <dt class="text-sm text-muted">Baux actifs</dt>
          <dd class="mt-1 font-display text-3xl font-semibold text-brand-strong tabular">{formatInt(data.counts.active)}</dd>
        </div>
        <div>
          <dt class="text-sm text-muted">Tâches déposées</dt>
          <dd class="mt-1 font-display text-3xl font-semibold text-ink tabular">{formatInt(data.counts.completed)}</dd>
        </div>
        <div>
          <dt class="text-sm text-muted">Tâches réservées au total</dt>
          <dd class="mt-1 font-display text-3xl font-semibold text-ink tabular">{formatInt(data.counts.total)}</dd>
        </div>
      </dl>
      <a href="#calcul-des-compteurs" class="mt-3 inline-block text-sm text-brand-strong">Calcul des compteurs</a>
    {/if}
  </div>
</section>

<section class="border-t border-line bg-surface" aria-labelledby="taches-recentes">
  <div class="container-wide py-10 sm:py-12">
    <h2 id="taches-recentes" class="text-2xl text-ink sm:text-3xl">Tâches récentes</h2>
    {#if data.tasks.length > 0}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (Défilement horizontal du tableau au clavier.) -->
      <div class="mt-5 overflow-x-auto rounded-lg border border-line bg-bg" role="region" aria-labelledby="taches-recentes" tabindex="0">
        <table class="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead class="border-b border-line bg-surface text-muted">
            <tr>
              <th scope="col" class="px-4 py-3 font-semibold">Statut (fiche de la tâche)</th>
              <th scope="col" class="px-4 py-3 font-semibold">Rôle</th>
              <th scope="col" class="px-4 py-3 font-semibold">Article ciblé</th>
              <th scope="col" class="px-4 py-3 font-semibold">Prise de tâche</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            {#each data.tasks as task (task.id)}
              <tr>
                <td class="whitespace-nowrap px-4 py-3 font-medium {task.status === 'En cours' ? 'text-brand-strong' : 'text-ink'}">
                  <a href="/taches/{task.id}" class="text-inherit">{task.status}</a>
                </td>
                <td class="px-4 py-3 text-ink">{roleLabels[task.role] ?? task.role}</td>
                <td class="px-4 py-3">
                  {#if task.legiarti}
                    <a href="/article/{task.legiarti}" class="font-medium text-brand-strong">
                      {task.node || task.legiarti}
                    </a>
                  {:else}
                    <span class="text-muted">{task.node || 'Article non renseigné'}</span>
                  {/if}
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-muted tabular">
                  {#if task.startedAt}
                    <time datetime={task.startedAt}>{formatDateTime(task.startedAt)}</time>
                  {:else}
                    Date inconnue
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p id="calcul-des-compteurs" class="mt-5 max-w-[70ch] text-sm leading-relaxed text-muted">
        Le guichet conserve la dernière réservation de chaque tâche. Les compteurs incluent toutes les tâches encore
        associées à @{data.handle}, et le tableau affiche les 50 plus récentes. Un bail reste actif jusqu’à son
        expiration ou sa libération. Une tâche passe au statut « Déposée » lorsque son titulaire déclare sa proposition
        en relecture. Le statut « Libérée » inclut également les baux expirés.
      </p>
    {:else}
      <p class="mt-4 text-muted">Aucune tâche n’est encore enregistrée pour @{data.handle}.</p>
      <div class="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-brand-strong">
        <a href="/join">Participer au projet</a>
        <a href="/live">Suivre l’activité du guichet</a>
      </div>
    {/if}
  </div>
</section>
