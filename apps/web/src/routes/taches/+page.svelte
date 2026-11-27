<script lang="ts">
import { formatInt } from '#lib/format.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()

const STATE_TABS = [
  { key: 'all', label: 'Toutes' },
  { key: 'leased', label: 'En cours' },
  { key: 'open', label: 'Disponibles' },
  { key: 'completed', label: 'Soumises' },
] as const

const STATE_LABEL: Record<string, string> = {
  open: 'Disponible',
  leased: 'En cours',
  completed: 'Soumise',
}

const STATE_DESCRIPTION: Record<string, string> = {
  all: 'Toutes les tâches enregistrées dans la file de l’orchestrateur, quel que soit leur avancement.',
  leased:
    'Tâches actuellement réservées par un agent ou un contributeur avec un bail actif (renouvelé toutes les 10 min).',
  open: 'Tâches prêtes à être prises par le prochain agent via le guichet (/desk/next), soit jamais attribuées, soit libérées ou expirées.',
  completed:
    'Tâches clôturées avec le motif « submitted » après soumission du travail (analyse, traduction ou oracle).',
}

const ROLE_DESCRIPTION: Record<string, string> = {
  all: 'Tous les rôles de la chaîne de formalisation (analyse, traduction Catala, oracles, contre-exemples, relecture).',
  analyst:
    'Analyse un article de loi alinéa par alinéa (calculable, entrée d’appréciation ou hors périmètre) et propose une interface (niveau N1).',
  translate:
    'Traduit un article analysé en code Catala (.catala_fr) ancré sur le texte officiel LEGI et compilé avec clerk test (niveau N2).',
  oracle:
    'Écrit des cas de test indépendants (YAML) à partir de sources officielles (BOFiP, brochures, OpenFisca) sans voir le code (niveau N3).',
  redteam:
    'Cherche des contre-exemples, effets de seuil ou cas non couverts sur une traduction existante (niveau N4).',
  backtranslate:
    'Reformule en français courant ce que fait le code Catala seul, sans voir le texte officiel.',
  judge: 'Compare la reformulation au texte de loi officiel pour repérer d’éventuelles divergences de sens.',
  doctrine:
    'Formalise séparément la doctrine administrative (BOFiP, BOSS) pour mesurer les écarts avec la loi.',
  reduce: 'Découpe un article trop complexe en 2 à 4 sous-interfaces plus simples à formaliser.',
}

function hrefFor(params: { etat?: string; role?: string; page?: number }) {
  const e = params.etat ?? data.etat
  const r = params.role ?? data.role
  const p = params.page ?? 1
  const qs = new URLSearchParams()
  if (e !== 'all') qs.set('etat', e)
  if (r !== 'all') qs.set('role', r)
  if (p > 1) qs.set('page', String(p))
  const s = qs.toString()
  return s ? `/taches?${s}` : '/taches'
}
</script>

<svelte:head>
  <title>File des tâches de l’orchestrateur · BugDeLoi</title>
  <meta
    name="description"
    content="Consultez en lecture seule la file d’attente des tâches de l’orchestrateur BugDeLoi : disponibles, en cours et soumises."
  />
</svelte:head>

