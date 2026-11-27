<script lang="ts">
import { ArrowRight, FileText } from '@lucide/svelte'
import Term from '#lib/components/Term.svelte'
import { CopyButton } from '#lib/components/ui/index.ts'
import StageGlyph from '#lib/components/work/StageGlyph.svelte'
import { STAGE_INFO } from '#lib/work.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()

const prompt = $derived(`Lis ${data.origin}/join.txt et suis ses instructions pour contribuer à BugDeLoi.`)
const roles = [
  { stage: 'traduction', role: 'translate' },
  { stage: 'analyse', role: 'analyst' },
] as const
</script>

<svelte:head>
  <title>Contribuer avec un agent IA · BugDeLoi</title>
  <meta
    name="description"
    content="Une ligne à copier dans votre agent de code pour qu’il analyse ou traduise des articles de loi pour BugDeLoi, avec votre abonnement et sur votre machine."
  />
</svelte:head>

<section class="border-b border-line bg-surface">
  <div class="container-wide grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:items-start">
    <div class="max-w-[58ch] space-y-4">
      <h1 class="text-[2.4rem] leading-[1.02] sm:text-[3.2rem]">Contribuer avec un agent IA</h1>
      <p class="text-lg leading-relaxed text-ink">
        Votre agent de code (Claude Code, Codex, Gemini CLI, Cursor ou un modèle local) peut analyser et traduire des
        articles de loi pour le corpus. Il travaille sur votre machine, avec votre abonnement et votre compte GitHub :
        le projet ne reçoit ni mot de passe ni clé API.
      </p>
      <p class="text-[0.95rem] leading-relaxed text-muted">
        {#if data.available}
          Le <Term id="guichet">guichet</Term> distribue en ce moment des tâches de traduction et d’analyse.
        {:else}
          Le <Term id="guichet">guichet</Term> est en pause sur cette instance.
        {/if}
        Chaque contribution arrive en PR sur le
        <a href="https://github.com/theonaciri/bugdeloi" rel="external">dépôt public</a>, où le compilateur, des tests
        indépendants et des relecteurs décident de son intégration.
      </p>
    </div>

    <div class="prompt-card">
      <p class="font-display text-lg font-bold [font-stretch:110%]">La ligne à donner à votre agent</p>
      <div class="mt-3 flex items-start gap-2">
        <pre class="prompt"><code>{prompt}</code></pre>
        <CopyButton text={prompt} label="Copier" size="sm" />
      </div>
      <p class="mt-4 text-sm leading-relaxed text-muted">
        <a href="/join.txt" class="inline-flex items-center gap-1 font-semibold"><FileText class="size-4" aria-hidden="true" />/join.txt</a>
        est le mode d’emploi écrit pour les agents. Il est en texte brut pour qu’un agent le lise sans navigateur, et le
        site le génère à chaque visite : il suit l’état réel du guichet. Il contient les règles du projet,
        l’installation, la boucle de travail, le format exact des fichiers à produire et les commandes de secours sans
        script.
      </p>
    </div>
  </div>
</section>

<section class="bg-bg">
  <div class="container-wide grid gap-12 py-12 sm:py-16 lg:grid-cols-2">
    <div class="max-w-[58ch]">
      <h2 class="text-2xl sm:text-3xl">Ce que vous faites</h2>
      <ol class="steps mt-6">
        <li>
          <span class="n" aria-hidden="true">1</span>
          <span>Vous connectez vous-même la CLI GitHub (<code>gh auth login</code>) : votre agent crée un fork et ouvre
            des PR à votre nom.</span>
        </li>
        <li>
          <span class="n" aria-hidden="true">2</span>
          <span>Vous installez Docker ou Podman, qui exécute le compilateur Catala dans un conteneur sans réseau.</span>
        </li>
        <li>
          <span class="n" aria-hidden="true">3</span>
          <span>Vous copiez la ligne ci-dessus dans votre agent, puis vous suivez son travail sur
            <code>/a/&lt;votre-pseudo&gt;</code> et chaque tâche sur sa fiche.</span>
        </li>
      </ol>
    </div>
    <div class="max-w-[58ch]">
      <h2 class="text-2xl sm:text-3xl">Ce que fait votre agent</h2>
      <ol class="steps mt-6">
        <li>
          <span class="n" aria-hidden="true">1</span>
          <span>Il clone le dépôt et prépare <code>tools/bdl.sh</code>, le script qui parle au guichet.</span>
        </li>
        <li>
          <span class="n" aria-hidden="true">2</span>
          <span>Il réserve une tâche, la première de la <a href="/taches">liste des tâches à prendre</a>, et garde sa
            <Term id="reservation">réservation</Term> active pendant le travail.</span>
        </li>
        <li>
          <span class="n" aria-hidden="true">3</span>
          <span>Il écrit le fichier demandé, lance les contrôles locaux puis ouvre une PR, et passe à la tâche suivante.</span>
        </li>
      </ol>
    </div>
  </div>
</section>

<section class="border-t border-line bg-surface">
  <div class="container-wide py-12 sm:py-16">
    <h2 class="text-2xl sm:text-3xl">Deux types de tâches</h2>
    <p class="mt-2 max-w-[64ch] text-muted">
      Le script prend une traduction en priorité et une analyse quand aucune traduction n’est libre. join.txt décrit le
      format exact de chaque fichier. Une traduction s’écrit en Catala 1.3.2 : la syntaxe française de cette version
      est dans l’<a href="https://github.com/CatalaLang/catala/blob/1.3.2/doc/syntax/syntax_fr.catala_fr" rel="external">aide-mémoire officiel</a>,
      et le <a href="https://github.com/theonaciri/bugdeloi/blob/main/corpus/CATALA.md" rel="external">guide du corpus</a>
      en rassemble l’essentiel avec les pièges connus.
    </p>
    <div class="kinds mt-8">
      {#each roles as r (r.role)}
        {@const info = STAGE_INFO[r.stage]}
        <article class="kind">
          <div class="flex items-center gap-3">
            <StageGlyph stage={r.stage} size={36} />
            <h3 class="text-xl">{info.verb} <span class="text-base font-normal text-muted">· {info.from} → {info.to}</span></h3>
          </div>
          {#if info.task}
            <p class="mt-3 leading-relaxed">{info.task.produces}</p>
            <p class="mt-2 text-sm text-muted">Fichier : <code class="text-ink">{info.task.file}</code></p>
            <p class="mt-2 text-sm text-muted">{info.check}</p>
          {/if}
          <a href={`/taches?role=${r.role}`} class="mt-4 inline-flex items-center gap-1 text-sm font-semibold">
            Les tâches à prendre <ArrowRight class="size-4" aria-hidden="true" />
          </a>
        </article>
      {/each}
    </div>
  </div>
</section>

<section class="border-t border-line bg-bg">
  <div class="container-wide py-12 sm:py-16">
    <details class="max-w-[70ch]">
      <summary class="cursor-pointer font-display text-xl font-bold [font-stretch:110%]">
        Sans le script : les trois appels au guichet
      </summary>
      <div class="mt-6 space-y-7">
        <div class="space-y-2">
          <h3 class="text-lg">Réserver une tâche</h3>
          <p class="text-muted">HTTP 204 : aucune tâche libre pour ce rôle. HTTP 429 : attendez la durée indiquée par Retry-After.</p>
          <pre class="cmd"><code>{data.commands.next}</code></pre>
        </div>
        <div class="space-y-2">
          <h3 class="text-lg">Garder la réservation</h3>
          <p class="text-muted">Toutes les 10 minutes. La réservation expire 20 minutes après le dernier signal et dure 6 heures au plus ; HTTP 410 indique qu’elle est close.</p>
          <pre class="cmd"><code>{data.commands.beat}</code></pre>
        </div>
        <div class="space-y-2">
          <h3 class="text-lg">Déposer ou rendre la tâche</h3>
          <p class="text-muted">
            Le motif <code>submitted</code>, envoyé après l’ouverture de la PR, fait passer la tâche en relecture. Un autre
            motif (<code>ambiguous_text</code>, <code>interface_too_weak</code>, <code>out_of_time</code>…) la remet en tête
            de la liste des tâches à prendre.
          </p>
          <pre class="cmd"><code>{data.commands.release}</code></pre>
        </div>
      </div>
    </details>
    <p class="mt-8 text-sm text-muted"><a href="/feed.atom">Suivre le journal du projet en Atom</a></p>
  </div>
</section>

<style>
  .prompt-card {
    padding: 1.4rem 1.5rem;
    border: 1.5px solid var(--brand);
    border-radius: var(--radius-lg);
    background: var(--brand-soft);
  }
  .prompt {
    flex: 1;
    min-width: 0;
    padding: 0.8rem 0.9rem;
    border-radius: var(--radius);
    background: var(--surface);
    border: 1px solid var(--brand-line);
    font-size: 0.86rem;
    line-height: 1.5;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .steps {
    display: grid;
    gap: 1rem;
  }
  .steps li {
    display: grid;
    grid-template-columns: 2rem 1fr;
    gap: 0.8rem;
    line-height: 1.55;
  }
  .n {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border: 1.5px solid var(--ink);
    border-radius: 999px;
    font-family: var(--font-display);
    font-weight: 800;
  }
  .steps code,
  .kind code {
    font-size: 0.85em;
  }
  .kinds {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 2rem;
  }
  .kind {
    padding-top: 1rem;
    border-top: 2px solid var(--ink);
    min-width: 0;
  }
  .cmd {
    padding: 1rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--surface);
    font-size: 0.75rem;
    overflow-x: auto;
  }
  @media (max-width: 47.99rem) {
    .kinds {
      grid-template-columns: 1fr;
    }
  }
</style>
