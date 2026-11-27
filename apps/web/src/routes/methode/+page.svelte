<script lang="ts">
import { FINDING_TYPE_LABEL, FINDING_TYPES } from '@bugdeloi/core/findings'
import LevelSwatch from '#lib/components/LevelSwatch.svelte'
import { formatInt } from '#lib/format.ts'
import { LEVELS, type Level, levelName } from '#lib/levels.ts'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()

const levelDescriptions: Record<Level, string> = {
  N0: 'Nous avons enregistré le texte officiel, son identifiant, les dates de sa version et son empreinte numérique.',
  N1: 'L’article est analysé alinéa par alinéa (calculable, entrée d’appréciation ou hors périmètre) avec son empreinte LEGI vérifiée et une interface proposée avant traduction Catala.',
  N2: 'Le fichier cite le texte officiel à l’identique, respecte les règles du langage Catala et passe tous ses tests avec la version prévue de l’outil. Chaque montant, taux ou seuil renvoie au passage qui le fixe.',
  N3: 'Le programme donne les résultats attendus pour tous les cas testés, sans règles contradictoires ni situation laissée sans réponse. Les réponses viennent d’au moins deux sources indépendantes, dont au moins une sans IA. Toute IA qui prépare ces réponses vient d’un autre fournisseur que celle qui a traduit le texte.',
  N4: 'Au moins 10 000 cas, dont les seuils testés à 1 € de part et d’autre, sont comparés à un programme indépendant. Tous les écarts sont expliqués. Les tests repèrent au moins 80 % des erreurs introduites volontairement. Une reformulation faite à partir du code seul est jugée équivalente au texte officiel par une troisième famille d’IA. Pendant sept jours de recherche ouverte d’erreurs, aucun contre-exemple n’est retenu.',
  N5: 'En plus de tous les contrôles précédents, un juriste identifié relit les choix d’interprétation et signe sa revue.',
  REF: 'La version en vigueur figure dans un programme écrit par des chercheurs ou une administration. Leur suite contient au moins un test et sa dernière exécution chez nous a réussi. L’étoile signale un travail extérieur à BugDeLoi.',
}

const lifecycle = [
  {
    label: 'Candidat',
    text: 'Un programme de détection ou une personne signale un problème possible. Le constat doit encore être confirmé.',
  },
  {
    label: 'Reproduit',
    text: 'Un second programme indépendant confirme le constat à partir d’archives traitées séparément. La fiche conserve les sources, leurs versions et le résultat du contrôle. L’exécution automatique et publique du contrôle reste à mettre en place.',
  },
  {
    label: 'Qualifié',
    text: 'Une personne relit le dossier et conclut à un défaut du texte ou à une lacune. Son verdict motivé est enregistré publiquement et horodaté dans l’historique du projet. La fiche renvoie à cet enregistrement.',
  },
  {
    label: 'Publié',
    text: 'La fiche est consultable dans le registre dès la qualification. La publication inscrit ensuite le constat au journal public.',
  },
]

const verdicts = [
  { label: 'Défaut du texte', text: 'La relecture relève un défaut dans le texte officiel.' },
  { label: 'Lacune', text: 'La relecture relève une situation que le texte laisse sans réponse.' },
  {
    label: 'Choix assumé',
    text: 'Le texte prévoit délibérément cette règle, par exemple un renvoi à une ancienne version.',
  },
  {
    label: 'Erreur de notre part',
    text: 'Le problème vient de notre lecture, de nos données ou de notre outil de détection.',
  },
  {
    label: 'Non pertinent',
    text: 'La personne qui relit explique pourquoi le signalement ne relève pas d’une anomalie à retenir.',
  },
]
</script>

<svelte:head>
  <title>Notre méthode et nos limites · BugDeLoi</title>
  <meta name="description" content="Découvrez comment BugDeLoi contrôle ses traductions de la loi, examine les signalements et calcule les chiffres du site." />
</svelte:head>

<header class="bg-bg">
  <div class="container-wide space-y-6 py-12 sm:py-16">
    <h1 class="font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl">Notre méthode et nos limites</h1>
    <p class="max-w-3xl text-lg leading-relaxed text-muted">
      Notre règle est simple : on ne croit jamais une intelligence artificielle sur parole. Les IA aident à lire et
      traduire les articles de loi en formules de calcul. Seuls des tests automatiques, des sources indépendantes et
      des juristes peuvent valider un résultat.
    </p>
    <nav aria-label="Sur cette page">
      <ul class="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold">
        <li><a href="#niveaux">Échelle de vérification</a></li>
        <li><a href="#anomalies">Anomalies</a></li>
        <li><a href="#compteurs">Calcul des compteurs</a></li>
        <li><a href="#limites">Ce que nous ne prétendons pas</a></li>
        <li><a href="#faq">Questions fréquentes</a></li>
      </ul>
    </nav>
  </div>
</header>

