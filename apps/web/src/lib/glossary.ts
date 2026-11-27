/**
 * Glossaire unique du site. Une définition par mot, en français courant ; le terme technique
 * vient en second. Toute page qui emploie un de ces mots s'appuie sur ce fichier
 * (composant `Term`, page /methode#glossaire). Les niveaux N0–N5 restent définis par
 * `LEVEL_INFO` (@bugdeloi/core/levels), source normative alignée sur AGENTS.md §4.1.
 */

export type GlossaryGroup = 'loi' | 'travail' | 'preuve' | 'constats'

export interface GlossaryEntry {
  id: string
  term: string
  group: GlossaryGroup
  /** Une phrase, compréhensible sans connaissance technique. */
  short: string
  /** Précision pour qui veut aller plus loin (optionnelle). */
  more?: string
  /** Nom technique ou identifiant employé dans le code et l'API. */
  technical?: string
}

export const GLOSSARY_GROUPS: Record<GlossaryGroup, string> = {
  loi: 'Les textes',
  travail: 'Le travail',
  preuve: 'Les contrôles',
  constats: 'Les constats',
}

const entries: GlossaryEntry[] = [
  // Les textes
  {
    id: 'article',
    term: 'Article',
    group: 'loi',
    short: 'L’unité de base d’un code de loi (par exemple « article 278 du Code général des impôts »).',
    more: 'Un article change au fil des réformes : chaque rédaction successive est une version distincte.',
  },
  {
    id: 'version',
    term: 'Version d’un article',
    group: 'loi',
    short: 'Une rédaction précise d’un article, valable entre deux dates.',
    more: 'Légifrance donne à chaque version un identifiant unique et nous en gardons l’empreinte numérique pour détecter le moindre changement de texte.',
    technical: 'LEGIARTI, text_sha256',
  },
  {
    id: 'en-vigueur',
    term: 'En vigueur',
    group: 'loi',
    short: 'Qui s’applique à la date de la dernière mise à jour officielle du code.',
    more: 'Le nombre d’articles en vigueur est recalculé chaque nuit, à la date de la dernière mise à jour publiée par la DILA.',
  },
  {
    id: 'legi',
    term: 'LEGI (DILA)',
    group: 'loi',
    short: 'La base officielle des textes de loi publiée par l’État, celle qui alimente Légifrance.',
    more: 'BugDeLoi l’importe chaque nuit et ne travaille que sur ce texte authentique.',
  },
  {
    id: 'catala',
    term: 'Catala',
    group: 'loi',
    short:
      'Un langage de programmation conçu par des chercheurs de l’Inria pour écrire la loi sous forme de calcul exécutable.',
    more: 'Le code s’écrit sous chaque alinéa du texte, gère les règles et leurs exceptions, et signale un conflit entre deux exceptions ou un cas que le texte ne couvre pas.',
  },
  {
    id: 'appreciation',
    term: 'Entrée d’appréciation',
    group: 'loi',
    short:
      'Une notion que seul un humain peut trancher (« faute grave », « délai raisonnable ») : on la laisse comme une donnée d’entrée, jamais comme une formule inventée.',
    technical: 'appréciation_…',
  },
  // Le travail
  {
    id: 'tache',
    term: 'Tâche',
    group: 'travail',
    short: 'Un travail précis sur un article précis : par exemple « analyser l’article 172 du CGI ».',
    more: 'Une tâche a un rôle (analyse, traduction…) et fait monter l’article d’un niveau quand elle est intégrée.',
  },
  {
    id: 'guichet',
    term: 'Guichet',
    group: 'travail',
    short: 'Le programme qui distribue les tâches, une par une, aux contributeurs qui en demandent.',
    more: 'Il ne connaît qu’une liste : les tâches à prendre, dans un ordre fixe. On parle aussi d’orchestrateur.',
    technical: 'GET /desk/next',
  },
  {
    id: 'reservation',
    term: 'Réservation',
    group: 'travail',
    short:
      'Quand un contributeur prend une tâche, personne d’autre ne la reçoit pendant 20 minutes, prolongées à chaque signe de vie (6 heures au plus).',
    more: 'Sans signe de vie, la réservation expire et la tâche revient dans la liste.',
    technical: 'bail (lease), /desk/beat',
  },
  {
    id: 'role',
    term: 'Rôle',
    group: 'travail',
    short:
      'La nature du travail demandé : analyser, traduire, écrire des tests, chercher des contre-exemples, relire.',
    more: 'Chaque tâche a un seul rôle, et l’auteur d’un travail ne peut jamais en être le contrôleur.',
  },
  {
    id: 'analyse',
    term: 'Analyse',
    group: 'travail',
    short:
      'Lire un article alinéa par alinéa et dire ce qui se calcule, ce qui relève d’une appréciation humaine et ce qui sort du sujet.',
    more: 'L’analyse propose aussi l’interface du futur calcul. Elle fait passer l’article au niveau N1.',
    technical: 'rôle analyst',
  },
  {
    id: 'interface',
    term: 'Interface',
    group: 'travail',
    short: 'La liste des entrées et des sorties du calcul d’un article, fixée avant d’écrire le code.',
    more: 'La fixer à l’avance empêche le traducteur d’adapter la question à sa réponse, et permet d’écrire des tests sans voir le code.',
    technical: 'Nom@vN',
  },
  {
    id: 'traduction',
    term: 'Traduction',
    group: 'travail',
    short: 'Écrire le calcul d’un article en Catala, sous le texte officiel, en respectant l’interface.',
    more: 'Elle fait passer l’article au niveau N2 quand le compilateur l’accepte et que ses tests passent.',
    technical: 'rôle translate',
  },
  {
    id: 'relecture-pr',
    term: 'En relecture',
    group: 'travail',
    short: 'Le travail est déposé dans le dépôt public et attend les contrôles automatiques puis la fusion.',
    technical: 'pull request',
  },
  {
    id: 'famille',
    term: 'Famille de modèles',
    group: 'travail',
    short:
      'Le fournisseur de l’IA qui a produit un travail (Anthropic, OpenAI, Google, Mistral…), ou « humain ».',
    more: 'Un test ou une relecture doit venir d’une autre famille que l’auteur, pour éviter des erreurs partagées.',
  },
  // Les contrôles
  {
    id: 'niveau',
    term: 'Niveau de preuve',
    group: 'preuve',
    short:
      'Le dernier contrôle réussi par un article, de N0 (texte importé) à N5 (relu et signé par un juriste).',
    more: 'Chaque niveau est contrôlé par un programme ou par un humain identifié, jamais par l’avis d’une IA.',
  },
  {
    id: 'compilateur',
    term: 'Compilateur',
    group: 'preuve',
    short:
      'Le programme qui lit le code Catala et refuse tout ce qui est incohérent (types faux, renvoi inconnu).',
    more: 'Nous l’utilisons dans une version figée par empreinte : tout le monde obtient le même résultat.',
  },
  {
    id: 'oracle',
    term: 'Oracle',
    group: 'preuve',
    short:
      'Une source indépendante qui donne le résultat attendu d’un calcul : exemple chiffré du BOFiP, brochure officielle, OpenFisca, tests de l’Inria.',
    more: 'Le compilateur vérifie que le code est cohérent, pas qu’il calcule juste. L’oracle compare au résultat attendu, écrit sans voir le code.',
  },
  {
    id: 'red-team',
    term: 'Contre-exemple',
    group: 'preuve',
    short:
      'Un cas concret où la traduction donne un résultat contraire au texte. En trouver un vaut autant qu’une preuve.',
    technical: 'rôle redteam',
  },
  {
    id: 'retro-traduction',
    term: 'Rétro-traduction',
    group: 'preuve',
    short:
      'Faire reformuler le code en français par quelqu’un qui n’a pas vu le texte, puis comparer au texte officiel.',
    technical: 'rôles backtranslate, judge',
  },
  {
    id: 'reference',
    term: '★ Référence',
    group: 'preuve',
    short:
      'Un article déjà formalisé par la recherche publique ou l’administration (Inria, DGFiP, CNAF), dont les tests passent chez nous.',
    more: 'Ce n’est pas un travail de BugDeLoi : c’est un point de comparaison.',
  },
  {
    id: 'certificat',
    term: 'Certificat',
    group: 'preuve',
    short:
      'Un fichier qui fixe les versions exactes (texte, code, compilateur) pour que n’importe qui puisse rejouer un résultat.',
    technical: 'bdl replay',
  },
  // Les constats
  {
    id: 'constat',
    term: 'Constat',
    group: 'constats',
    short:
      'Un signalement possible dans la loi (renvoi vers un article abrogé, conflit, effet de seuil…), tant qu’un humain ne l’a pas jugé.',
  },
  {
    id: 'reproduit',
    term: 'Reproduit',
    group: 'constats',
    short: 'Un constat confirmé par une seconde chaîne indépendante (autre code, autres données).',
  },
  {
    id: 'qualifie',
    term: 'Qualifié',
    group: 'constats',
    short:
      'Un constat jugé par un humain, avec un verdict motivé et signé. Seuls ces constats entrent dans les compteurs publics.',
  },
  {
    id: 'renvoi-mort',
    term: 'Renvoi vers un article abrogé',
    group: 'constats',
    short: 'Un article en vigueur qui cite un autre article qui ne s’applique plus.',
    more: 'Ce n’est pas toujours une erreur : certains renvois visent volontairement une ancienne rédaction.',
    technical: 'REF_MORTE',
  },
  {
    id: 'falaise',
    term: 'Effet de falaise',
    group: 'constats',
    short: 'Un seuil où gagner un euro de plus fait perdre davantage en impôts ou en aides.',
    technical: 'FALAISE',
  },
]

export const GLOSSARY: Record<string, GlossaryEntry> = Object.fromEntries(entries.map((e) => [e.id, e]))
export const GLOSSARY_LIST: GlossaryEntry[] = entries

export function glossary(id: string): GlossaryEntry {
  const entry = GLOSSARY[id]
  if (!entry) throw new Error(`Terme de glossaire inconnu : ${id}`)
  return entry
}
