type Diagram = {
  from: string
  to: string
  relation: string
  secondSource?: string
  example?: boolean
}

const diagrams = {
  ingest: { from: 'Archives de la DILA', to: 'Base BugDeLoi', relation: 'Importer' },
  replication: { from: 'Tests de référence', to: 'Résultats des tests', relation: 'Relancer' },
  reference: { from: 'Tests de référence', to: 'Article en vigueur', relation: 'Rattacher' },
  sweep: {
    from: 'Article A',
    to: 'Article B abrogé',
    relation: 'Cite',
    example: true,
  },
  reproduction: {
    from: 'Première chaîne',
    secondSource: 'Chaîne indépendante',
    to: 'Comparer les constats',
    relation: '',
  },
  review: { from: 'Constat reproduit', to: 'Verdict humain', relation: 'Relire' },
  publication: { from: 'Verdict motivé', to: 'Fiche publique', relation: 'Publier' },
  level: { from: 'Contrôles du nœud', to: 'Niveau affiché', relation: 'Actualiser' },
  deployment: { from: 'Version du code', to: 'Site en ligne', relation: 'Mettre en ligne' },
} satisfies Record<string, Diagram>

type Explanation = {
  title: string
  why: string
  meaning: string
  next: string
  diagram?: Diagram
}

const importWhy =
  'La Direction de l’information légale et administrative (DILA), qui publie Légifrance, diffuse les textes de loi officiels sous forme d’archives publiques. BugDeLoi importe ces archives afin de travailler exclusivement sur le texte authentique, daté jour par jour.'
const replayWhy =
  'Des équipes de recherche publique (Inria) et des administrations ont formalisé certains articles en programmes exécutables. BugDeLoi exécute leurs suites de tests officielles dans un environnement épinglé afin de contrôler la reproductibilité des résultats.'
const referenceMeaning =
  'Ce résultat concerne des programmes développés par des chercheurs ou des administrations. Les niveaux N0 à N5 mesurent séparément les contrôles réalisés par BugDeLoi.'

const deskWhy =
  'Le guichet distribue le travail sur le corpus, une tâche à la fois (un rôle pour un article). Chaque réservation et chaque libération est consignée au journal afin de retracer le parcours complet de chaque tâche.'