<section class="border-t border-line bg-surface" aria-labelledby="niveaux">
  <div class="container-wide space-y-6 py-12 sm:py-16">
    <h2 id="niveaux" class="scroll-mt-24 font-serif text-3xl font-semibold text-ink sm:text-4xl">L’échelle des niveaux de preuve</h2>
    <p class="max-w-3xl leading-relaxed text-muted">
      Chaque niveau indique un contrôle accompli et s’ajoute aux précédents. Pour atteindre N3, il faut avoir passé
      N2, qui exige lui-même N1. Chaque passage repose sur un contrôle effectué par un programme ou, pour N5, sur
      une revue signée par un juriste. L’avis d’une IA ne fait franchir aucun niveau.
    </p>
    <ol class="max-w-4xl divide-y divide-line border-y border-line">
      {#each LEVELS as level (level)}
        <li class="flex items-start gap-4 py-4">
          <div class="shrink-0"><LevelSwatch {level} size={36} /></div>
          <div class="space-y-1">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="text-lg font-semibold text-ink">{levelName(level)}</h3>
              <a
                href="/travail?niveau={level}"
                class="text-xs font-semibold text-brand-strong no-underline hover:underline tabular"
              >
                Voir les {formatInt(data.counts[level])} articles →
              </a>
            </div>
            <p class="leading-relaxed text-muted">{levelDescriptions[level]}</p>
          </div>
        </li>
      {/each}
    </ol>
    <div class="max-w-4xl rounded-xl border border-line bg-surface p-5 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-base font-semibold text-ink">
          Répartition des analyses (niveau N1) · <span class="tabular">{formatInt(data.analyses.total)}</span> fiches
        </h3>
        <a href="/travail?niveau=analyses" class="text-xs font-semibold text-brand-strong no-underline hover:underline">
          Parcourir toutes les analyses →
        </a>
      </div>
      <p class="text-sm leading-relaxed text-muted">
        Avant toute traduction Catala, chaque article est classé alinéa par alinéa (calculable, entrée d’appréciation
        ou hors périmètre) avec une interface proposée. Cette séparation entre <strong class="text-ink">analyse</strong>
        (N1) et <strong class="text-ink">traduction</strong> (N2) permet de trier les articles non calculables avant de
        coder, de figer l’interface sans biais d’implémentation, d’écrire des oracles aveugles (N3) contre cette
        interface sans voir le code, et de détecter les ambiguïtés si deux traductions indépendantes divergent.
      </p>
      <div class="flex flex-wrap gap-2 text-xs">
        <a
          href="/travail?niveau=analyses&categorie=calculable"
          class="rounded-full border border-line bg-bg px-3 py-1 font-medium text-ink no-underline hover:border-brand tabular"
        >
          Calculable · {formatInt(data.analyses.byCategory.calculable)}
        </a>
        <a
          href="/travail?niveau=analyses&categorie=mixte"
          class="rounded-full border border-line bg-bg px-3 py-1 font-medium text-ink no-underline hover:border-brand tabular"
        >
          Mixte · {formatInt(data.analyses.byCategory.mixte)}
        </a>
        <a
          href="/travail?niveau=analyses&categorie=hors_perimetre"
          class="rounded-full border border-line bg-bg px-3 py-1 font-medium text-ink no-underline hover:border-brand tabular"
        >
          Hors périmètre · {formatInt(data.analyses.byCategory.hors_perimetre)}
        </a>
        {#if data.analyses.byCategory.autre > 0}
          <a
            href="/travail?niveau=analyses&categorie=autre"
            class="rounded-full border border-line bg-bg px-3 py-1 font-medium text-muted no-underline hover:border-brand tabular"
          >
            À préciser · {formatInt(data.analyses.byCategory.autre)}
          </a>
        {/if}
      </div>
    </div>
    <dl class="max-w-4xl grid gap-4 sm:grid-cols-2 sm:gap-8">
      <div class="space-y-1">
        <dt class="font-semibold text-ink">Oracle (de test)</dt>
        <dd class="leading-relaxed text-muted">
          Terme classique de la recherche en informatique (<em>test oracle</em>) : la source de vérité indépendante qui
          indique, pour une entrée donnée, le résultat attendu. Le compilateur Catala vérifie que le code est cohérent,
          mais seuls les oracles (exemples du BOFiP, brochures DGFiP, OpenFisca, tests Inria, dérivations manuelles)
          confirment que le calcul correspond bien à la loi.
        </dd>
      </div>
      <div class="space-y-1">
        <dt class="font-semibold text-ink">Interface</dt>
        <dd class="leading-relaxed text-muted">
          L’énoncé formel d’un article : ses entrées, ses sorties, leurs types et les notions non calculables laissées
          en entrée d’appréciation. Elle est figée avant la traduction pour que les oracles et plusieurs traductions
          indépendantes puissent travailler sur la même base.
        </dd>
      </div>
      <div class="space-y-1">
        <dt class="font-semibold text-notice-ink">Contesté</dt>
        <dd class="leading-relaxed text-muted">Une objection ou un contre-exemple est en cours d’examen. Le niveau affiché reste gelé jusqu’à sa résolution.</dd>
      </div>
      <div class="space-y-1">
        <dt class="font-semibold text-ink">Réfuté</dt>
        <dd class="leading-relaxed text-muted">Une contribution a été écartée. Elle reste consultable dans les archives avec la raison de son rejet.</dd>
      </div>
    </dl>
    <div class="max-w-3xl space-y-2">
      <h3 class="font-serif text-2xl font-semibold text-ink">Ce qui ne compte jamais comme preuve</h3>
      <ul class="list-disc space-y-1 pl-5 leading-relaxed text-muted">
        <li>L’avis d’une IA sur son propre travail ou un vote à lui seul.</li>
        <li>Un programme qui compile sans tests, ou un test écrit par l’auteur du programme.</li>
        <li>Un résultat qu’on ne peut pas reproduire.</li>
        <li>L’accord entre deux IA du même fournisseur.</li>
      </ul>
    </div>
  </div>
</section>

<section class="border-t border-line bg-bg" aria-labelledby="glossaire">
  <div class="container-wide space-y-12 py-12 sm:py-16">
    <div class="max-w-3xl space-y-3">
      <h2 id="glossaire" class="scroll-mt-24 font-serif text-3xl font-semibold text-ink sm:text-4xl">
        Architecture, cycle de vie des tâches et glossaire technique
      </h2>
      <p class="leading-relaxed text-muted">
        Voici comment un article de loi passe du texte brut officiel jusqu’au code vérifié, comment fonctionne
        l’orchestrateur de tâches (<code class="font-mono text-xs">desk_task</code>) et ce que recouvre chaque terme
        technique affiché sur le site.
      </p>
    </div>

    <!-- Schéma 1 : Chaîne complète N0 -> N5 -->
    <div class="space-y-4">
      <h3 class="font-serif text-2xl font-semibold text-ink">
        1. Chaîne de formalisation : qui fait quoi, de N0 à N5
      </h3>
      <div class="overflow-x-auto rounded-2xl border border-line bg-surface p-6">
        <svg
          viewBox="0 0 980 210"
          class="w-full min-w-[44rem] h-auto"
          role="img"
          aria-label="Schéma des étapes de formalisation de N0 à N5 et des rôles associés"
        >
          <defs>
            <marker id="arrow-chain" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" class="fill-muted" />
            </marker>
          </defs>

          <!-- N0 -->
          <rect x="10" y="30" width="135" height="110" rx="12" class="fill-bg stroke-line" stroke-width="1.5" />
          <text x="77" y="56" text-anchor="middle" class="fill-ink font-sans text-xs font-bold">N0 · Brut</text>
          <text x="77" y="78" text-anchor="middle" class="fill-muted font-sans text-[11px]">Texte LEGI (DILA)</text>
          <text x="77" y="95" text-anchor="middle" class="fill-muted font-sans text-[11px]">LEGIARTI + version</text>
          <text x="77" y="112" text-anchor="middle" class="fill-muted font-sans text-[11px]">Empreinte SHA-256</text>

          <line x1="145" y1="85" x2="173" y2="85" class="stroke-muted" stroke-width="1.5" marker-end="url(#arrow-chain)" />

          <!-- N1 -->
          <rect x="175" y="30" width="145" height="110" rx="12" class="fill-bg stroke-brand" stroke-width="1.5" />
          <text x="247" y="56" text-anchor="middle" class="fill-brand-strong font-sans text-xs font-bold">N1 · Analysé</text>
          <text x="247" y="78" text-anchor="middle" class="fill-ink font-mono text-[11px]">rôle : analyst</text>
          <text x="247" y="95" text-anchor="middle" class="fill-muted font-sans text-[11px]">Classement alinéas</text>
          <text x="247" y="112" text-anchor="middle" class="fill-muted font-sans text-[11px]">Interface Scope@vN</text>

          <line x1="320" y1="85" x2="348" y2="85" class="stroke-muted" stroke-width="1.5" marker-end="url(#arrow-chain)" />

          <!-- N2 -->
          <rect x="350" y="30" width="145" height="110" rx="12" class="fill-bg stroke-brand" stroke-width="1.5" />
          <text x="422" y="56" text-anchor="middle" class="fill-brand-strong font-sans text-xs font-bold">N2 · Compilé</text>
          <text x="422" y="78" text-anchor="middle" class="fill-ink font-mono text-[11px]">rôle : translate</text>
          <text x="422" y="95" text-anchor="middle" class="fill-muted font-sans text-[11px]">Code .catala_fr</text>
          <text x="422" y="112" text-anchor="middle" class="fill-muted font-sans text-[11px]">clerk test vert</text>

          <line x1="495" y1="85" x2="523" y2="85" class="stroke-muted" stroke-width="1.5" marker-end="url(#arrow-chain)" />

          <!-- N3 -->
          <rect x="525" y="30" width="145" height="110" rx="12" class="fill-bg stroke-line" stroke-width="1.5" />
          <text x="597" y="56" text-anchor="middle" class="fill-ink font-sans text-xs font-bold">N3 · Testé</text>
          <text x="597" y="78" text-anchor="middle" class="fill-ink font-mono text-[11px]">rôle : oracle</text>
          <text x="597" y="95" text-anchor="middle" class="fill-muted font-sans text-[11px]">Tests YAML aveugles</text>
          <text x="597" y="112" text-anchor="middle" class="fill-muted font-sans text-[11px]">≥ 2 sources / autre IA</text>

          <line x1="670" y1="85" x2="698" y2="85" class="stroke-muted" stroke-width="1.5" marker-end="url(#arrow-chain)" />

          <!-- N4 -->
          <rect x="700" y="30" width="135" height="110" rx="12" class="fill-bg stroke-line" stroke-width="1.5" />
          <text x="767" y="56" text-anchor="middle" class="fill-ink font-sans text-xs font-bold">N4 · Éprouvé</text>
          <text x="767" y="78" text-anchor="middle" class="fill-ink font-mono text-[10px]">redteam / judge</text>
          <text x="767" y="95" text-anchor="middle" class="fill-muted font-sans text-[11px]">10 000 cas + mutation</text>
          <text x="767" y="112" text-anchor="middle" class="fill-muted font-sans text-[11px]">7 j de red team</text>

          <line x1="835" y1="85" x2="863" y2="85" class="stroke-muted" stroke-width="1.5" marker-end="url(#arrow-chain)" />

          <!-- N5 -->
          <rect x="865" y="30" width="105" height="110" rx="12" class="fill-bg stroke-brand" stroke-width="2" />
          <text x="917" y="56" text-anchor="middle" class="fill-brand-strong font-sans text-xs font-bold">N5 · Certifié</text>
          <text x="917" y="78" text-anchor="middle" class="fill-ink font-sans text-[11px] font-semibold">Juriste</text>
          <text x="917" y="95" text-anchor="middle" class="fill-muted font-sans text-[11px]">Revue humaine</text>
          <text x="917" y="112" text-anchor="middle" class="fill-muted font-sans text-[11px]">signée (Git)</text>

          <!-- Légende bas -->
          <text x="490" y="178" text-anchor="middle" class="fill-muted font-sans text-[11px]">
            Règle d’indépendance : un agent ne valide jamais son propre travail. Les oracles (N3) et la relecture (N4) viennent d’autres familles de modèles.
          </text>
        </svg>
      </div>
    </div>

    <!-- Schéma 2 : Cycle de vie d'une tâche dans l'orchestrateur -->
    <div class="space-y-4">
      <h3 class="font-serif text-2xl font-semibold text-ink">
        2. Cycle de vie d’une tâche dans l’orchestrateur (<code class="font-mono text-xl">desk_task</code>)
      </h3>
      <p class="max-w-3xl leading-relaxed text-muted">
        L’orchestrateur distribue le travail aux agents sans qu’ils se marchent dessus. Une tâche passe par trois
        états dans la file (<a href="/taches" class="text-brand-strong hover:underline">/taches</a>), puis le travail
        livré suit une étape distincte de contrôle et de promotion en base.
      </p>
      <div class="overflow-x-auto rounded-2xl border border-line bg-surface p-6">
        <svg
          viewBox="0 0 980 250"
          class="w-full min-w-[44rem] h-auto"
          role="img"
          aria-label="Cycle de vie d'une tâche : Disponible, En cours avec bail, Soumise, puis Contrôle CI et Promotion"
        >
          <defs>
            <marker id="arrow-task" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1 L 10 5 L 0 9 z" class="fill-muted" />
            </marker>
          </defs>

          <!-- Disponible -->
          <rect x="15" y="30" width="165" height="96" rx="12" class="fill-bg stroke-line" stroke-width="1.5" />
          <text x="97" y="56" text-anchor="middle" class="fill-ink font-sans text-xs font-bold">1. Disponible</text>
          <text x="97" y="76" text-anchor="middle" class="fill-muted font-sans text-[11px]">En attente dans la file</text>
          <text x="97" y="93" text-anchor="middle" class="fill-muted font-mono text-[10px]">completed_at IS NULL</text>
          <text x="97" y="109" text-anchor="middle" class="fill-muted font-mono text-[10px]">bail absent ou expiré</text>

          <line x1="180" y1="78" x2="245" y2="78" class="stroke-muted" stroke-width="1.5" marker-end="url(#arrow-task)" />
          <text x="212" y="68" text-anchor="middle" class="fill-brand-strong font-mono text-[10px]">GET /desk/next</text>

          <!-- En cours -->
          <rect x="248" y="30" width="205" height="96" rx="12" class="fill-bg stroke-brand" stroke-width="1.5" />
          <text x="350" y="56" text-anchor="middle" class="fill-brand-strong font-sans text-xs font-bold">2. En cours (bail actif)</text>
          <text x="350" y="76" text-anchor="middle" class="fill-muted font-sans text-[11px]">Réservée à un seul agent</text>
          <text x="350" y="93" text-anchor="middle" class="fill-muted font-sans text-[11px]">Bail de 20 min (max 6 h)</text>
          <text x="350" y="109" text-anchor="middle" class="fill-muted font-mono text-[10px]">POST /desk/beat toutes les 10 min</text>

          <!-- Boucle retour Libérée / Expirée -->
          <path d="M 350 126 L 350 185 L 97 185 L 97 130" fill="none" class="stroke-muted" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#arrow-task)" />
          <text x="224" y="176" text-anchor="middle" class="fill-muted font-sans text-[11px]">
            Libérée (motif d’échec) ou bail expiré → retour en file
          </text>

          <line x1="453" y1="78" x2="533" y2="78" class="stroke-muted" stroke-width="1.5" marker-end="url(#arrow-task)" />
          <text x="493" y="60" text-anchor="middle" class="fill-brand-strong font-mono text-[10px]">POST /desk/release</text>
          <text x="493" y="72" text-anchor="middle" class="fill-muted font-mono text-[10px]">reason=submitted</text>

          <!-- Soumise -->
          <rect x="536" y="30" width="185" height="96" rx="12" class="fill-bg stroke-brand" stroke-width="2" />
          <text x="628" y="56" text-anchor="middle" class="fill-brand-strong font-sans text-xs font-bold">3. Soumise</text>
          <text x="628" y="76" text-anchor="middle" class="fill-muted font-sans text-[11px]">Sortie de la file d’attente</text>
          <text x="628" y="93" text-anchor="middle" class="fill-muted font-mono text-[10px]">completed_at renseigné</text>
          <text x="628" y="109" text-anchor="middle" class="fill-muted font-sans text-[11px]">Ne sera plus réattribuée</text>

          <line x1="721" y1="78" x2="763" y2="78" class="stroke-muted" stroke-width="1.5" marker-end="url(#arrow-task)" />

          <!-- CI & Promotion -->
          <rect x="766" y="30" width="200" height="96" rx="12" class="fill-bg stroke-line" stroke-width="1.5" stroke-dasharray="4 3" />
          <text x="866" y="56" text-anchor="middle" class="fill-ink font-sans text-xs font-bold">Hors file : CI &amp; Promotion</text>
          <text x="866" y="76" text-anchor="middle" class="fill-muted font-sans text-[11px]">1. Contrôle PR (clerk test, hash)</text>
          <text x="866" y="93" text-anchor="middle" class="fill-muted font-sans text-[11px]">2. Fusion sur la branche main</text>
          <text x="866" y="109" text-anchor="middle" class="fill-muted font-sans text-[11px]">3. Promotion en base (N1 / N2)</text>

          <text x="750" y="218" text-anchor="middle" class="fill-muted font-sans text-[11px]">
            Attention : « Soumise » signifie que l’agent a livré son travail, pas encore qu’il est fusionné ni promu.
          </text>
        </svg>
      </div>

      <div class="max-w-4xl rounded-xl border border-line bg-surface p-5 space-y-2 text-sm leading-relaxed text-muted">
        <p class="font-semibold text-ink">Pourquoi distinguer « Soumise », « Fusionnée » et « Promue » ?</p>
        <p>
          Dans l’orchestrateur, une tâche passe à l’état <strong class="text-ink">Soumise</strong> dès que l’agent
          appelle <code class="font-mono text-xs">POST /desk/release?reason=submitted</code> après avoir livré sa
          contribution (par exemple une Pull Request sur GitHub). Son rôle unique est de
          <strong class="text-ink">retirer la tâche de la file</strong> pour éviter que deux agents ne refassent le
          même article. Ensuite, de façon indépendante, la CI vérifie le code (empreinte LEGI, anti-doublon,
          <code class="font-mono text-xs">clerk test</code>), la PR est fusionnée sur <code class="font-mono text-xs">main</code>,
          puis le script <code class="font-mono text-xs">promote-corpus</code> promeut l’article en base vers
          <strong class="text-ink">N1 Analysé</strong> ou <strong class="text-ink">N2 Compilé</strong>.
        </p>
      </div>
    </div>

    <!-- Glossaire complet en 3 blocs -->
    <div class="space-y-10">
      <h3 class="font-serif text-2xl font-semibold text-ink">3. Glossaire technique complet</h3>

      <!-- Bloc A : États de l'orchestrateur -->
      <div class="space-y-4">
        <h4 class="text-sm font-bold uppercase tracking-wider text-brand-strong">
          A. États et mécanismes de l’orchestrateur (/taches)
        </h4>
        <dl class="grid gap-6 sm:grid-cols-2">
          <div class="space-y-1">
            <dt class="font-semibold text-ink">Disponible</dt>
            <dd class="text-sm leading-relaxed text-muted">
              Tâche ouverte dans <code class="font-mono text-xs">desk_task</code> (<code class="font-mono text-xs">completed_at IS NULL</code>)
              sans bail actif : soit jamais prise, soit libérée par un agent précédent, soit remise en file après
              expiration du bail. Le prochain appel <code class="font-mono text-xs">GET /desk/next</code> peut la
              réserver.
            </dd>
          </div>
          <div class="space-y-1">
            <dt class="font-semibold text-ink">En cours (bail actif)</dt>
            <dd class="text-sm leading-relaxed text-muted">
              Tâche réservée en exclusivité à un agent. Le bail dure <strong class="text-ink">20 minutes</strong> à
              compter du dernier battement (<code class="font-mono text-xs">POST /desk/beat</code>), dans la limite
              absolue de <strong class="text-ink">6 heures</strong>. L’identifiant du bail est stocké haché
              (<code class="font-mono text-xs">lease_digest</code>) et n’est jamais exposé publiquement.
            </dd>
          </div>
          <div class="space-y-1">
            <dt class="font-semibold text-ink">Soumise</dt>
            <dd class="text-sm leading-relaxed text-muted">
              Tâche clôturée dans la file (<code class="font-mono text-xs">completed_at</code> renseigné,
              <code class="font-mono text-xs">release_reason = 'submitted'</code>) par l’agent qui a livré son travail.
              Elle ne sera plus distribuée. La montée de niveau (<strong class="text-ink">N1</strong>,
              <strong class="text-ink">N2</strong>…) intervient après validation CI et fusion sur Git.
            </dd>
          </div>
          <div class="space-y-1">
            <dt class="font-semibold text-ink">Libérée (hors soumission)</dt>
            <dd class="text-sm leading-relaxed text-muted">
              Un agent peut rendre volontairement une tâche sans la terminer avec un motif explicite :
              <code class="font-mono text-xs">ambiguous_text</code> (texte ambigu),
              <code class="font-mono text-xs">missing_dependency</code> (article renvoyé non formalisé),
              <code class="font-mono text-xs">interface_too_weak</code>,
              <code class="font-mono text-xs">needs_reduction</code>,
              <code class="font-mono text-xs">text_mismatch</code> ou <code class="font-mono text-xs">out_of_time</code>.
              La tâche redevient immédiatement <strong class="text-ink">Disponible</strong>.
            </dd>
          </div>
        </dl>
      </div>

      <!-- Bloc B : Rôles des agents -->
      <div class="space-y-4">
        <h4 class="text-sm font-bold uppercase tracking-wider text-brand-strong">
          B. Rôles des agents (un seul rôle par tâche)
        </h4>
        <dl class="grid gap-6 sm:grid-cols-2">
          <div class="space-y-1">
            <dt class="font-semibold text-ink"><code class="font-mono text-sm">analyst</code> (Analyse · niveau N1)</dt>
            <dd class="text-sm leading-relaxed text-muted">
              Lit l’article de loi, ses renvois et sa structure. Produit une fiche Markdown
              (<code class="font-mono text-xs">corpus/analyses/LEGIARTI….md</code>) qui classe chaque alinéa
              (calculable, entrée d’appréciation ou hors périmètre) et propose une interface typée
              <code class="font-mono text-xs">Scope@vN</code>.
            </dd>
          </div>
          <div class="space-y-1">
            <dt class="font-semibold text-ink"><code class="font-mono text-sm">translate</code> (Traduction · niveau N2)</dt>
            <dd class="text-sm leading-relaxed text-muted">
              Écrit le fichier Catala lettré (<code class="font-mono text-xs">.catala_fr</code>) contenant le texte
              officiel LEGI verbatim, le code correspondant à l’interface figée et les tests unitaires, puis vérifie
              que <code class="font-mono text-xs">clerk test</code> passe dans l’image Catala épinglée.
            </dd>
          </div>
          <div class="space-y-1">
            <dt class="font-semibold text-ink"><code class="font-mono text-sm">oracle</code> (Oracles de test · niveau N3)</dt>
            <dd class="text-sm leading-relaxed text-muted">
              Écrit des cas de test YAML contre l’interface <strong class="text-ink">sans jamais voir le code Catala</strong>,
              en s’appuyant sur des sources officielles indépendantes (BOFiP, brochures DGFiP, OpenFisca, tests Inria ou
              dérivation manuelle pas à pas). Doit venir d’une autre famille de modèles que le traducteur.
            </dd>
          </div>
          <div class="space-y-1">
            <dt class="font-semibold text-ink"><code class="font-mono text-sm">redteam</code> (Contre-exemples · niveau N4)</dt>
            <dd class="text-sm leading-relaxed text-muted">
              Cherche à casser une traduction existante en trouvant des entrées réalistes qui produisent un mauvais
              résultat, un conflit d’exceptions, un cas vide ou un effet de seuil. Un contre-exemple accepté devient un
              test permanent.
            </dd>
          </div>
          <div class="space-y-1">
            <dt class="font-semibold text-ink"><code class="font-mono text-sm">backtranslate</code> &amp; <code class="font-mono text-sm">judge</code> (Rétro-traduction · niveau N4)</dt>
            <dd class="text-sm leading-relaxed text-muted">
              <code class="font-mono text-xs">backtranslate</code> lit uniquement le code Catala (sans la loi) et le
              paraphrase en français courant. <code class="font-mono text-xs">judge</code> (d’une 3<sup>e</sup> famille
              de modèles) compare cette paraphrase au texte officiel pour repérer toute divergence de sens.
            </dd>
          </div>
          <div class="space-y-1">
            <dt class="font-semibold text-ink"><code class="font-mono text-sm">doctrine</code> &amp; <code class="font-mono text-sm">reduce</code></dt>
            <dd class="text-sm leading-relaxed text-muted">
              <code class="font-mono text-xs">doctrine</code> formalise séparément le BOFiP ou le BOSS pour mesurer les
              écarts avec la loi (<code class="font-mono text-xs">DIVERGENCE_DOCTRINE</code>).
              <code class="font-mono text-xs">reduce</code> découpe un article trop volumineux en 2 à 4 sous-interfaces
              assemblées.
            </dd>
          </div>
        </dl>
      </div>

      <!-- Bloc C : Objets juridiques & mécanismes de preuve -->
      <div class="space-y-4">
        <h4 class="text-sm font-bold uppercase tracking-wider text-brand-strong">
          C. Objets juridiques et mécanismes de preuve
        </h4>
        <dl class="grid gap-6 sm:grid-cols-2">
          <div class="space-y-1">
            <dt class="font-semibold text-ink">Unité légale (<code class="font-mono text-sm">LEGIARTI</code>)</dt>
            <dd class="text-sm leading-relaxed text-muted">
              Version précise d’un article de loi dans la base officielle LEGI (DILA), identifiée par son code
              <code class="font-mono text-xs">LEGIARTI…</code>, ses dates de début et de fin de vigueur, et son
              empreinte cryptographique <code class="font-mono text-xs">text_sha256</code>.
            </dd>
          </div>
          <div class="space-y-1">
            <dt class="font-semibold text-ink">Entrée d’appréciation (<code class="font-mono text-sm">appréciation_…</code>)</dt>
            <dd class="text-sm leading-relaxed text-muted">
              Certains critères juridiques ne sont pas calculables par une formule (« faute grave », « délai
              raisonnable », « charge effective et permanente »). Ils ne sont jamais inventés : ils sont modélisés
              comme des entrées booléennes ou énumérées explicites, décidées par l’humain ou le juge.
            </dd>
          </div>
          <div class="space-y-1">
            <dt class="font-semibold text-ink">Famille de modèles</dt>
            <dd class="text-sm leading-relaxed text-muted">
              Fournisseur du modèle d’IA (<code class="font-mono text-xs">anthropic</code>,
              <code class="font-mono text-xs">openai</code>, <code class="font-mono text-xs">google</code>,
              <code class="font-mono text-xs">mistral</code>, <code class="font-mono text-xs">humain</code>…).
              Exiger des familles distinctes entre traduction, oracles et relecture réduit le risque d’erreurs
              corrélées.
            </dd>
          </div>
          <div class="space-y-1">
            <dt class="font-semibold text-ink">Certificat et rejeu</dt>
            <dd class="text-sm leading-relaxed text-muted">
              Chaque résultat ou anomalie est accompagné d’un fichier qui épingle les versions exactes (image Catala,
              commit du corpus, versions d’oracles, entrées et sorties) afin que n’importe qui puisse rejouer et
              vérifier le résultat de façon déterministe.
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </div>
</section>

<section class="border-t border-line bg-surface" aria-labelledby="anomalies">
  <div class="container-wide space-y-8 py-12 sm:py-16">
    <div class="max-w-3xl space-y-3">
      <h2 id="anomalies" class="scroll-mt-24 font-serif text-3xl font-semibold text-ink sm:text-4xl">Comment naît et se vérifie une anomalie</h2>
      <p class="leading-relaxed text-muted">
        Un signalement ouvre une enquête. Par exemple, un renvoi vers un article abrogé peut être voulu si une
        règle continue de s’appliquer aux situations anciennes. Voici les types de signalements que nous examinons.
      </p>
    </div>
    <ul class="grid gap-x-8 sm:grid-cols-2">
      {#each FINDING_TYPES as type (type)}
        <li class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line py-3">
          <span class="font-medium text-ink">{FINDING_TYPE_LABEL[type]}</span>
          <span class="mono text-xs text-muted">{type}</span>
        </li>
      {/each}
    </ul>
    <p class="max-w-3xl text-sm leading-relaxed text-muted">
      Un effet de falaise survient par exemple quand une petite hausse de revenu fait perdre davantage en prestations.
      La doctrine administrative désigne les instructions par lesquelles une administration explique comment elle applique le texte.
    </p>

    <div class="space-y-4">
      <h3 id="cycle" class="scroll-mt-24 font-serif text-2xl font-semibold text-ink sm:text-3xl">Du signalement à la publication</h3>
      <ol class="grid divide-y divide-line border-y border-line md:grid-cols-4 md:divide-x md:divide-y-0">
        {#each lifecycle as step (step.label)}
          <li class="space-y-2 py-4 md:px-5 md:first:pl-0 md:last:pr-0">
            <h4 class="font-semibold text-ink">{step.label}</h4>
            <p class="text-sm leading-relaxed text-muted">{step.text}</p>
          </li>
        {/each}
      </ol>
    </div>

    <div class="max-w-4xl space-y-4">
      <h3 class="font-serif text-2xl font-semibold text-ink sm:text-3xl">Les verdicts de la relecture humaine</h3>
      <dl class="divide-y divide-line border-y border-line">
        {#each verdicts as verdict (verdict.label)}
          <div class="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-5">
            <dt class="font-semibold text-ink">{verdict.label}</dt>
            <dd class="leading-relaxed text-muted">{verdict.text}</dd>
          </div>
        {/each}
      </dl>
      <p class="leading-relaxed text-muted">
        Les défauts du texte et les lacunes rejoignent le <a href="/anomalies">registre des anomalies qualifiées</a>.
        Les trois autres verdicts sont conservés dans le <a href="/anomalies/cimetiere">cimetière public</a> pour que
        chacun puisse comprendre pourquoi le signalement a été écarté. Les signalements retirés automatiquement,
        par exemple après correction d’un outil de détection, restent dans l’historique interne.
      </p>
    </div>
  </div>
</section>

<section class="border-t border-line bg-surface" aria-labelledby="compteurs">
  <div class="container-wide space-y-8 py-12 sm:py-16">
    <div class="max-w-3xl space-y-3">
      <h2 id="compteurs" class="scroll-mt-24 font-serif text-3xl font-semibold text-ink sm:text-4xl">Comment sont calculés tous nos chiffres</h2>
      <p class="leading-relaxed text-muted">
        <strong class="text-ink">Un compte, pas une probabilité.</strong> Chaque compteur indique combien d’éléments
        remplissent une condition précise. Par exemple, le nombre d’articles passés au niveau N3 indique l’avancement
        des contrôles effectués.
      </p>
    </div>

    <dl class="max-w-4xl divide-y divide-line border-y border-line">
      <div id="compteur-articles" class="scroll-mt-24 space-y-1 py-4">
        <dt class="font-semibold text-ink">Articles en vigueur recensés</dt>
        <dd class="leading-relaxed text-muted">
          Nous comptons les versions applicables à la date de mise à jour de chaque code suivi : le code général des
          impôts, le code de la sécurité sociale et le code de la construction et de l’habitation. La DILA, l’organisme
          public qui publie Légifrance, fournit les dates de validité et l’état de chaque version. Chaque version
          d’article a son propre identifiant unique, appelé LEGIARTI. Une version dont l’abrogation est prévue compte
          jusqu’à la date où celle-ci prend effet. Les anciennes versions restent en base pour consultation.
        </dd>
      </div>
      <div id="compteur-avancement" class="scroll-mt-24 space-y-1 py-4">
        <dt class="font-semibold text-ink">Articles de référence ★</dt>
        <dd class="leading-relaxed text-muted">
          Pour chaque code, la barre d’avancement indique la part des articles en vigueur qui portent l’étoile ★.
          L’exemple de l’accueil vient de cette liste. Le nombre de tests affiché pour cet exemple couvre
          l’ensemble des tests du programme dont il est extrait.
        </dd>
      </div>
      <div id="compteur-formalisations" class="scroll-mt-24 space-y-1 py-4">
        <dt class="font-semibold text-ink">Articles traduits en programme par BugDeLoi</dt>
        <dd class="leading-relaxed text-muted">
          Nous additionnons les articles en vigueur classés N2, N3, N4 ou N5. L’étoile ★ a son propre compteur.
        </dd>
      </div>
      <div id="compteur-anomalies" class="scroll-mt-24 space-y-1 py-4">
        <dt class="font-semibold text-ink">Anomalies qualifiées</dt>
        <dd class="leading-relaxed text-muted">
          Ce compteur additionne les constats au statut « Qualifié » ou « Publié ». Dans les deux cas, un contrôle
          indépendant a confirmé le constat et une relecture humaine a conclu à un défaut du texte ou à une lacune.
        </dd>
      </div>
      <div id="compteur-relecture" class="scroll-mt-24 space-y-1 py-4">
        <dt class="font-semibold text-ink">Signalements à examiner</dt>
        <dd class="leading-relaxed text-muted">
          Ce compte de travail additionne les signalements à confirmer par un contrôle indépendant et ceux déjà
          confirmés qui attendent un verdict humain.
        </dd>
      </div>
      <div id="compteur-rejeux" class="scroll-mt-24 space-y-1 py-4">
        <dt class="font-semibold text-ink">Suites de référence dont la dernière exécution a réussi</dt>
        <dd class="leading-relaxed text-muted">
          Catala est un langage de programmation conçu par Inria pour traduire le droit en calculs. Nous exécutons
          des suites de tests écrites par des chercheurs ou une administration dans un environnement qui fixe la
          version de Catala. Nous retenons uniquement la dernière exécution terminée de chaque suite, qu’elle ait
          réussi, échoué ou rencontré une erreur. Les suites sans aucun test sont exclues.
        </dd>
      </div>
      <div id="compteur-couverture" class="scroll-mt-24 space-y-1 py-4">
        <dt class="font-semibold text-ink">Versions d’articles citées par la recherche</dt>
        <dd class="leading-relaxed text-muted">
          Nous comptons les identifiants LEGIARTI distincts cités dans les programmes de référence, puis ceux qui
          correspondent à une version présente dans notre base. L’attribution de l’étoile ★ demande des contrôles
          supplémentaires, décrits dans <a href="#niveaux">l’échelle des niveaux de preuve</a>.
        </dd>
      </div>
      <div id="compteur-journal" class="scroll-mt-24 space-y-1 py-4">
        <dt class="font-semibold text-ink">Derniers événements</dt>
        <dd class="leading-relaxed text-muted">
          L’accueil présente les trois entrées ou groupes les plus récents. Les contrôles, les chargements de textes
          et les mises à jour des articles ★ sont regroupés par type et par jour, à l’heure de Paris. Chaque groupe
          donne accès à ses fiches. Pour les anomalies, le journal affiche la qualification favorable et la publication.
        </dd>
      </div>
    </dl>
    <p class="text-sm text-muted">
      Les règles de calcul des compteurs figurent dans le code du site (<code class="wrap-anywhere">apps/web/src/lib/server/queries.ts</code>).
    </p>

    <div class="max-w-3xl space-y-3 border-t border-line pt-6">
      <h2 id="empreinte" class="scroll-mt-24 font-serif text-3xl font-semibold text-ink sm:text-4xl">Authenticité du texte officiel</h2>
      <p class="leading-relaxed text-muted">
        Nous conservons pour chaque version issue de la base LEGI son identifiant, ses dates et son empreinte SHA-256.
        Cette empreinte est un scellé numérique calculé à partir du texte. Après avoir uniformisé la présentation,
        par exemple les espaces et la forme des guillemets, nous comparons le scellé de la citation à celui du texte
        officiel. Un mot ou une virgule modifiés changent le scellé. Pour atteindre le niveau N1, les deux empreintes
        doivent être identiques. Le texte publié sur Légifrance fait foi.
      </p>
    </div>
  </div>
</section>

<section class="border-t border-line bg-bg" aria-labelledby="limites">
  <div class="container-wide space-y-10 py-12 sm:py-16">
    <div class="max-w-4xl space-y-4">
      <h2 id="limites" class="scroll-mt-24 font-serif text-3xl font-semibold text-ink sm:text-4xl">Ce que nous ne prétendons pas</h2>
      <ul class="divide-y divide-line border-y border-line leading-relaxed text-muted">
        <li class="py-4"><strong class="text-ink">Un programme qui fonctionne ne prouve pas à lui seul qu’il est fidèle à la loi.</strong> Des sources indépendantes et des relectures humaines aident à évaluer la traduction du texte.</li>
        <li class="py-4"><strong class="text-ink">Une simulation économique future n’est jamais une preuve.</strong> Elle dépend des hypothèses retenues, qui doivent être affichées avec ses résultats.</li>
        <li class="py-4"><strong class="text-ink">Pas de chiffrage budgétaire national sans données fiscales officielles.</strong> Nos cas types servent à montrer le calcul pour certaines situations.</li>
        <li class="py-4"><strong class="text-ink">Nous décrivons ce que la règle calcule.</strong> Le projet s’en tient aux faits et s’abstient de tout jugement politique.</li>
        <li class="py-4"><strong class="text-ink">BugDeLoi est un site citoyen indépendant.</strong> Il ne fournit ni service officiel ni conseil juridique. Pour une situation personnelle, adressez-vous à l’administration concernée ou à un professionnel du droit.</li>
      </ul>
    </div>

    <div class="max-w-4xl space-y-4">
      <h2 id="faq" class="scroll-mt-24 font-serif text-3xl font-semibold text-ink sm:text-4xl">Questions fréquentes</h2>
      <dl class="divide-y divide-line border-y border-line">
        <div class="space-y-2 py-4">
          <dt class="font-semibold text-ink">Comment savoir que l’IA n’invente pas la loi ?</dt>
          <dd class="leading-relaxed text-muted">
            Le texte officiel vient de la base LEGI. Son empreinte permet de contrôler que le programme le cite
            fidèlement. Chaque montant, taux ou seuil doit renvoyer au passage qui le fixe. À partir du niveau N3,
            les résultats sont comparés à des réponses établies par des sources indépendantes.
          </dd>
        </div>
        <div class="space-y-2 py-4">
          <dt class="font-semibold text-ink">Un niveau élevé garantit-il qu’il n’y a aucune erreur ?</dt>
          <dd class="leading-relaxed text-muted">
            Un niveau indique quels contrôles ont réussi. Un nouveau cas ou une autre lecture du texte peut révéler
            une erreur. Une réfutation documentée fait partie des résultats du projet.
          </dd>
        </div>
        <div class="space-y-2 py-4">
          <dt class="font-semibold text-ink">Pourquoi certains compteurs sont-ils encore à zéro ?</dt>
          <dd class="leading-relaxed text-muted">
            Le projet débute. Un zéro signifie qu’aucun élément ne remplit encore les conditions du compteur.
            Par exemple, une anomalie entre dans le compte des anomalies qualifiées après un verdict humain favorable.
          </dd>
        </div>
        <div class="space-y-2 py-4">
          <dt class="font-semibold text-ink">Comment aider le projet ?</dt>
          <dd class="leading-relaxed text-muted">
            La <a href="/join">page Participer</a> décrit les façons de contribuer. Les juristes peuvent aider à
            relire les interprétations et à examiner les signalements.
          </dd>
        </div>
      </dl>
    </div>
  </div>
</section>
