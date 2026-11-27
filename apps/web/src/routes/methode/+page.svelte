<script lang="ts">
import { FINDING_TYPE_LABEL, FINDING_TYPES } from '@bugdeloi/core/findings'
import LevelSwatch from '#lib/components/LevelSwatch.svelte'
import { LEVELS, type Level, levelName } from '#lib/levels.ts'

const levelDescriptions: Record<Level, string> = {
  N0: 'Nous avons enregistré le texte officiel, son identifiant, les dates de sa version et son empreinte numérique.',
  N1: 'Les données attendues et le résultat à calculer sont définis. Le programme cite le texte officiel à l’identique et indique, pour chaque passage, s’il est traduit en calcul ou pourquoi il est laissé de côté.',
  N2: 'Le code respecte les règles du langage Catala et celles du projet. Il passe tous ses tests avec la version prévue de l’outil. Chaque montant, taux ou seuil renvoie au passage qui le fixe.',
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
                class="text-xs font-semibold text-brand-strong no-underline hover:underline"
              >
                Voir les articles ({level === 'REF' ? '★ Référence' : level}) →
              </a>
            </div>
            <p class="leading-relaxed text-muted">{levelDescriptions[level]}</p>
          </div>
        </li>
      {/each}
    </ol>
    <dl class="max-w-4xl grid gap-4 sm:grid-cols-2 sm:gap-8">
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

<section class="border-t border-line bg-bg" aria-labelledby="anomalies">
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
