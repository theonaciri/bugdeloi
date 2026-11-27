<script lang="ts">
import { FINDING_TYPE_LABEL, FINDING_TYPES } from '@bugdeloi/core/findings'
import LevelSwatch from '#lib/components/LevelSwatch.svelte'
import ArticleJourney from '#lib/components/work/ArticleJourney.svelte'
import { formatInt } from '#lib/format.ts'
import { GLOSSARY_GROUPS, GLOSSARY_LIST } from '#lib/glossary.ts'
import { LEVELS, type Level, levelName } from '#lib/levels.ts'
import { COLUMN_INFO, COLUMNS } from '#lib/work.ts'
import type { PageData } from './$types'

let { data }: { data: PageData } = $props()

const levelDescriptions: Record<Level, string> = {
  N0: 'Le texte officiel est importé depuis LEGI avec son identifiant, ses dates de version et son empreinte numérique.',
  N1: 'L’article est analysé alinéa par alinéa (calculable, entrée d’appréciation ou hors périmètre) avec une empreinte LEGI concordante et une interface proposée avant toute traduction Catala.',
  N2: 'Le fichier cite le texte officiel à l’identique, respecte les règles du langage Catala et réussit tous ses tests dans la version épinglée du compilateur. Chaque montant, taux ou seuil cite le passage qui le fixe.',
  N3: 'Le programme produit les résultats attendus sur l’ensemble des cas d’oracle, sans conflit d’exceptions ni cas non couvert. Au moins un de ces cas provient d’une source non issue d’une IA : test OpenFisca ou Inria, exemple de l’administration, calcul écrit par un humain. Des cas rédigés par une IA sans accès au code peuvent compléter la suite, jamais la constituer seuls.',
  N4: 'Au moins 10 000 cas, incluant chaque seuil à ± 1 €, sont comparés à une implémentation indépendante sans écart inexpliqué. La suite de tests détecte au moins 80 % des mutations introduites volontairement. Pendant sept jours d’examen contradictoire, aucun contre-exemple n’est retenu.',
  N5: 'En plus des contrôles des niveaux précédents, un juriste identifié relit les choix d’interprétation et signe sa revue dans l’historique Git.',
  REF: 'La version en vigueur figure dans un programme publié par la recherche publique ou une administration. Sa suite comporte au moins un test et sa dernière exécution dans notre environnement épinglé a réussi. Ce marqueur identifie un travail externe à BugDeLoi.',
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
  <title>Méthode et limites · BugDeLoi</title>
  <meta name="description" content="Méthode de formalisation de BugDeLoi : niveaux de preuve N0 à N5, traitement des signalements, calcul des compteurs et limites du projet." />
</svelte:head>

<header class="bg-bg">
  <div class="container-wide space-y-6 py-12 sm:py-16">
    <h1 class="text-4xl tracking-tight text-ink sm:text-5xl">Méthode et limites</h1>
    <p class="max-w-[64ch] text-lg leading-relaxed text-muted">
      Aucune évaluation produite par une intelligence artificielle ne vaut preuve. Les modèles aident à lire les
      articles de loi et à les formaliser en Catala, mais chaque niveau repose sur des contrôles automatiques, des
      sources indépendantes ou une relecture humaine signée.
    </p>
    <nav aria-label="Sur cette page">
      <ul class="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold">
        <li><a href="#niveaux">Niveaux de preuve</a></li>
        <li><a href="#parcours">Parcours d’un article</a></li>
        <li><a href="#taches">Parcours d’une tâche</a></li>
        <li><a href="#glossaire">Glossaire</a></li>
        <li><a href="#anomalies">Anomalies</a></li>
        <li><a href="#compteurs">Calcul des compteurs</a></li>
        <li><a href="#limites">Limites</a></li>
        <li><a href="#faq">Questions fréquentes</a></li>
      </ul>
    </nav>
  </div>
</header>

<section class="border-t border-line bg-surface" aria-labelledby="niveaux">
  <div class="container-wide space-y-6 py-12 sm:py-16">
    <h2 id="niveaux" class="scroll-mt-24 text-3xl text-ink sm:text-4xl">Les niveaux de preuve</h2>
    <p class="max-w-[64ch] leading-relaxed text-muted">
      Chaque niveau indique un contrôle accompli et s’ajoute aux précédents. Pour atteindre N3, il faut avoir passé
      N2, qui exige lui-même N1. Chaque passage repose sur un contrôle effectué par un programme ou, pour N5, sur
      une revue signée par un juriste. L’avis d’une IA ne fait franchir aucun niveau.
    </p>
    <ol class="max-w-[64ch] divide-y divide-line border-y border-line">
      {#each LEVELS as level (level)}
        <li class="flex items-start gap-4 py-4">
          <div class="shrink-0"><LevelSwatch {level} size={36} /></div>
          <div class="space-y-1">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="text-lg text-ink">{levelName(level)}</h3>
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
    <div class="max-w-[64ch] rounded-xl border border-line bg-surface p-5 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-base text-ink">
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
          class="rounded-[var(--radius)] border border-line bg-bg px-3 py-1 font-medium text-ink no-underline hover:border-brand tabular"
        >
          Calculable · {formatInt(data.analyses.byCategory.calculable)}
        </a>
        <a
          href="/travail?niveau=analyses&categorie=mixte"
          class="rounded-[var(--radius)] border border-line bg-bg px-3 py-1 font-medium text-ink no-underline hover:border-brand tabular"
        >
          Mixte · {formatInt(data.analyses.byCategory.mixte)}
        </a>
        <a
          href="/travail?niveau=analyses&categorie=hors_perimetre"
          class="rounded-[var(--radius)] border border-line bg-bg px-3 py-1 font-medium text-ink no-underline hover:border-brand tabular"
        >
          Hors périmètre · {formatInt(data.analyses.byCategory.hors_perimetre)}
        </a>
        {#if data.analyses.byCategory.autre > 0}
          <a
            href="/travail?niveau=analyses&categorie=autre"
            class="rounded-[var(--radius)] border border-line bg-bg px-3 py-1 font-medium text-muted no-underline hover:border-brand tabular"
          >
            À préciser · {formatInt(data.analyses.byCategory.autre)}
          </a>
        {/if}
      </div>
    </div>
    <dl class="max-w-[64ch] grid gap-4 sm:grid-cols-2 sm:gap-8">
      <div class="space-y-1">
        <dt class="font-semibold text-ink">Oracle (de test)</dt>
        <dd class="leading-relaxed text-muted">
          Terme classique de la recherche en informatique (<em>test oracle</em>) : source de vérité indépendante qui
          indique, pour une entrée donnée, le résultat attendu. Le compilateur Catala contrôle la cohérence interne du
          code, mais seuls les oracles (exemples du BOFiP, brochures DGFiP, OpenFisca, tests Inria, dérivations
          manuelles) permettent de comparer le calcul au résultat attendu par la loi.
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
    <div class="max-w-[64ch] space-y-2">
      <h3 class="text-2xl text-ink">Ce qui ne compte jamais comme preuve</h3>
      <ul class="list-disc space-y-1 pl-5 leading-relaxed text-muted">
        <li>L’avis d’une IA sur son propre travail ou un vote à lui seul.</li>
        <li>Un programme qui compile sans tests, ou un test écrit par l’auteur du programme.</li>
        <li>Un résultat qu’on ne peut pas reproduire.</li>
        <li>Un accord entre deux IA, ou l’approbation d’un relecteur automatique (qui conditionne la fusion sans faire monter aucun niveau).</li>
      </ul>
    </div>
  </div>
</section>

<section class="border-t border-line bg-bg" aria-labelledby="parcours">
  <div class="container-wide space-y-14 py-12 sm:py-16">
    <div class="max-w-[64ch] space-y-3">
      <h2 id="parcours" class="scroll-mt-24 text-3xl sm:text-4xl">Le parcours d’un article</h2>
      <p class="leading-relaxed text-muted">
        Un article avance d’étape en étape. À chaque étape, quelqu’un propose un travail et un contrôle indépendant
        décide s’il est intégré. Le niveau de preuve de l’article est la dernière étape franchie.
      </p>
    </div>
    <ArticleJourney levels={data.counts} />

    <div id="taches" class="scroll-mt-24 grid gap-10 lg:grid-cols-[1fr_1.2fr]">
      <div class="space-y-4">
        <h3 class="text-2xl">Le parcours d’une tâche</h3>
        <p class="leading-relaxed text-muted">
          Une étape se découpe en tâches : un rôle, un article. Le <a href="#g-guichet">guichet</a> ne tient qu’une liste,
          celle des <a href="/taches">tâches à prendre</a>, dans un ordre fixe. Tout le reste se lit sur la fiche de
          chaque tâche et sur <a href="/live">le tableau en direct</a>.
        </p>
        <p class="leading-relaxed text-muted">
          Chaque réservation et chaque dépôt est inscrit au journal public (événements <code>desk.claimed</code> et
          <code>desk.released</code>). C’est ce journal, qui ne s’efface jamais, qui permet de retracer l’historique
          complet d’une tâche.
        </p>
      </div>
      <ol class="task-columns">
        {#each COLUMNS as col, i (col)}
          <li>
            <span class="tc-n" aria-hidden="true">{i + 1}</span>
            <div>
              <p class="font-display text-lg font-bold [font-stretch:110%]">{COLUMN_INFO[col].label}</p>
              <p class="mt-1 text-sm leading-relaxed text-muted">{COLUMN_INFO[col].meaning}</p>
              {#if col === 'todo'}
                <p class="mt-1 text-xs text-subtle">Une tâche rendue ou dont la réservation expire revient ici.</p>
              {/if}
            </div>
          </li>
        {/each}
      </ol>
    </div>

    <div id="pourquoi-separer" class="scroll-mt-24 max-w-[64ch] space-y-4">
      <h3 class="text-2xl">Séparation entre analyse et traduction</h3>
      <dl class="grid gap-x-10 gap-y-5 sm:grid-cols-2">
        <div>
          <dt class="font-semibold text-ink">Filtrage préalable</dt>
          <dd class="mt-1 text-sm leading-relaxed text-muted">De nombreux articles sont purement procéduraux ou non calculables. L’analyse identifie en amont les dispositions qui se prêtent à une formalisation.</dd>
        </div>
        <div>
          <dt class="font-semibold text-ink">Spécification figée avant le code</dt>
          <dd class="mt-1 text-sm leading-relaxed text-muted">L’interface est fixée avant la traduction afin d’éviter que la signature ne soit ajustée a posteriori à l’implémentation.</dd>
        </div>
        <div>
          <dt class="font-semibold text-ink">Oracles rédigés à l’aveugle</dt>
          <dd class="mt-1 text-sm leading-relaxed text-muted">À partir de l’interface seule, un second contributeur peut écrire des cas de test sans consulter la traduction.</dd>
        </div>
        <div>
          <dt class="font-semibold text-ink">Détection des ambiguïtés</dt>
          <dd class="mt-1 text-sm leading-relaxed text-muted">Si deux traductions indépendantes conformes à la même interface divergent sur une entrée, l’écart signale une ambiguïté potentielle du texte.</dd>
        </div>
      </dl>
    </div>

    <div id="glossaire" class="scroll-mt-24 space-y-8">
      <div class="max-w-[64ch] space-y-2">
        <h3 class="text-2xl">Glossaire</h3>
        <p class="leading-relaxed text-muted">
          Chaque terme souligné en pointillé sur le site renvoie à sa définition ci-dessous. Chaque entrée donne une
          explication en français courant, suivie le cas échéant du nom utilisé dans le code.
        </p>
      </div>
      {#each Object.entries(GLOSSARY_GROUPS) as [group, title] (group)}
        <div class="glossary-group">
          <h4 class="font-display text-sm font-bold uppercase tracking-[0.08em] text-muted">{title}</h4>
          <dl class="mt-4 grid gap-x-10 gap-y-6 md:grid-cols-2">
            {#each GLOSSARY_LIST.filter((e) => e.group === group) as e (e.id)}
              <div id={`g-${e.id}`} class="scroll-mt-28">
                <dt class="font-display text-[1.08rem] font-bold [font-stretch:110%]">{e.term}</dt>
                <dd class="mt-1 leading-relaxed text-ink">{e.short}</dd>
                {#if e.more}<dd class="mt-1 text-sm leading-relaxed text-muted">{e.more}</dd>{/if}
                {#if e.technical}<dd class="mt-1 text-xs text-subtle">Dans le code : <code class="text-ink">{e.technical}</code></dd>{/if}
              </div>
            {/each}
          </dl>
        </div>
      {/each}
    </div>
  </div>
</section>

<section class="border-t border-line bg-surface" aria-labelledby="anomalies">
  <div class="container-wide space-y-8 py-12 sm:py-16">
    <div class="max-w-[64ch] space-y-3">
      <h2 id="anomalies" class="scroll-mt-24 text-3xl text-ink sm:text-4xl">Cycle de vie d’un signalement</h2>
      <p class="leading-relaxed text-muted">
        Un signalement automatique n’est qu’une hypothèse de travail : un renvoi vers un article abrogé peut par
        exemple relever d’une disposition transitoire volontaire. Les catégories de signalements suivies sont les
        suivantes :
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
    <p class="max-w-[64ch] text-sm leading-relaxed text-muted">
      Un effet de falaise survient par exemple quand une petite hausse de revenu fait perdre davantage en prestations.
      La doctrine administrative désigne les instructions par lesquelles une administration explique comment elle applique le texte.
    </p>

    <div class="space-y-4">
      <h3 id="cycle" class="scroll-mt-24 text-2xl text-ink sm:text-3xl">Les quatre statuts d’un signalement</h3>
      <ol class="grid divide-y divide-line border-y border-line md:grid-cols-4 md:divide-x md:divide-y-0">
        {#each lifecycle as step (step.label)}
          <li class="space-y-2 py-4 md:px-5 md:first:pl-0 md:last:pr-0">
            <h4 class="font-semibold text-ink">{step.label}</h4>
            <p class="text-sm leading-relaxed text-muted">{step.text}</p>
          </li>
        {/each}
      </ol>
    </div>

    <div class="max-w-[64ch] space-y-4">
      <h3 class="text-2xl text-ink sm:text-3xl">Les verdicts de la relecture humaine</h3>
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
    <div class="max-w-[64ch] space-y-3">
      <h2 id="compteurs" class="scroll-mt-24 text-3xl text-ink sm:text-4xl">Calcul des compteurs</h2>
      <p class="leading-relaxed text-muted">
        <strong class="text-ink">Chaque chiffre est un dénombrement observé, et non une probabilité.</strong> Chaque
        compteur mesure le nombre d’éléments satisfaisant un critère précis. Ainsi, le nombre d’articles au niveau N3
        reflète l’avancement des contrôles effectués à cette date.
      </p>
    </div>

    <dl class="max-w-[64ch] divide-y divide-line border-y border-line">
      <div id="compteur-articles" class="scroll-mt-24 space-y-1 py-4">
        <dt class="font-semibold text-ink">Articles en vigueur recensés</dt>
        <dd class="leading-relaxed text-muted">
          Ce compteur recense les versions applicables à la date de mise à jour de chaque code suivi : le Code général des
          impôts, le Code de la sécurité sociale et le Code de la construction et de l’habitation. La DILA fournit les
          dates de validité et l’état de chaque version, identifiée par un numéro unique LEGIARTI. Une version dont
          l’abrogation est différée reste comptée jusqu’à la date d’effet de cette abrogation. Les versions antérieures
          restent accessibles en base pour consultation.
        </dd>
      </div>
      <div id="compteur-parcours" class="scroll-mt-24 space-y-1 py-4">
        <dt class="font-semibold text-ink">Hémicycle de l’accueil et articles engagés dans le parcours</dt>
        <dd class="leading-relaxed text-muted">
          Chaque point représente 10 articles en vigueur (40 sur petit écran), colorés selon leur niveau (N0 par défaut).
          Tout niveau non vide reçoit au moins un point et le niveau N0 occupe le reste. Les effectifs exacts figurent
          dans le décompte associé. Les articles engagés dans le parcours correspondent aux articles en vigueur hors N0
          (niveaux N1 à N5 et ★ Référence). Les points sont classés par angle, de ★ à gauche jusqu’à N0 à droite.
        </dd>
      </div>
      <div id="compteur-tableau" class="scroll-mt-24 space-y-1 py-4">
        <dt class="font-semibold text-ink">Tableau du travail (tâches à prendre, en cours, en relecture, intégrées)</dt>
        <dd class="leading-relaxed text-muted">
          <strong class="text-ink">À prendre</strong> : tâches inscrites ni déposées ni réservées dont le texte est
          toujours identique à LEGI, plus les articles que le guichet transformerait en tâche au prochain appel.
          <strong class="text-ink">En cours</strong> : réservations actives. <strong class="text-ink">En relecture</strong> :
          tâches déposées dont l’article n’a pas encore atteint le niveau visé. <strong class="text-ink">Intégrées</strong> :
          articles en vigueur au niveau visé ou au-dessus (★ exclue). « En attente » : articles du niveau de départ qui ne
          sont pas encore des tâches (par exemple, un article analysé hors périmètre n’ouvre pas de traduction). Règles :
          <code class="wrap-anywhere">apps/web/src/lib/server/work.ts</code>.
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

    <div class="max-w-[64ch] space-y-3 border-t border-line pt-6">
      <h2 id="empreinte" class="scroll-mt-24 text-3xl text-ink sm:text-4xl">Authenticité du texte officiel</h2>
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
    <div class="max-w-[64ch] space-y-4">
      <h2 id="limites" class="scroll-mt-24 text-3xl text-ink sm:text-4xl">Limites</h2>
      <ul class="divide-y divide-line border-y border-line leading-relaxed text-muted">
        <li class="py-4"><strong class="text-ink">Un programme qui fonctionne ne prouve pas à lui seul qu’il est fidèle à la loi.</strong> Des sources indépendantes et des relectures humaines aident à évaluer la traduction du texte.</li>
        <li class="py-4"><strong class="text-ink">Une simulation économique future n’est jamais une preuve.</strong> Elle dépend des hypothèses retenues, qui doivent être affichées avec ses résultats.</li>
        <li class="py-4"><strong class="text-ink">Pas de chiffrage budgétaire national sans données fiscales officielles.</strong> Nos cas types servent à montrer le calcul pour certaines situations.</li>
        <li class="py-4"><strong class="text-ink">Nous décrivons ce que la règle calcule.</strong> Le projet s’en tient aux faits et s’abstient de tout jugement politique.</li>
        <li class="py-4"><strong class="text-ink">BugDeLoi est un site citoyen indépendant.</strong> Il ne fournit ni service officiel ni conseil juridique. Pour une situation personnelle, adressez-vous à l’administration concernée ou à un professionnel du droit.</li>
      </ul>
    </div>

    <div class="max-w-[64ch] space-y-4">
      <h2 id="faq" class="scroll-mt-24 text-3xl text-ink sm:text-4xl">Questions fréquentes</h2>
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

<style>
  .task-columns {
    display: grid;
    gap: 0;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    background: var(--surface);
  }
  .task-columns li {
    display: grid;
    grid-template-columns: 2.2rem 1fr;
    gap: 0.9rem;
    padding: 1rem 1.1rem;
    border-top: 1px solid var(--line);
  }
  .task-columns li:first-child {
    border-top: 0;
  }
  .tc-n {
    display: grid;
    place-items: center;
    width: 2.2rem;
    height: 2.2rem;
    border: 1.5px solid var(--ink);
    border-radius: 999px;
    font-family: var(--font-display);
    font-weight: 800;
  }
  .glossary-group {
    padding-top: 1rem;
    border-top: 2px solid var(--ink);
  }
  .glossary-group :target {
    background: var(--brand-soft);
    outline: 6px solid var(--brand-soft);
    border-radius: 2px;
  }
</style>
