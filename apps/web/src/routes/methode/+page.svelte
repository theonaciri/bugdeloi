<script lang="ts">
import { FINDING_TYPE_LABEL, FINDING_TYPES } from '@bugdeloi/core/findings'
import LevelSwatch from '#lib/components/LevelSwatch.svelte'
import { LEVEL_INFO, LEVELS, levelName } from '#lib/levels.ts'

const lifecycle = [
  {
    code: 'candidate',
    label: 'Candidat',
    text: 'Un détecteur ou un contributeur signale une anomalie possible à reproduire.',
  },
  {
    code: 'reproduced',
    label: 'Reproduit',
    text: 'Une chaîne indépendante confirme le constat. Le certificat indique sa source, sa version et son résultat. Le rejeu en CI publique reste à mettre en place.',
  },
  {
    code: 'qualified',
    label: 'Qualifié',
    text: 'Un humain conclut à un défaut du texte ou à une lacune. Son verdict, son motif et le commit Git du verdict figurent dans le certificat.',
  },
  {
    code: 'published',
    label: 'Publié',
    text: 'La commande de publication inscrit l’événement dans le journal public. Le registre présente déjà le certificat dès la qualification.',
  },
]
</script>

<svelte:head>
  <title>Méthode et limites · BugDeLoi</title>
  <meta name="description" content="Comment BugDeLoi définit ses niveaux de preuve, ses anomalies et ses compteurs, et ce que le projet ne prétend pas." />
</svelte:head>

