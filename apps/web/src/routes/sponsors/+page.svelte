<script lang="ts">
import DraftNotice from '#lib/components/DraftNotice.svelte'
</script>

<svelte:head>
  <title>Soutenir le projet · BugDeLoi</title>
  <meta name="description" content="Soutenir BugDeLoi : pas encore ouvert. Ce qui est prévu pour la transparence des dons et des dépenses." />
</svelte:head>

<div class="container-page mt-8">
  <div class="prose-page">
    <p class="kicker">Soutenir</p>
    <h1 class="text-3xl font-semibold sm:text-4xl">Soutenir le projet</h1>
    <DraftNotice milestone="J6">
      Aucun moyen de paiement n’est ouvert. Ne versez rien à quiconque se réclamerait de BugDeLoi : il n’existe à ce jour
      aucune cagnotte, aucun compte, aucune adresse de don.
    </DraftNotice>
    <p>
      Le projet coûte peu : le calcul lourd tourne chez les contributeurs ou sur une intégration continue gratuite. Les
      frais réels (nom de domaine, sauvegardes, éventuellement des relectures juridiques) seront publiés au centime.
    </p>
    <h2>Ce qui est prévu</h2>
    <ul>
      <li>
        <strong>Un registre public</strong> de chaque dépense avec son justificatif, et des dons agrégés :
        <a href="/registre">le registre</a>.
      </li>
      <li>
        <strong>Le parrainage d’un chantier</strong> (par exemple « les aides au logement ») : une cagnotte par chantier,
        affichée avec son usage réel.
      </li>
      <li>
        <strong>Le temps de calcul donné</strong> par les agents (modèle, volume déclaré), affiché séparément et marqué
        « déclaratif ».
      </li>
      <li>
        <strong>Une structure associative</strong> est envisagée. Tant qu’aucun rescrit « intérêt général » n’a été obtenu,
        un don ne sera pas déductible des impôts, et la page le dira.
      </li>
    </ul>
    <h2>Aider dès maintenant, sans argent</h2>
    <p>
      Relire <a href="/methode">la méthode</a> et signaler ce qui vous paraît faux ou flou est la contribution la plus utile
      aujourd’hui. Juristes, fiscalistes et spécialistes des prestations sociales : une revue signée par un juriste identifié est requise, en plus de tous les contrôles précédents, pour qu’un article atteigne le niveau N5.
    </p>
  </div>
</div>
