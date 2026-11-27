<script lang="ts">
import DraftNotice from '#lib/components/DraftNotice.svelte'
</script>

<svelte:head>
  <title>Registre des comptes · BugDeLoi</title>
  <meta name="description" content="Le registre public des dépenses, des dons et du calcul donné de BugDeLoi. Pas encore ouvert." />
</svelte:head>

<section class="bg-bg">
  <div class="container-wide py-12 sm:py-16">
    <h1 class="text-4xl tracking-tight sm:text-5xl">Registre des comptes</h1>
    <p class="mt-4 max-w-[68ch] text-lg leading-relaxed text-muted">Les coûts de fonctionnement du projet restent réduits. L’essentiel des calculs s’exécute sur les machines des contributeurs ou via les services d’intégration continue gratuits dédiés aux projets libres.</p>
    <div class="mt-6 max-w-[68ch]">
      <DraftNotice milestone="J6">
        Aucun moyen de paiement n’est ouvert. Ne versez rien à quiconque se réclamerait de BugDeLoi.
      </DraftNotice>
    </div>
  </div>
</section>

<section class="bg-surface border-t border-line">
  <div class="container-wide py-12 sm:py-16">
    <div class="max-w-[68ch] space-y-8">
      <section class="space-y-4">
        <h2 class="text-2xl sm:text-3xl">Ce que le registre rendra public</h2>
        <dl class="divide-y divide-line border-y border-line">
          <div class="py-3"><dt class="font-semibold">Dépenses</dt><dd class="text-muted">Chaque dépense sera datée, détaillée au centime et accompagnée de son justificatif.</dd></div>
          <div class="py-3"><dt class="font-semibold">Dons</dt><dd class="text-muted">Les montants seront regroupés et publiés sans les noms des donateurs.</dd></div>
          <div class="py-3"><dt class="font-semibold">Temps de calcul offert</dt><dd class="text-muted">Les contributeurs déclareront le temps de calcul qu’ils offrent. Il figurera séparément des dons en argent.</dd></div>
        </dl>
        <p>Le dépôt public du corpus conservera l’historique du registre. Cette page donnera accès aux justificatifs.</p>
      </section>
      <section class="space-y-3">
        <h2 class="text-2xl sm:text-3xl">Contribuer sans soutien financier</h2>
        <p class="text-muted">Consultez la <a href="/methode">méthode du projet</a> et signalez les passages imprécis ou inexacts. Pour atteindre le <a href="/methode#niveaux">niveau N5</a>, chaque article doit également faire l’objet d’une relecture signée par un juriste identifié, après validation des niveaux précédents.</p>
      </section>
    </div>
  </div>
</section>
