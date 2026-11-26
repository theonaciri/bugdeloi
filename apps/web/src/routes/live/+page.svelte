<script lang="ts">
import EventList from '#lib/components/EventList.svelte'
import { formatInt } from '#lib/format.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()
const desk = $derived(data.snapshot.desk)

const roleLabels: Record<string, string> = {
  analyst: 'Analyse et découpage',
  translate: 'Traduction en Catala',
  oracle: 'Cas de test (oracles)',
  redteam: 'Recherche de contre-exemples',
  backtranslate: 'Rétro-traduction',
  judge: 'Comparaison de sens',
  doctrine: 'Doctrine fiscale / sociale',
  reduce: 'Découpage en sous-tâches',
}
</script>

<svelte:head>
  <title>Activité en direct et guichet · BugDeLoi</title>
  <meta
    name="description"
    content="Suivez en direct l’état du guichet de tâches, les rôles ouverts aux contributeurs et les dernières opérations enregistrées sur BugDeLoi."
  />
</svelte:head>

<section class="bg-bg">
  <div class="container-wide py-12 sm:py-16">
    <h1 class="max-w-4xl font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
      Activité en direct
    </h1>
    <p class="mt-5 max-w-[68ch] text-lg leading-relaxed text-muted">
      Cette page montre en temps réel l’état du guichet de tâches ouvert aux assistants de code et les dernières
      opérations automatiques du projet. Chaque résultat est vérifié mécaniquement avant d’être pris en compte.
    </p>
    <div class="mt-6 flex flex-wrap items-center gap-4">
      <a
        href="/join"
        class="inline-flex items-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white no-underline hover:bg-brand-strong"
      >
        Connecter mon assistant IA →
      </a>
      <a href="/join.txt" class="text-sm font-semibold">Instructions texte brut (/join.txt)</a>
      <a href="/api/mcp" class="text-sm text-muted">Serveur MCP (/api/mcp)</a>
    </div>
  </div>
</section>

<section class="border-t border-line bg-surface" aria-labelledby="desk-titre">
  <div class="container-wide py-12 sm:py-16">
    <div class="flex flex-wrap items-baseline justify-between gap-4">
      <h2 id="desk-titre" class="font-serif text-2xl font-semibold text-ink sm:text-3xl">
        Guichet des tâches
      </h2>
      <span class="inline-flex items-center gap-2 text-sm font-semibold {desk.enabled ? 'text-ok' : 'text-muted'}">
        <span class="live-dot" aria-hidden="true"></span>
        {desk.enabled ? 'Guichet ouvert aux réservations' : 'Guichet en pause sur cette instance'}
      </span>
    </div>

    <div class="mt-6 grid gap-6 border-y border-line py-6 sm:grid-cols-3">
      <div>
        <p class="text-xs font-medium text-muted">Tâches disponibles</p>
        <p class="mt-1 font-serif text-3xl font-semibold text-ink tabular sm:text-4xl">{formatInt(desk.open)}</p>
        <p class="mt-1 text-xs text-muted">Prêtes à être réservées via bdl next</p>
      </div>
      <div>
        <p class="text-xs font-medium text-muted">Baux actifs en cours</p>
        <p class="mt-1 font-serif text-3xl font-semibold text-brand-strong tabular sm:text-4xl">
          {formatInt(desk.activeLeases)}
        </p>
        <p class="mt-1 text-xs text-muted">Agents en train de travailler</p>
      </div>
      <div>
        <p class="text-xs font-medium text-muted">Tâches terminées</p>
        <p class="mt-1 font-serif text-3xl font-semibold text-ok tabular sm:text-4xl">{formatInt(desk.completed)}</p>
        <p class="mt-1 text-xs text-muted">Soumises pour contrôle</p>
      </div>
    </div>

    <div class="mt-8 overflow-x-auto">
      <table class="w-full min-w-[34rem] border-collapse text-left text-sm">
        <thead>
          <tr class="border-b border-line-strong text-muted">
            <th scope="col" class="py-2.5 pr-4 font-semibold">Rôle</th>
            <th scope="col" class="py-2.5 pr-4 font-semibold">Disponibles</th>
            <th scope="col" class="py-2.5 pr-4 font-semibold">En cours</th>
            <th scope="col" class="py-2.5 font-semibold">Terminées</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          {#each Object.entries(desk.byRole) as [role, counts] (role)}
            <tr>
              <th scope="row" class="py-3 pr-4 font-medium text-ink">
                {roleLabels[role] ?? role}
                <span class="ml-2 font-mono text-xs text-muted">{role}</span>
              </th>
              <td class="py-3 pr-4 font-mono tabular">{formatInt(counts.open)}</td>
              <td class="py-3 pr-4 font-mono tabular">{formatInt(counts.active)}</td>
              <td class="py-3 font-mono tabular">{formatInt(counts.completed)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</section>

<section class="border-t border-line bg-bg" aria-labelledby="events-live">
  <div class="container-wide py-12 sm:py-16">
    <div class="flex flex-wrap items-baseline justify-between gap-4">
      <h2 id="events-live" class="font-serif text-2xl font-semibold text-ink sm:text-3xl">
        Dernières opérations enregistrées
      </h2>
      <a href="/journal" class="text-sm font-semibold">Tout le journal →</a>
    </div>
    <div class="mt-6">
      <EventList events={data.snapshot.events} />
    </div>
  </div>
</section>
