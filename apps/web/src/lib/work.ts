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
    what: 'Lire l’article alinéa par alinéa et dire ce qui se calcule, ce qui relève d’une appréciation humaine et ce qui sort du sujet. Proposer les entrées et sorties du futur calcul.',
    check: 'La fiche cite le texte officiel à l’identique, puis passe les contrôles automatiques du dépôt.',
    open: true,
  },
  traduction: {
    stage: 'traduction',
    verb: 'Traduire',
    roles: ['translate'],
    from: 'N1',
    to: 'N2',
    actor: 'agent',
    who: 'Un agent IA ou un contributeur',
    what: 'Écrire le calcul en Catala, sous chaque alinéa du texte, en respectant les entrées et sorties figées.',
    check: 'Le compilateur Catala, dans sa version épinglée, accepte le code et les tests passent.',
    open: true,
  },
  oracles: {
    stage: 'oracles',
    verb: 'Tester',
    roles: ['oracle'],
    from: 'N2',
    to: 'N3',
    actor: 'agent',
    who: 'Un autre auteur, d’une autre famille de modèles, sans voir le code',
    what: 'Écrire des cas chiffrés tirés de sources officielles (BOFiP, brochures, OpenFisca) et vérifier que le code donne les mêmes résultats.',
    check: 'Tous les cas passent, issus d’au moins deux sources indépendantes dont une qui n’est pas une IA.',
    open: false,
  },
  epreuve: {
    stage: 'epreuve',
    verb: 'Éprouver',
    roles: ['redteam', 'backtranslate', 'judge'],
    from: 'N3',
    to: 'N4',
    actor: 'machine',
    who: 'Des programmes et une troisième famille de modèles',
    what: 'Comparer 10 000 cas générés à une autre implémentation, chercher des contre-exemples et faire reformuler le code sans le texte.',
    check:
      'Aucun écart inexpliqué, au moins 80 % des erreurs introduites exprès détectées, 7 jours sans contre-exemple accepté.',
    open: false,
  },
  relecture: {
    stage: 'relecture',
    verb: 'Relire',
    roles: [],
    from: 'N4',
    to: 'N5',
    actor: 'humain',
    who: 'Un ou une juriste identifiée',
    what: 'Relire les choix d’interprétation et signer la relecture.',
    check: 'Une relecture signée dans le dépôt Git.',
    open: false,
  },
}

export const COLUMN_INFO: Record<Column, { label: string; short: string; meaning: string }> = {
  todo: {
    label: 'À prendre',
    short: 'à prendre',
    meaning:
      'La tâche attend un contributeur. Le guichet la donne au prochain agent qui en demande une, dans l’ordre de la liste.',
  },
  doing: {
    label: 'En cours',
    short: 'en cours',
    meaning:
      'Un contributeur l’a réservée. La réservation dure 20 minutes et se prolonge tant qu’il donne signe de vie, 6 heures au plus.',
  },
  review: {
    label: 'En relecture',
    short: 'en relecture',
    meaning:
      'Le travail est déposé dans le dépôt public sous forme de proposition (pull request). Les contrôles automatiques et la fusion décident de son intégration.',
  },
  done: {
    label: 'Intégrée',
    short: 'intégrées',
    meaning: 'Le travail est fusionné et l’article a monté d’un niveau.',
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
