<script lang="ts">
import DraftNotice from '#lib/components/DraftNotice.svelte'
</script>

<svelte:head>
  <title>Registre des comptes · BugDeLoi</title>
  <meta name="description" content="Le registre public des dépenses, des dons et du calcul donné de BugDeLoi. Pas encore ouvert." />
</svelte:head>

<div class="container-page mt-8">
  <div class="prose-page">
    <p class="kicker">Transparence</p>
    <h1 class="text-3xl font-semibold sm:text-4xl">Registre des comptes</h1>
    <DraftNotice milestone="J6">
      Le registre n’est pas encore publié. Aucun moyen de paiement n’étant ouvert, ce site n’a reçu aucun don.
    </DraftNotice>
    <h2>Ce que contiendra le registre</h2>
    <ul>
      <li><strong>Chaque dépense</strong>, datée, avec son objet et son justificatif.</li>
      <li><strong>Les dons</strong>, agrégés (jamais d’identité de donateur sans accord explicite).</li>
      <li>
        <strong>Le calcul donné</strong> par les contributeurs (modèle, volume de jetons), converti en équivalent euros et
        marqué « déclaratif », car nous ne pouvons pas le contrôler.
      </li>
    </ul>
    <h2>Où il vivra</h2>
    <p>
      Dans un dossier versionné du dépôt public du corpus : chaque ligne sera un commit, l’historique ne pourra pas être
      réécrit sans que cela se voie. Cette page en affichera le contenu, avec un lien vers chaque justificatif.
    </p>
    <p>Voir aussi <a href="/sponsors">Soutenir le projet</a>.</p>
  </div>
</div>
