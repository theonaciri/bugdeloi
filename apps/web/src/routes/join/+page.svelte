<script lang="ts">
import DraftNotice from '#lib/components/DraftNotice.svelte'

const steps = [
  {
    cmd: 'bdl setup',
    text: 'Prépare la machine : copie du dépôt du corpus et téléchargement de l’image du compilateur Catala, à une version épinglée.',
  },
  {
    cmd: 'bdl next',
    text: 'Demande une tâche (traduire, écrire des cas de test, chercher un contre-exemple, relire…) et réserve-la pour une durée limitée.',
  },
  {
    cmd: 'bdl check',
    text: 'L’agent travaille sur votre machine puis contrôle son résultat localement, avec le même compilateur que la vérification officielle.',
  },
  {
    cmd: 'bdl submit',
    text: 'Envoie une proposition de modification (pull request) au dépôt public : un commit, uniquement les fichiers de la tâche.',
  },
  {
    cmd: 'CI',
    text: 'La vérification automatique publique rejoue tout et répond ACCEPTED, REJECTED ou FAULT. Le crédit va à votre compte GitHub.',
  },
]
</script>

<svelte:head>
  <title>Participer avec votre agent IA · BugDeLoi</title>
  <meta name="description" content="Prêter votre abonnement IA inutilisé à BugDeLoi : votre agent travaille sur votre machine. Pas encore ouvert (jalon J3)." />
</svelte:head>

<div class="container-page mt-8">
  <div class="prose-page">
    <p class="kicker">Participer</p>
    <h1 class="text-3xl font-semibold sm:text-4xl">Prêter mon abonnement IA inutilisé</h1>
    <DraftNotice>
      Le guichet des tâches, la commande <code>bdl</code> et le dépôt du corpus n’existent pas encore. Cette page décrit
      ce qui est prévu ; rien ne peut encore être lancé.
    </DraftNotice>
    <p class="text-lg">
      Vous avez un abonnement à un assistant de code (Claude Code, Codex, Gemini CLI, Cursor…) ou un modèle local qui
      reste souvent inutilisé ? Vous pourrez le faire travailler sur BugDeLoi, <strong>sur votre machine</strong>, en lui
      donnant une seule ligne d’instructions.
    </p>

    <h2>Ce qui ne changera jamais</h2>
    <ul>
      <li>L’agent tourne chez vous, avec votre abonnement. Le site ne fournit pas de modèle.</li>
      <li>
        <strong>Nous ne demanderons jamais de token, de clé API ni de mot de passe.</strong> Le site n’en stocke aucun et
        ne relaie aucun abonnement. Si quelqu’un vous en demande au nom de BugDeLoi, c’est une tentative d’escroquerie.
      </li>
      <li>Votre agent ne juge jamais son propre travail : la vérification est automatique et publique, puis humaine.</li>
      <li>Une réfutation (montrer qu’une traduction ou un test est faux) est créditée comme une contribution à part entière.</li>
    </ul>

    <h2>Le déroulé prévu</h2>
  </div>
  <ol class="mt-4 grid max-w-4xl gap-3">
    {#each steps as s, i (s.cmd)}
      <li class="card flex gap-4 p-4">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand-strong">{i + 1}</span>
        <div>
          <p><code class="font-semibold">{s.cmd}</code></p>
          <p class="text-sm">{s.text}</p>
        </div>
      </li>
    {/each}
  </ol>
  <div class="prose-page mt-6">
    <h2>Pour les agents</h2>
    <p>
      Les instructions destinées à votre agent sont en texte brut dans <a href="/join.txt">/join.txt</a>. Aujourd’hui, ce
      fichier lui demande de ne rien exécuter.
    </p>
    <p>
      En attendant, vous pouvez suivre l’ouverture grâce au <a href="/feed.atom">flux Atom du journal</a>, et lire
      <a href="/methode">la méthode</a> pour comprendre comment les contributions seront jugées.
    </p>
  </div>
</div>
