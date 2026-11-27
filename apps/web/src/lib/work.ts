/**
 * Le parcours d'un article et le tableau du travail — vocabulaire et types partagés
 * serveur/navigateur. Aucun nombre ici : les comptes viennent de `lib/server/work.ts`.
 *
 * Deux notions, à ne pas confondre :
 * - l'**étape** (`Stage`) : ce qu'il faut faire à un article pour qu'il monte d'un niveau
 *   (analyser → N1, traduire → N2, …) ;
 * - la **colonne** (`Column`) : où en est une tâche de cette étape
 *   (à prendre → en cours → en relecture → intégrée).
 * Le guichet (`GET /desk/next`) ne connaît qu'un état : « à prendre ».
 */
import type { Level } from './levels.ts'

export const STAGES = ['analyse', 'traduction', 'oracles', 'epreuve', 'relecture'] as const
export type Stage = (typeof STAGES)[number]

export const COLUMNS = ['todo', 'doing', 'review', 'done'] as const
export type Column = (typeof COLUMNS)[number]

export type Actor = 'machine' | 'agent' | 'humain'

export interface StageInfo {
  stage: Stage
  /** Verbe à l'infinitif, affiché tel quel : « Analyser ». */
  verb: string
  /** Rôle(s) du guichet qui font cette étape (vide = pas distribué par le guichet). */
  roles: string[]
  /** Niveau visé quand l'étape est intégrée. */
  from: Level
  to: Level
  actor: Actor
  /** Qui agit, en une ligne. */
  who: string
  /** Ce que l'on fait, en une phrase sans jargon. */
  what: string
  /** Le contrôle mécanique ou humain qui fait monter le niveau. */
  check: string
  /** Vrai si le guichet distribue déjà des tâches de cette étape. */
  open: boolean
  /** Définition opérationnelle d'une tâche de cette étape (rôles ouverts au guichet). */
  task?: {
    receives: string
    produces: string
    file: string
    refused: string
  }
}

export const STAGE_INFO: Record<Stage, StageInfo> = {
  analyse: {
    stage: 'analyse',
    verb: 'Analyser',
    roles: ['analyst'],
    from: 'N0',
    to: 'N1',
    actor: 'agent',
    who: 'Un agent IA ou un contributeur',
    what: 'Lit l’article alinéa par alinéa, classe ce qui est calculable, ce qui relève d’une appréciation humaine et ce qui est hors périmètre, puis propose les entrées et les sorties du calcul.',
    check: 'La fiche reproduit le texte officiel à l’identique et passe les contrôles automatiques du dépôt.',
    open: true,
    task: {
      receives:
        'Le texte officiel de la version en vigueur, son identifiant LEGIARTI, son empreinte et le code dont il relève.',
      produces:
        'Une fiche d’analyse : l’interface proposée (nom, entrées et sorties avec leur type Catala) et le classement de chaque alinéa en calculable, entrée d’appréciation ou hors périmètre, avec les renvois et les ambiguïtés repérés.',
      file: 'corpus/analyses/<LEGIARTI>.md',
      refused:
        'Pas de code Catala, pas de montant ni de seuil tiré de la mémoire, pas d’interprétation tranchée en silence : une lecture incertaine se signale.',
    },
  },
  traduction: {
    stage: 'traduction',
    verb: 'Traduire',
    roles: ['translate'],
    from: 'N1',
    to: 'N2',
    actor: 'agent',
    who: 'Un agent IA ou un contributeur',
    what: 'Écrit les règles de calcul en Catala sous chaque alinéa du texte, en respectant les entrées et sorties figées.',
    check:
      'Le compilateur Catala, dans sa version épinglée, compile le programme et exécute les tests sans erreur.',
    open: true,
    task: {
      receives:
        'Le texte officiel, son empreinte, l’interface figée par la fiche d’analyse fusionnée (entrées, sorties, types) et les cas de test déjà écrits.',
      produces:
        'Un fichier Catala lettré : le texte officiel recopié à l’identique, chaque alinéa suivi du code qui l’applique, chaque constante précédée de sa citation, et des tests avec assertions.',
      file: 'corpus/<code>/…/article_<numéro>.catala_fr',
      refused:
        'Modifier l’interface, copier le code de l’Inria ou de la DGFiP, inventer une formule pour une notion d’appréciation, écrire un test sans assertion.',
    },
  },
  oracles: {
    stage: 'oracles',
    verb: 'Tester',
    roles: ['oracle'],
    from: 'N2',
    to: 'N3',
    actor: 'agent',
    who: 'Un autre auteur que le traducteur, sans accès au code',
    what: 'Rédige des cas chiffrés tirés de sources officielles (BOFiP, brochures, OpenFisca) pour comparer les sorties du programme aux résultats attendus.',
    check: 'Tous les cas réussissent, dont au moins un tiré d’une source non issue d’une IA.',
    open: true,
    task: {
      receives:
        'Le texte officiel, l’interface publique (entrées, sorties, types Catala sans le corps des règles) et le chemin du code mis en blind_to.',
      produces:
        'Une suite de cas YAML (§4.3) couvrant au moins un seuil et contenant au moins un cas issu d’une source officielle ou de référence (BOFiP, brochure, OpenFisca, Inria, code M).',
      file: 'corpus/oracles/<code>/<legiarti>.yaml',
      refused:
        'Ouvrir le fichier .catala_fr listé dans blind_to, inventer un résultat sans source ni dérivation écrite, copier des tests déjà présents dans le code.',
    },
  },
  epreuve: {
    stage: 'epreuve',
    verb: 'Éprouver',
    roles: ['redteam'],
    from: 'N3',
    to: 'N4',
    actor: 'machine',
    who: 'Des programmes et des contributeurs en examen contradictoire',
    what: 'Comparent 10 000 cas générés à une implémentation indépendante, mesurent les mutations détectées et recherchent des contre-exemples.',
    check:
      'Aucun écart inexpliqué, au moins 80 % des mutations détectées et 7 jours d’examen ouvert sans contre-exemple retenu.',
    open: false,
  },
  relecture: {
    stage: 'relecture',
    verb: 'Relire',
    roles: [],
    from: 'N4',
    to: 'N5',
    actor: 'humain',
    who: 'Un juriste identifié',
    what: 'Relit les choix d’interprétation et signe la revue.',
    check: 'Une revue signée et enregistrée dans l’historique Git du dépôt.',
    open: false,
  },
}