<div class="container-page mt-8">
  <div class="prose-page">
    <p class="kicker">Méthode</p>
    <h1 class="text-3xl font-semibold sm:text-4xl">Comment nous travaillons, et ce que nous ne prétendons pas</h1>
    <p class="text-lg text-muted">
      Idée directrice : on ne fait jamais confiance à un modèle de langage, on fait confiance à ce qu’un tiers peut
      rejouer. Les IA produisent des propositions ; le compilateur Catala, des sources indépendantes et des humains
      signataires les transforment en niveaux de preuve explicites.
    </p>

    <h2 id="niveaux">L’échelle des niveaux de preuve</h2>
    <p>
      Chaque article formalisé porte un niveau. Les niveaux sont cumulatifs : N3 suppose N2, qui suppose N1. Chacun
      correspond à un contrôle exécuté par un programme, pas à une opinion. La couleur est toujours doublée d’un motif et
      d’un texte.
    </p>
  </div>
  <ol class="mt-6 grid max-w-4xl gap-3">
    {#each LEVELS as level (level)}
      <li class="card flex gap-4 p-4">
        <LevelSwatch {level} size={36} />
        <div>
          <p class="text-lg font-semibold">{levelName(level)}</p>
          <p>{LEVEL_INFO[level].meaning}</p>
        </div>
      </li>
    {/each}
  </ol>
  <div class="prose-page mt-6">
    <p>
      Deux drapeaux complètent l’échelle. <strong>Contesté</strong> : une objection ou un contre-exemple est ouvert, le
      niveau affiché est gelé jusqu’à sa résolution. <strong>Réfuté</strong> : une formalisation rejetée, conservée avec
      son motif.
    </p>
    <p>
      Ne comptent jamais comme preuve : l’auto-évaluation d’une IA, « ça compile » seul, un vote seul, un test écrit par
      l’auteur de la traduction, un chiffre qu’on ne peut pas rejouer, l’accord de deux modèles du même fournisseur.
    </p>

    <h2 id="anomalies">Les anomalies</h2>
    <p>Nous cherchons des défauts précis, chacun défini de façon vérifiable :</p>
    <ul>
      {#each FINDING_TYPES as t (t)}
        <li><strong>{FINDING_TYPE_LABEL[t]}</strong> <span class="mono text-sm text-muted">{t}</span></li>
      {/each}
    </ul>
    <p>
      Un renvoi vers un article abrogé, par exemple, n’est pas forcément une erreur : les dispositions transitoires et les
      renvois « dans sa rédaction antérieure » sont légitimes. C’est pourquoi un détecteur ne produit que des candidats.
    </p>

    <h3 id="cycle">Le cycle d’une anomalie</h3>
  </div>
  <ol class="mt-4 grid max-w-4xl gap-3 md:grid-cols-4">
    {#each lifecycle as step (step.code)}
      <li class="card p-4">
        <p class="font-semibold">{step.label}</p>
        <p class="mt-1 text-sm">{step.text}</p>
      </li>
    {/each}
  </ol>

  <div class="prose-page mt-6">
    <h3>Verdicts humains</h3>
    <dl class="space-y-2">
      <div><dt class="font-semibold">Défaut du texte</dt><dd>Le relecteur identifie un défaut dans la version officielle.</dd></div>
      <div><dt class="font-semibold">Lacune</dt><dd>Le relecteur relève une situation que le texte ne prévoit pas.</dd></div>
      <div><dt class="font-semibold">Choix assumé</dt><dd>Le relecteur identifie une disposition voulue, par exemple un renvoi à une rédaction antérieure.</dd></div>
      <div><dt class="font-semibold">Erreur de notre part</dt><dd>Le relecteur relève une erreur dans notre lecture, nos données ou notre détection.</dd></div>
      <div><dt class="font-semibold">Non pertinent</dt><dd>Le relecteur explique pourquoi le constat ne relève pas d’une anomalie à retenir.</dd></div>
    </dl>
    <p>
      Les défauts du texte et les lacunes rejoignent le <a href="/anomalies">registre des anomalies qualifiées</a>.
      Les trois autres verdicts donnent le statut « rejeté » et sont consultables avec leur motif au
      <a href="/anomalies/cimetiere">cimetière</a>.
      Le statut « retiré » est attribué par une machine, par exemple après correction d’un détecteur.
      Les retraits restent dans l’historique interne.
    </p>

    <h2 id="compteurs">Comment sont calculés les compteurs</h2>
    <p>
      Chaque nombre du site est le résultat d’une requête sur notre base, définie dans un seul fichier du code source
      (<span class="mono">apps/web/src/lib/server/queries.ts</span>). <strong>Un compte, pas une probabilité</strong> :
      un compteur dit combien d’éléments remplissent une condition, il ne dit pas si la loi est « juste ».
    </p>
    <dl class="space-y-4">
      <div id="compteur-articles">
        <dt class="font-semibold">Articles en vigueur ingérés</dt>
        <dd>
          Nombre de versions d’articles (identifiants LEGIARTI) des codes suivis (CGI, CSS, CCH) en vigueur à la date de
          projection du code : la période de validité indiquée par la DILA contient cette date et l’état n’est ni
          « annulé », ni « non en vigueur », ni « modifié mort-né ». Les articles dont l’abrogation est programmée mais
          pas encore effective sont comptés. Les versions anciennes ou abrogées sont ingérées mais pas comptées ici.
        </dd>
      </div>
      <div id="compteur-avancement">
        <dt class="font-semibold">Articles de référence ★</dt>
        <dd>
          L’accueil compte les versions en vigueur portant le marqueur ★. Pour chaque code, la barre rapporte
          ce nombre à l’ensemble des articles en vigueur. L’exemple vient de cette liste et présente une règle
          décrite dans le programme source. Le nombre de tests affiché concerne la suite du programme.
        </dd>
      </div>
      <div id="compteur-formalisations">
        <dt class="font-semibold">Articles compilés par le projet</dt>
        <dd>Somme des articles en vigueur classés N2, N3, N4 ou N5. Le marqueur externe ★ est présenté à part.</dd>
      </div>
      <div id="compteur-anomalies">
        <dt class="font-semibold">Anomalies qualifiées</dt>
        <dd>
          Nombre d’anomalies au statut « qualifié » ou « publié ». Une chaîne indépendante a reproduit le constat et un
          humain a conclu à un défaut du texte ou à une lacune.
        </dd>
      </div>
      <div id="compteur-relecture">
        <dt class="font-semibold">Signalements à examiner</dt>
        <dd>
          Ce compte de travail additionne les signalements candidats et ceux déjà reproduits qui attendent un
          verdict humain. Les premiers passent encore par un contrôle indépendant. Les fiches d’anomalies
          publiées ont reçu un verdict humain favorable.
        </dd>
      </div>
      <div id="compteur-rejeux">
        <dt class="font-semibold">Rejeux de référence réussis</dt>
        <dd>
          Nombre de suites de tests écrites par des chercheurs ou une administration (par exemple les exemples Catala
          d’Inria) dont le <strong>dernier</strong> rejeu dans notre image épinglée du compilateur a réussi, sur le nombre de
          suites rejouées (réussies, en échec ou en erreur). Une suite qui ne contient aucun test n’est pas comptée : elle
          ne démontre rien.
        </dd>
      </div>
      <div id="compteur-couverture">
        <dt class="font-semibold">Identifiants d’articles cités par la recherche</dt>
        <dd>
          Nombre d’identifiants LEGIARTI distincts cités par une formalisation de référence (par exemple
          <span class="mono">CatalaLang/catala-examples</span>), et combien d’entre eux correspondent à une version
          présente dans notre base. Être cité ne donne pas le niveau ★.
        </dd>
      </div>
      <div id="compteur-journal">
        <dt class="font-semibold">Derniers événements</dt>
        <dd>
          Les contrôles, les chargements de textes et les mises à jour des articles ★ sont regroupés par type
          et par jour civil, à l’heure de Paris. Chaque groupe donne accès à ses fiches. L’accueil affiche les
          trois entrées ou groupes les plus récents. Pour les anomalies, le journal présente les événements de qualification
          favorable et de publication.
        </dd>
      </div>
    </dl>

    <h2 id="empreinte">Texte officiel et empreinte</h2>
    <p>
      Les textes proviennent uniquement de la base LEGI publiée par la DILA (Licence Ouverte). Chaque version d’article
      garde son identifiant LEGIARTI, ses dates et une empreinte SHA-256 de son texte normalisé (balises retirées,
      espaces, apostrophes et guillemets unifiés). Une formalisation n’atteint N1 que si le texte qu’elle cite a
      exactement la même empreinte. Le texte qui fait foi reste celui publié sur Légifrance.
    </p>

    <h2 id="limites">Ce que nous ne prétendons pas</h2>
    <ul>
      <li>
        <strong>Catala ne prouve pas qu’une traduction est fidèle à la loi.</strong> Le compilateur garantit le typage et
        signale les conflits d’exceptions ou les cas non couverts sur les entrées testées. La fidélité au texte se juge
        par des sources indépendantes et des relecteurs humains, d’où l’échelle de niveaux.
      </li>
      <li>
        <strong>Une projection n’est pas une preuve.</strong> Toute simulation dans le temps reposera sur des hypothèses
        économiques affichées et réglables, jamais colorées comme un niveau de preuve.
      </li>
      <li>
        <strong>Pas de chiffrage national sans données légitimes.</strong> Les effets par décile nécessitent des données
        fiscales à accès restreint. Nous travaillons sur des cas types, et sur des populations synthétiques présentées
        comme telles.
      </li>
      <li>
        <strong>Pas de jugement politique.</strong> Nous décrivons ce que fait une règle, pas ce qu’il faudrait en penser.
      </li>
      <li>
        <strong>Pas un service officiel, pas un conseil juridique.</strong> Pour votre situation, adressez-vous à
        l’administration concernée ou à un professionnel du droit.
      </li>
    </ul>

    <h2 id="faq">Questions fréquentes</h2>
    <h3>Comment savoir que l’IA n’invente pas la loi ?</h3>
    <p>
      Le texte n’est jamais écrit par une IA : il est chargé depuis LEGI et identifié par son LEGIARTI et son empreinte.
      Une formalisation doit citer ce texte à l’identique, et chaque montant, taux ou seuil doit être rattaché à l’alinéa
      qui le fixe. Ensuite, ce n’est pas une IA qui juge : ce sont le compilateur, des cas de test issus de sources
      indépendantes (dont au moins une non issue d’une IA), et pour le niveau N5 un relecteur juriste qui signe.
    </p>
    <h3>Un niveau élevé veut-il dire que la traduction est juste ?</h3>
    <p>
      Il dit exactement quels contrôles ont réussi, rien de plus. Une réfutation reste toujours possible ; elle est
      d’ailleurs créditée comme un résultat à part entière.
    </p>
    <h3>Pourquoi tant de zéros sur la page d’accueil ?</h3>
    <p>
      Parce que le projet commence. Nous affichons les chiffres réels, y compris quand ils sont nuls, plutôt que des
      objectifs ou des estimations.
    </p>
    <h3>Qui peut contribuer ?</h3>
    <p>
      Bientôt, toute personne disposant d’un agent de code (et de son propre abonnement) pourra lui confier des tâches
      depuis <a href="/join">la page Participer</a>. Les juristes relecteurs seront particulièrement bienvenus.
    </p>
  </div>
</div>