const events: Record<string, Explanation> = {
  'desk.claimed': {
    title: 'Réservation d’une tâche',
    why: deskWhy,
    meaning:
      'Un contributeur (humain ou agent IA) travaille actuellement sur cette tâche. Tant que sa réservation est active (20 minutes, renouvelables jusqu’à 6 heures), la tâche n’est pas attribuée à un autre participant.',
    next: 'Le contributeur dépose sa proposition (la tâche passe en relecture), rend la tâche avec un motif, ou laisse la réservation expirer (la tâche revient dans la liste).',
    diagram: { from: 'Tâche à prendre', to: 'Tâche en cours', relation: 'Réserver' },
  },
  'desk.released': {
    title: 'Dépôt ou restitution d’une tâche',
    why: deskWhy,
    meaning:
      'Avec le motif « travail déposé », la contribution attend les contrôles automatiques et la fusion dans le corpus. Avec tout autre motif, la tâche revient dans la liste des tâches à prendre.',
    next: 'Après fusion de la contribution, les contrôles automatiques font progresser l’article au niveau suivant (N1 pour une analyse, N2 pour une traduction).',
    diagram: { from: 'Tâche en cours', to: 'Tâche en relecture', relation: 'Déposer' },
  },
  article_promoted: {
    title: 'Promotion d’articles formalisés en Catala',
    why: 'Un article traduit en Catala progresse de niveau après contrôle automatique : le texte cité doit correspondre à l’identique à LEGI, et le code doit compiler et réussir ses tests dans la version épinglée de Catala (1.3.2), sans accès réseau.',
    meaning:
      'Ces articles ont franchi l’ensemble de ces contrôles sans erreur de compilation, sans conflit d’exceptions et sans cas non couvert. Ils sont désormais classés au niveau N2.',
    next: 'Les étapes suivantes consistent à rédiger des cas d’oracle sans accès au code (N3), à mener un test différentiel sur 10 000 cas (N4), puis à obtenir la revue signée d’un juriste (N5).',
    diagram: diagrams.level,
  },
  'ingest.started': {
    title: 'Le chargement des textes officiels a commencé',
    why: importWhy,
    meaning: 'Le journal signale le début du traitement. Son résultat reste à venir.',
    next: 'Le journal enregistre la réussite ou l’échec du chargement.',
    diagram: diagrams.ingest,
  },
  'ingest.finished': {
    title: 'Les textes officiels ont été chargés',
    why: importWhy,
    meaning:
      'Les versions chargées peuvent servir de point de départ. Leur traduction en code et ses contrôles sont des étapes ultérieures.',
    next: 'Les programmes peuvent examiner les textes et les renvois entre articles.',
    diagram: diagrams.ingest,
  },
  'ingest.failed': {
    title: 'Le chargement des textes officiels a échoué',
    why: importWhy,
    meaning:
      'Cette entrée décrit un échec de traitement. Elle ne permet pas de savoir quels codes ont été mis à jour.',
    next: 'L’équipe cherche la cause avant de relancer le traitement.',
    diagram: { ...diagrams.ingest, relation: 'Échec' },
  },
  'replication.started': {
    title: 'Les tests de référence ont commencé',
    why: replayWhy,
    meaning: 'Cette entrée consigne le lancement des tests. Leur résultat reste à venir.',
    next: 'Le résultat est enregistré à la fin de l’exécution des tests.',
    diagram: diagrams.replication,
  },
  'replication.passed': {
    title: 'Les tests de référence ont réussi',
    why: replayWhy,
    meaning: referenceMeaning,
    next: 'Le projet peut rechercher quelles versions d’articles sont couvertes par ces tests.',
    diagram: { ...diagrams.replication, to: 'Tests réussis' },
  },
  'replication.failed': {
    title: 'Les tests de référence ont échoué',
    why: replayWhy,
    meaning:
      'Cette exécution n’a pas abouti au résultat attendu. Cette entrée ne permet pas d’en attribuer la cause au texte de loi.',
    next: 'L’équipe peut examiner le résultat avant de relancer les tests.',
    diagram: { ...diagrams.replication, to: 'Tests en échec' },
  },
  'replication.finished': {
    title: 'L’exécution des tests de référence est terminée',
    why: replayWhy,
    meaning:
      'Chaque suite a son propre résultat. La fin du traitement ne garantit pas que toutes les suites ont réussi.',
    next: 'Les suites réussies peuvent servir à rattacher le marqueur ★ aux versions couvertes.',
    diagram: diagrams.replication,
  },
  'coverage.recorded': {
    title: 'Les articles cités dans les travaux de référence ont été recensés',
    why: 'Le projet relie les identifiants relevés dans ces travaux aux textes officiels.',
    meaning:
      'Une mention indique où chercher. Le marqueur ★ exige aussi la version en vigueur et une suite de tests réussie.',
    next: 'Le projet peut contrôler quelles versions remplissent les conditions du marqueur ★.',
    diagram: {
      ...diagrams.reference,
      from: 'Travaux de référence',
      to: 'Versions citées',
      relation: 'Recenser',
    },
  },
  'reference.promoted': {
    title: 'Les marqueurs ★ ont été actualisés',
    why: 'Le projet rapproche les tests réussis de la version en vigueur de chaque article couvert.',
    meaning: referenceMeaning,
    next: 'Le rattachement pourra être recalculé après une évolution des textes ou des résultats des tests.',
    diagram: { ...diagrams.reference, to: 'Article en vigueur ★' },
  },
  'sweep.finished': {
    title: 'Les contrôles automatiques des textes sont terminés',
    why: 'Des programmes cherchent des irrégularités, par exemple un article en vigueur qui renvoie vers un article abrogé.',
    meaning:
      'Les nombres d’articles examinés décrivent le périmètre du contrôle. Un signalement automatique reste un candidat.',
    next: 'Une chaîne indépendante examine le signalement avant une éventuelle relecture humaine.',
    diagram: diagrams.sweep,
  },
  'reproduction.finished': {
    title: 'Une chaîne indépendante a terminé son contrôle',
    why: 'Une autre chaîne examine les signalements sur des données traitées séparément.',
    meaning:
      'La comparaison peut confirmer un constat, l’infirmer ou laisser la question ouverte. La qualification demande encore un verdict humain.',
    next: 'Un humain peut examiner les constats reproduits et motiver son verdict.',
    diagram: diagrams.reproduction,
  },
  'finding.qualified': {
    title: 'Un humain a qualifié un constat',
    why: 'Un relecteur a examiné le constat reproduit et consigné son verdict motivé dans un commit.',
    meaning:
      'Le verdict favorable permet de compter le constat parmi les anomalies qualifiées. La publication est une étape distincte.',
    next: 'Le projet peut passer la fiche au statut publié.',
    diagram: diagrams.review,
  },
  'finding.published': {
    title: 'Une anomalie qualifiée a été publiée',
    why: 'Le projet rend le constat reproduit et qualifié consultable avec son certificat.',
    meaning:
      'La fiche documente le constat et le verdict humain. Une éventuelle modification du texte relève de la procédure législative ou réglementaire.',
    next: 'Le lecteur peut consulter le verdict et reproduire le résultat à l’aide du certificat.',
    diagram: diagrams.publication,
  },
  'level.changed': {
    title: 'Le statut d’un article a changé',
    why: 'Le journal enregistre les changements de niveau de preuve ou l’ouverture d’une objection.',
    meaning:
      'Le niveau affiché résume les contrôles atteints. Une objection ouverte gèle le niveau affiché jusqu’à sa résolution.',
    next: 'La fiche de l’article donne le niveau affiché et les éventuels drapeaux.',
    diagram: diagrams.level,
  },
  'site.deployed': {
    title: 'Une version du site a été mise en ligne',
    why: 'Le projet met en service une version de son interface.',
    meaning:
      'Cet événement concerne le site. Les constats et niveaux de preuve suivent leurs propres contrôles.',
    next: 'La page d’état indique si le service répond.',
    diagram: diagrams.deployment,
  },
}

