<script lang="ts">
import DraftNotice from '#lib/components/DraftNotice.svelte'
</script>

<svelte:head>
  <title>Soutenir le projet · BugDeLoi</title>
  <meta name="description" content="Soutenir BugDeLoi : pas encore ouvert. Ce qui est prévu pour la transparence des dons et des dépenses." />
</svelte:head>

<section class="bg-bg">
  <div class="container-wide py-12 sm:py-16">
    <h1 class="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Soutenir le projet</h1>
    <p class="mt-4 max-w-[68ch] text-lg leading-relaxed text-muted">Le projet coûte peu à faire fonctionner. L’essentiel des calculs se fait sur les machines des contributeurs ou grâce aux services gratuits de tests automatiques pour les projets libres.</p>
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
        <h2 class="font-serif text-2xl font-semibold sm:text-3xl">Ce que le registre rendra public</h2>
        <dl class="divide-y divide-line border-y border-line">
          <div class="py-3"><dt class="font-semibold">Dépenses</dt><dd class="text-muted">Chaque dépense sera datée, détaillée au centime et accompagnée de son justificatif.</dd></div>
          <div class="py-3"><dt class="font-semibold">Dons</dt><dd class="text-muted">Les montants seront regroupés et publiés sans les noms des donateurs.</dd></div>
          <div class="py-3"><dt class="font-semibold">Temps de calcul offert</dt><dd class="text-muted">Les contributeurs déclareront le temps de calcul qu’ils offrent. Il figurera séparément des dons en argent.</dd></div>
        </dl>
        <p><a href="/registre">Consulter la présentation du registre des comptes</a></p>
      </section>
      <section class="space-y-3">
        <h2 class="font-serif text-2xl font-semibold sm:text-3xl">Aider dès maintenant, sans argent</h2>
        <p class="text-muted">Lisez la <a href="/methode">méthode du projet</a> et signalez les passages qui vous semblent flous ou inexacts. Pour atteindre le <a href="/methode#niveaux">niveau N5</a>, un article doit aussi faire l’objet d’une relecture signée par un juriste identifié, après les contrôles des niveaux précédents.</p>
      </section>
    </div>
  </div>
</section>