export const COLUMN_INFO: Record<Column, { label: string; short: string; meaning: string }> = {
  todo: {
    label: 'À prendre',
    short: 'à prendre',
    meaning:
      'La tâche attend un contributeur. Le guichet l’attribue au prochain agent qui en fait la demande, dans l’ordre de la liste.',
  },
  doing: {
    label: 'En cours',
    short: 'en cours',
    meaning:
      'Un contributeur a réservé cette tâche. La réservation dure 20 minutes et se prolonge à chaque renouvellement, dans la limite de 6 heures.',
  },
  review: {
    label: 'En relecture',
    short: 'en relecture',
    meaning:
      'La contribution est déposée dans le dépôt public sous forme de proposition (pull request). Les contrôles automatiques et la fusion déterminent son intégration.',
  },
  done: {
    label: 'Intégrée',
    short: 'intégrées',
    meaning: 'La contribution est fusionnée dans le corpus et l’article a atteint le niveau visé.',
  },
}

/** Étape d'un rôle du guichet (`analyst` → `analyse`). */
export function stageOfRole(role: string): Stage | null {
  for (const s of STAGES) if (STAGE_INFO[s].roles.includes(role)) return s
  return null
}

export const ROLE_LABEL: Record<string, string> = {
  analyst: 'Analyse',
  translate: 'Traduction',
  oracle: 'Cas de test',
  redteam: 'Contre-exemples',
  backtranslate: 'Rétro-traduction',
  judge: 'Comparaison de sens',
  doctrine: 'Doctrine administrative',
  reduce: 'Découpage',
}

export const RELEASE_REASON_LABEL: Record<string, string> = {
  submitted: 'travail déposé',
  text_mismatch: 'texte différent de Légifrance',
  ambiguous_text: 'texte ambigu',
  missing_dependency: 'renvoi pas encore formalisé',
  interface_too_weak: 'interface insuffisante',
  needs_reduction: 'article à découper',
  out_of_time: 'temps écoulé',
  other: 'autre motif',
}

export interface TaskRef {
  taskId: string
  role: string
  legiarti: string | null
  /** « CGI art. 1657 » quand l'article est connu. */
  label: string
}

export interface BoardCard extends TaskRef {
  handle: string | null
  family: string | null
  /** Date du dernier changement de colonne (ISO). */
  since: string | null
}

export interface BoardLane {
  stage: Stage
  counts: Record<Column, number>
  /** Articles du niveau de départ qui ne sont pas encore devenus des tâches. */
  waiting: number
  cards: Record<Column, BoardCard[]>
}

export interface WorkMove {
  id: number
  ts: string
  kind: 'claimed' | 'released' | 'submitted' | 'promoted'
  taskId: string | null
  label: string
  handle: string | null
  family: string | null
  reason: string | null
  level: string | null
  count: number
}

export interface WorkBoard {
  enabled: boolean
  lanes: BoardLane[]
  moves: WorkMove[]
}

export type TaskColumn = Column

export interface TaskStep {
  ts: string
  kind: 'in_force' | 'claimed' | 'released' | 'expired' | 'submitted' | 'integrated'
  title: string
  detail: string
  handle: string | null
  family: string | null
}

export interface TaskJourney extends TaskRef {
  stage: Stage
  column: Column
  /** Vrai si la tâche n'est pas encore inscrite en base (calculée à la volée). */
  virtual: boolean
  /** Rang dans la liste des tâches à prendre de ce rôle (1 = prochaine distribuée). */
  position: number | null
  code: string | null
  codeTitle: string | null
  articleNum: string | null
  articleLevel: Level
  dateDebut: string | null
  text: string
  sourceUrl: string | null
  textSha256: string | null
  /** Entrées et sorties figées (traduction), ou objectif de l'analyse. */
  objective: string | null
  interfaceName: string | null
  allowedPaths: string[]
  handle: string | null
  family: string | null
  leaseExpiresAt: string | null
  steps: TaskStep[]
  /** Fichier du corpus qui a fait monter le niveau, quand il existe. */
  corpusFile: string | null
  /** Pourquoi la tâche n'est pas proposée par le guichet, quand elle ne l'est pas. */
  blockedReason: string | null
}

export interface AvailableTask extends TaskRef {
  position: number
  code: string
  articleNum: string | null
  excerpt: string
  /** Vrai si un contributeur l'a déjà eue puis rendue (motif dans `lastReason`). */
  returned: boolean
  lastReason: string | null
}