const unknownEvent: Explanation = {
  title: 'Une activité a été enregistrée',
  why: 'Le journal garde la trace des opérations du projet.',
  meaning: 'Ce type d’événement n’a pas encore de description détaillée.',
  next: 'Le journal permet de suivre les opérations plus récentes.',
}

export function explainEvent(type: string): Explanation {
  return Object.hasOwn(events, type) ? (events[type] ?? unknownEvent) : unknownEvent
}

export function eventHref(id: number) {
  return `/evenement/${id}`
}

export const journalGroupLabels = {
  'sweep.finished': 'contrôles automatiques',
  'reproduction.finished': 'contrôles indépendants',
  'ingest.finished': 'chargements de textes officiels',
  'reference.promoted': 'mises à jour des articles ★',
  'desk.claimed': 'réservations de tâches',
  'desk.released': 'tâches déposées ou rendues',
} as const

export function journalGroupLabel(type: string): string {
  return Object.hasOwn(journalGroupLabels, type)
    ? journalGroupLabels[type as keyof typeof journalGroupLabels]
    : 'événements'
}

export function replayStatus(status: string) {
  switch (status) {
    case 'running':
      return 'Tests en cours'
    case 'passed':
      return 'Tests réussis'
    case 'failed':
      return 'Tests en échec'
    case 'error':
      return 'Impossible de terminer l’exécution des tests'
    case 'no_tests':
      return 'Aucun test à lancer'
    default:
      return 'Résultat non renseigné'
  }
}