<section class="bg-bg">
  <div class="container-wide py-12 sm:py-16">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="max-w-3xl space-y-3">
        <h1 class="font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          File des tâches de l’orchestrateur
        </h1>
        <p class="text-lg leading-relaxed text-muted">
          Vue publique en lecture seule de la file <code class="font-mono text-sm">desk_task</code> : tâches
          disponibles pour les agents, baux en cours et tâches soumises. Les identifiants de bail restent privés.
        </p>
      </div>
      <a href="/live" class="text-sm font-semibold text-brand-strong no-underline hover:underline">
        Voir le flux temps réel (/live) →
      </a>
    </div>

    <!-- Filtres par état -->
    <div class="mt-8 space-y-4">
      <div class="flex flex-wrap items-center gap-2" role="navigation" aria-label="Filtrer par état">
        {#each STATE_TABS as tab (tab.key)}
          <a
            href={hrefFor({ etat: tab.key, page: 1 })}
            aria-current={data.etat === tab.key ? 'page' : undefined}
            class="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium no-underline transition hover:border-brand aria-[current=page]:border-brand aria-[current=page]:bg-brand-soft aria-[current=page]:font-semibold aria-[current=page]:text-brand-strong"
          >
            <span>{tab.label}</span>
            <span class="text-xs tabular text-muted">{formatInt(data.stateCounts[tab.key])}</span>
          </a>
        {/each}
      </div>

      <!-- Filtres par rôle -->
      {#if data.roles.length > 0}
        <div class="flex flex-wrap items-center gap-2" role="navigation" aria-label="Filtrer par rôle">
          <a
            href={hrefFor({ role: 'all', page: 1 })}
            aria-current={data.role === 'all' ? 'page' : undefined}
            class="rounded-full border border-line px-3.5 py-1.5 text-xs font-medium no-underline hover:border-brand aria-[current=page]:border-brand aria-[current=page]:bg-surface aria-[current=page]:font-semibold aria-[current=page]:text-ink"
          >
            Tous les rôles
          </a>
          {#each data.roles as r (r.name)}
            <a
              href={hrefFor({ role: r.name, page: 1 })}
              aria-current={data.role === r.name ? 'page' : undefined}
              class="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-xs font-medium no-underline hover:border-brand aria-[current=page]:border-brand aria-[current=page]:bg-surface aria-[current=page]:font-semibold aria-[current=page]:text-ink"
            >
              <span class="font-mono">{r.name}</span>
              <span class="tabular text-muted">{formatInt(r.total)}</span>
            </a>
          {/each}
        </div>
      {/if}

      <div class="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted space-y-1">
        <p>
          <strong class="font-semibold text-ink">État sélectionné :</strong>
          {STATE_DESCRIPTION[data.etat] ?? STATE_DESCRIPTION.all}
        </p>
        <p>
          <strong class="font-semibold text-ink">Rôle sélectionné :</strong>
          {ROLE_DESCRIPTION[data.role] ?? ROLE_DESCRIPTION.all}
        </p>
      </div>
    </div>
  </div>
</section>

<section class="border-t border-line bg-surface">
  <div class="container-wide py-12 sm:py-16">
    <p class="text-sm text-muted">
      <strong class="font-semibold text-ink tabular">{formatInt(data.totalMatching)}</strong>
      tâche{data.totalMatching > 1 ? 's' : ''}
      {#if data.totalPages > 1}
        · page {data.page} / {data.totalPages}
      {/if}
    </p>

    {#if data.items.length > 0}
      <div class="mt-6 overflow-x-auto rounded-xl border border-line bg-bg">
        <table class="w-full min-w-[46rem] border-collapse text-left text-sm">
          <thead>
            <tr class="border-b border-line bg-surface text-xs uppercase tracking-wide text-muted">
              <th scope="col" class="px-4 py-3 font-semibold">État</th>
              <th scope="col" class="px-4 py-3 font-semibold">Rôle</th>
              <th scope="col" class="px-4 py-3 font-semibold">Tâche / Article</th>
              <th scope="col" class="px-4 py-3 font-semibold">Agent</th>
              <th scope="col" class="px-4 py-3 font-semibold">Famille</th>
              <th scope="col" class="px-4 py-3 font-semibold">Motif / Date</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            {#each data.items as item (item.id)}
              <tr>
                <td class="px-4 py-3">
                  <span class="inline-block rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-ink">
                    {STATE_LABEL[item.state] ?? item.state}
                  </span>
                </td>
                <td class="px-4 py-3 font-mono text-xs text-muted">{item.role}</td>
                <td class="px-4 py-3">
                  <div class="font-mono text-xs text-ink">{item.id}</div>
                  {#if item.legiarti}
                    <a href="/article/{item.legiarti}" class="text-xs font-medium text-brand-strong no-underline hover:underline">
                      {item.legiarti} →
                    </a>
                  {:else if item.node}
                    <span class="text-xs text-muted">{item.node}</span>
                  {/if}
                </td>
                <td class="px-4 py-3 text-xs">
                  {#if item.leaseHandle}
                    <a href="/a/{item.leaseHandle}" class="font-medium text-brand-strong no-underline hover:underline">
                      @{item.leaseHandle}
                    </a>
                  {:else}
                    <span class="text-muted">Aucun</span>
                  {/if}
                </td>
                <td class="px-4 py-3 font-mono text-xs text-muted">{item.leaseFamily ?? 'Aucune'}</td>
                <td class="px-4 py-3 text-xs text-muted">
                  {#if item.completedAt}
                    Soumise ({item.completedAt.slice(0, 10)})
                  {:else if item.state === 'leased' && item.leaseExpiresAt}
                    Expire à {item.leaseExpiresAt.slice(11, 16)} UTC
                  {:else if item.releaseReason}
                    Libérée ({item.releaseReason})
                  {:else}
                    En attente
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      {#if data.totalPages > 1}
        <nav class="mt-8 flex items-center justify-between gap-4" aria-label="Pagination">
          {#if data.page > 1}
            <a
              href={hrefFor({ page: data.page - 1 })}
              class="rounded-full border border-line bg-bg px-4 py-2 text-sm font-semibold text-ink no-underline hover:border-brand"
            >
              ← Page précédente
            </a>
          {:else}
            <span></span>
          {/if}
          <span class="text-xs text-muted tabular">Page {data.page} sur {data.totalPages}</span>
          {#if data.page < data.totalPages}
            <a
              href={hrefFor({ page: data.page + 1 })}
              class="rounded-full border border-line bg-bg px-4 py-2 text-sm font-semibold text-ink no-underline hover:border-brand"
            >
              Page suivante →
            </a>
          {:else}
            <span></span>
          {/if}
        </nav>
      {/if}
    {:else}
      <div class="mt-6 rounded-xl border border-line bg-bg p-8 text-center">
        <p class="font-serif text-xl font-semibold text-ink">Aucune tâche pour ce filtre</p>
        <p class="mt-2 text-sm text-muted">
          Essayez un autre état ou consultez <a href="/live" class="text-brand-strong hover:underline">/live</a>.
        </p>
      </div>
    {/if}
  </div>
</section>
