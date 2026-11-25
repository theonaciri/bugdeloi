/**
 * Échelle des niveaux de preuve — source unique côté code.
 * Définitions normatives : AGENTS.md §4.1. Toute modification ici doit être reflétée là-bas.
 */

export const LEVELS = ['N0', 'N1', 'N2', 'N3', 'N4', 'N5', 'REF'] as const
export type Level = (typeof LEVELS)[number]

export const FLAGS = ['contested', 'refuted'] as const
export type Flag = (typeof FLAGS)[number]

export interface LevelInfo {
  level: Level
  /** Libellé court affiché au public (toujours accompagné du code de niveau). */
  label: string
  /** Phrase qui dit exactement ce qui a été contrôlé — jamais « prouvé ». */
  meaning: string
  /** Jeton de couleur CSS (défini dans le design system web). */
  colorToken: string
  /** Motif de repli pour ne pas dépendre de la couleur seule (accessibilité). */
  pattern: 'none' | 'ring' | 'dots' | 'hatch' | 'solid' | 'cross' | 'star'
}

export const LEVEL_INFO: Record<Level, LevelInfo> = {
  N0: {
    level: 'N0',
    label: 'Brut',
    meaning: 'Texte officiel ingéré depuis LEGI (DILA), identifiant et empreinte enregistrés.',
    colorToken: '--level-n0',
    pattern: 'none',
  },
  N1: {
    level: 'N1',
    label: 'Ancré',
    meaning:
      'Interface figée et texte cité à l’identique de LEGI ; chaque alinéa est codé ou déclaré hors périmètre.',
    colorToken: '--level-n1',
    pattern: 'ring',
  },
  N2: {
    level: 'N2',
    label: 'Compilé',
    meaning:
      'Le code Catala compile et tous ses tests passent avec la version épinglée du compilateur ; les constructions interdites sont absentes et chaque constante cite l’alinéa qui la fixe.',
    colorToken: '--level-n2',
    pattern: 'dots',
  },
  N3: {
    level: 'N3',
    label: 'Testé',
    meaning:
      'Tous les cas d’oracle passent, issus d’au moins deux sources indépendantes dont une non issue d’un LLM ; aucun auteur d’oracle n’est de la famille de modèles du traducteur ; aucun conflit d’exceptions ni cas non couvert.',
    colorToken: '--level-n3',
    pattern: 'hatch',
  },
  N4: {
    level: 'N4',
    label: 'Éprouvé',
    meaning:
      'Au moins 10 000 entrées générées (dont chaque seuil ± 1 €) comparées à une implémentation indépendante sans divergence inexpliquée ; au moins 80 % des mutations détectées ; relecture aveugle jugée équivalente par une troisième famille de modèles ; 7 jours de red team sans contre-exemple accepté.',
    colorToken: '--level-n4',
    pattern: 'solid',
  },
  N5: {
    level: 'N5',
    label: 'Certifié',
    meaning:
      'Tous les contrôles précédents, plus une revue humaine signée par un relecteur juriste identifié.',
    colorToken: '--level-n5',
    pattern: 'cross',
  },
  REF: {
    level: 'REF',
    label: 'Référence',
    meaning:
      'Résultats identiques à ceux d’une formalisation de chercheurs ou d’une administration (Inria, DGFiP, CNAF) sur sa propre suite de tests, rejouée chez nous.',
    colorToken: '--level-ref',
    pattern: 'star',
  },
}

/** Rang pour comparer les niveaux (REF est hors échelle cumulative mais affiché au-dessus). */
export const LEVEL_RANK: Record<Level, number> = { N0: 0, N1: 1, N2: 2, N3: 3, N4: 4, N5: 5, REF: 6 }

export function isLevel(value: unknown): value is Level {
  return typeof value === 'string' && (LEVELS as readonly string[]).includes(value)
}
