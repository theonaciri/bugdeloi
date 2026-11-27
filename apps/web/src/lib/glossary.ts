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
    short:
      'Unité élémentaire d’un code législatif ou réglementaire (par exemple l’article 278 du Code général des impôts).',
    more: 'Un article évolue au fil des réformes. Chaque rédaction successive constitue une version distincte.',
  },
  {
    id: 'version',
    term: 'Version d’un article',
    group: 'loi',
    short: 'Rédaction datée d’un article, applicable entre une date de début et une date de fin.',
    more: 'Légifrance attribue à chaque version un identifiant unique. BugDeLoi en calcule l’empreinte numérique afin de détecter toute modification du texte.',
    technical: 'LEGIARTI, text_sha256',
  },
  {
    id: 'en-vigueur',
    term: 'En vigueur',
    group: 'loi',
    short: 'Applicable à la date de la dernière mise à jour officielle du code.',
    more: 'Le nombre d’articles en vigueur est recalculé chaque nuit à la date de projection publiée par la DILA.',
  },
  {
    id: 'legi',
    term: 'LEGI (DILA)',
    group: 'loi',
    short:
      'Base officielle des codes et lois en vigueur diffusée par la Direction de l’information légale et administrative, qui alimente Légifrance.',
    more: 'BugDeLoi importe ces archives chaque nuit et formalise uniquement le texte officiel qu’elles contiennent.',
  },
  {
    id: 'catala',
    term: 'Catala',
    group: 'loi',
    short:
      'Langage de programmation conçu par des chercheurs de l’Inria pour formaliser des textes juridiques sous forme de calculs exécutables.',
    more: 'Le code s’écrit directement sous chaque alinéa, modélise les principes et leurs exceptions, et signale à l’exécution les conflits d’exceptions ou les cas non couverts.',
  },
  {
    id: 'appreciation',
    term: 'Entrée d’appréciation',
    group: 'loi',
    short:
      'Notion juridique qui relève d’une évaluation humaine (par exemple « faute grave » ou « délai raisonnable »). Elle reste déclarée comme entrée explicite du calcul plutôt que traduite par une formule arbitraire.',
    technical: 'appréciation_…',
  },
  // Le travail
  {
    id: 'tache',
    term: 'Tâche',
    group: 'travail',
    short:
      'Unité de travail portant sur un article et un rôle précis, par exemple analyser l’article 172 du CGI.',
    more: 'Une fois contrôlée et fusionnée, la tâche fait progresser l’article au niveau suivant.',
  },
  {
    id: 'guichet',
    term: 'Guichet',
    group: 'travail',
    short: 'Service qui attribue les tâches une par une aux contributeurs qui en font la demande.',
    more: 'Il gère une file ordonnée des tâches à prendre. Ce composant joue le rôle d’orchestrateur.',
    technical: 'GET /desk/next',
  },
  {
    id: 'reservation',
    term: 'Réservation',
    group: 'travail',
    short:
      'Verrou temporaire attribuant une tâche à un seul contributeur pendant 20 minutes, renouvelable jusqu’à 6 heures au maximum.',
    more: 'En l’absence de renouvellement, la réservation expire et la tâche revient en tête de liste.',
    technical: 'bail (lease), /desk/beat',
  },
  {
    id: 'role',
    term: 'Rôle',
    group: 'travail',
    short:
      'Nature du travail demandé pour une tâche : analyse, traduction, rédaction d’oracles, recherche de contre-exemples ou relecture.',
    more: 'Chaque tâche correspond à un rôle unique. L’auteur d’une contribution ne peut jamais en assurer le contrôle.',
  },
  {
    id: 'analyse',
    term: 'Analyse',
    group: 'travail',
    short:
      'Examen d’un article alinéa par alinéa afin de distinguer les règles calculables, les entrées d’appréciation et les passages hors périmètre.',
    more: 'L’analyse propose également l’interface du futur calcul et fait passer l’article au niveau N1.',
    technical: 'rôle analyst',
  },
  {
    id: 'interface',
    term: 'Interface',
    group: 'travail',
    short:
      'Signature formelle des entrées et des sorties d’un article, figée avant l’écriture du code : elle l’est dès que la fiche d’analyse qui la propose est fusionnée dans le dépôt.',
    more: 'Cette séparation empêche d’ajuster la spécification à l’implémentation et permet de rédiger des cas de test sans accès au code.',
    technical: 'Nom@vN',
  },
  {
    id: 'traduction',
    term: 'Traduction',
    group: 'travail',
    short:
      'Formalisation des règles d’un article en Catala sous le texte officiel, conformément à son interface figée.',
    more: 'Elle fait passer l’article au niveau N2 lorsque le compilateur accepte le code et que les tests réussissent.',
    technical: 'rôle translate',
  },
  {
    id: 'relecture-pr',
    term: 'En relecture',
    group: 'travail',
    short:
      'État d’une contribution déposée dans le dépôt public en attente des contrôles automatiques et de la fusion.',
    technical: 'pull request',
  },
  {
    id: 'famille',
    term: 'Famille de modèles',
    group: 'travail',
    short:
      'Fournisseur du modèle d’IA ayant produit une contribution (Anthropic, OpenAI, Google, Mistral…), ou la mention « humain ».',
    more: 'Tout test ou contrôle indépendant doit provenir d’une autre famille que celle de l’auteur afin de limiter les erreurs corrélées.',
  },
  // Les contrôles
  {
    id: 'niveau',
    term: 'Niveau de preuve',
    group: 'preuve',
    short:
      'Dernier contrôle validé pour un article, sur une échelle cumulative allant de N0 (texte importé) à N5 (relecture signée par un juriste).',
    more: 'Chaque passage de niveau repose sur un programme déterministe ou sur une revue humaine signée. L’avis d’une IA ne constitue jamais une preuve.',
  },
  {
    id: 'compilateur',
    term: 'Compilateur',
    group: 'preuve',
    short:
      'Programme qui analyse le code Catala et rejette toute incohérence de syntaxe, de typage ou de référence.',
    more: 'BugDeLoi exécute une image de compilation figée par empreinte cryptographique afin de garantir des résultats reproductibles.',
  },
  {
    id: 'oracle',
    term: 'Oracle',
    group: 'preuve',
    short:
      'Source indépendante fournissant le résultat attendu d’un calcul : exemple du BOFiP, brochure officielle, OpenFisca ou suite de tests de l’Inria.',
    more: 'Le compilateur contrôle la cohérence interne du code, sans pouvoir juger de sa conformité au texte de loi. L’oracle compare les sorties du programme à des valeurs de référence établies sans accès au code.',
  },
  {
    id: 'red-team',
    term: 'Contre-exemple',
    group: 'preuve',
    short:
      'Jeu d’entrées concret pour lequel la traduction produit un résultat contraire au texte de loi. Une réfutation documentée a la même valeur scientifique qu’une validation.',
    technical: 'rôle redteam',
  },
  {
    id: 'retro-traduction',
    term: 'Rétro-traduction',
    group: 'preuve',
    short:
      'Reformulation en français d’un programme Catala par un lecteur sans accès au texte officiel, suivie d’une comparaison avec la loi.',
    technical: 'rôles backtranslate, judge',
  },
  {
    id: 'reference',
    term: '★ Référence',
    group: 'preuve',
    short:
      'Article dont la version en vigueur est déjà formalisée par la recherche publique ou une administration (Inria, DGFiP, CNAF), avec une suite de tests rejouée avec succès dans notre environnement épinglé.',
    more: 'Ce marqueur identifie un travail extérieur à BugDeLoi qui sert de point de comparaison.',
  },
  {
    id: 'certificat',
    term: 'Certificat',
    group: 'preuve',
    short:
      'Fichier qui fixe les versions exactes du texte, du code et du compilateur afin que tout tiers puisse reproduire un résultat à l’identique.',
    technical: 'bdl replay',
  },
  // Les constats
  {
    id: 'constat',
    term: 'Constat',
    group: 'constats',
    short:
      'Anomalie potentielle détectée dans un texte de loi (renvoi vers un article abrogé, conflit de règles, effet de seuil…), avant qualification humaine.',
  },
  {
    id: 'reproduit',
    term: 'Reproduit',
    group: 'constats',
    short:
      'Constat confirmé par une seconde chaîne indépendante utilisant un code et des données traités séparément.',
  },
  {
    id: 'qualifie',
    term: 'Qualifié',
    group: 'constats',
    short:
      'Constat examiné par un relecteur humain ayant consigné un verdict motivé et signé. Seuls les constats qualifiés entrent dans les compteurs publics.',
  },
  {
    id: 'renvoi-mort',
    term: 'Renvoi vers un article abrogé',
    group: 'constats',
    short: 'Citation, dans un article en vigueur, d’un autre article qui n’est plus applicable.',
    more: 'Ce cas ne constitue pas nécessairement une erreur. Certains renvois visent délibérément une rédaction antérieure ou une mesure transitoire.',
    technical: 'REF_MORTE',
  },
  {
    id: 'falaise',
    term: 'Effet de falaise',
    group: 'constats',
    short: 'Seuil au-delà duquel une hausse de revenu d’un euro entraîne une baisse du revenu disponible.',
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
