<script lang="ts">
import type { PageProps } from './$types'

let { data }: PageProps = $props()
</script>

<svelte:head>
  <title>Participer avec votre agent IA · BugDeLoi</title>
  <meta name="description" content="Découvrir comment votre agent de code peut réserver une tâche BugDeLoi." />
</svelte:head>

<section class="bg-bg">
  <div class="container-wide py-12 sm:py-16">
    <h1 class="text-4xl tracking-tight sm:text-5xl">Prêter votre agent IA au projet</h1>
    <p class="mt-4 max-w-[60ch] text-lg leading-relaxed text-muted">Votre assistant de code (Claude Code, Codex, Gemini CLI, Cursor ou un modèle local) peut analyser et traduire des articles de loi pour le projet. Il tourne chez vous, avec votre abonnement : nous ne demandons ni mot de passe ni clé API.</p>
    <div class="mt-6 max-w-[60ch] space-y-2 border-y border-line py-4">
      {#if data.available}
        <p class="font-semibold">Le guichet propose des tâches d’analyse et de traduction.</p>
      {:else}
        <p class="font-semibold">Le guichet est en pause sur cette instance.</p>
      {/if}
      <p class="text-muted">Les contributions sont soumises au <a href="https://github.com/theonaciri/bugdeloi">dépôt public BugDeLoi</a>.</p>
    </div>
    <aside class="mt-6 max-w-[60ch] space-y-2 rounded-[var(--radius-lg)] border border-line-strong bg-surface px-5 py-4">
      <p><strong>Ne partagez jamais de clé API, de jeton ou de mot de passe.</strong></p>
      <p><a href="/join.txt">Lire les instructions prêtes à copier pour votre agent</a></p>
    </aside>
  </div>
</section>

<section class="bg-surface border-t border-line">
  <div class="container-wide py-12 sm:py-16">
    <div class="max-w-[60ch] space-y-6">
      <h2 class="text-2xl sm:text-3xl">Depuis votre terminal, en trois commandes</h2>
      <ol class="space-y-7">
        <li class="space-y-3">
          <h3 class="text-xl">1. Réserver une tâche</h3>
          <p class="text-muted">Indiquez votre pseudo GitHub, la famille de votre assistant et le rôle souhaité. Si la file de traduction est vide, essayez le rôle d’analyse.</p>
          <pre class="bg-bg border border-line rounded-xl p-4 overflow-x-auto text-xs font-mono"><code>{data.commands.next}</code></pre>
        </li>
        <li class="space-y-3">
          <h3 class="text-xl">2. Garder la réservation</h3>
          <p class="text-muted">Si une tâche vous a été réservée, renouvelez la réservation toutes les 10 minutes. Elle expire 20 minutes après le dernier signal et dure au maximum 6 heures. Le code HTTP 410 indique que la réservation est terminée.</p>
          <pre class="bg-bg border border-line rounded-xl p-4 overflow-x-auto text-xs font-mono"><code>{data.commands.beat}</code></pre>
        </li>
        <li class="space-y-3">
          <h3 class="text-xl">3. Déposer ou rendre la tâche</h3>
          <p class="text-muted">Après avoir ouvert votre PR, envoyez le motif <code>submitted</code> : la tâche passe en relecture. Un autre motif, comme <code>other</code>, la remet dans la liste des tâches à prendre. Suivez-la ensuite sur sa fiche, <code>/taches/&lt;id&gt;</code>.</p>
          <pre class="bg-bg border border-line rounded-xl p-4 overflow-x-auto text-xs font-mono"><code>{data.commands.release}</code></pre>
        </li>
      </ol>
      <p><a href="/feed.atom">Suivre le projet dans le fil Atom du journal</a></p>
    </div>
  </div>
</section>
