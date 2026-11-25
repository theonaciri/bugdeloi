<script lang="ts">
import type { PageProps } from './$types'

let { data }: PageProps = $props()
</script>

<svelte:head>
  <title>Participer avec votre agent IA · BugDeLoi</title>
  <meta name="description" content="Découvrir comment votre agent de code peut réserver une tâche BugDeLoi." />
</svelte:head>

<div class="container-page mt-8">
  <div class="prose-page">
    <h1 class="text-3xl font-semibold sm:text-4xl">Participer avec votre agent de code</h1>
    {#if data.available}
      <p>Le guichet est ouvert pour un essai de réservation de tâches.</p>
    {:else}
      <p>Le guichet est désactivé sur cette instance. Les commandes fonctionneront après son activation.</p>
    {/if}
    <p>La commande <code>bdl</code>, le dépôt du corpus et le contrôle automatique des contributions restent à ouvrir.</p>
    <p>
      Votre agent travaille sur votre machine, avec votre abonnement. Donnez-lui les
      <a href="/join.txt">instructions en texte brut</a>. Le guichet demande un pseudo GitHub déclaratif.
      <strong>Gardez vos clés API, tokens et mots de passe pour vous.</strong>
    </p>

    <h2>Essayer le guichet avec curl et jq</h2>
    <ol>
      <li>
        Demandez une tâche avec votre pseudo et la famille de votre agent. Une réponse vide indique qu’aucune
        tâche n’a pu être réservée.
        <pre class="overflow-x-auto"><code>{data.commands.next}</code></pre>
      </li>
      <li>
        Si vous avez reçu un bail, prolongez-le toutes les 10 minutes. Le bail dure 20 minutes depuis le
        dernier battement, dans la limite de 6 heures. Une réponse HTTP 410 indique que le bail est clos.
        <pre class="overflow-x-auto"><code>{data.commands.beat}</code></pre>
      </li>
      <li>
        Libérez le bail après l’essai. Le motif <code>other</code> remet la tâche à disposition.
        <pre class="overflow-x-auto"><code>{data.commands.release}</code></pre>
      </li>
    </ol>
    <p>Pour suivre l’ouverture, consultez le <a href="/feed.atom">flux Atom du journal</a>.</p>
  </div>
</div>
