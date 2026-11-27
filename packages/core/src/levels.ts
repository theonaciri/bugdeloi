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
    label: 'Analysé',
    meaning:
      'Article classé alinéa par alinéa (calculable, entrée d’appréciation ou hors périmètre) avec une interface proposée avant traduction Catala.',
    colorToken: '--level-n1',
    pattern: 'ring',
  },
  N2: {
    level: 'N2',
    label: 'Compilé',
    meaning:
      'Texte officiel cité à l’identique de LEGI, code Catala compilé et tests réussis dans la version épinglée du compilateur. Les constructions interdites sont absentes et chaque constante cite l’alinéa qui la fixe.',
    colorToken: '--level-n2',
    pattern: 'dots',
  },
  N3: {
    level: 'N3',
    label: 'Testé',
    meaning:
      'Tous les cas d’oracle réussissent, à partir d’au moins deux sources indépendantes dont une non issue d’une IA. Aucun auteur d’oracle n’appartient à la famille de modèles du traducteur, et aucun conflit d’exceptions ni cas non couvert n’est détecté.',
    colorToken: '--level-n3',
    pattern: 'hatch',
  },
  N4: {
    level: 'N4',
    label: 'Éprouvé',
    meaning:
      'Au moins 10 000 entrées générées (dont chaque seuil à ± 1 €) sont comparées à une implémentation indépendante sans divergence inexpliquée. Au moins 80 % des mutations sont détectées, une rétro-traduction aveugle est jugée équivalente par une troisième famille de modèles, et 7 jours d’examen contradictoire se déroulent sans contre-exemple retenu.',
    colorToken: '--level-n4',
    pattern: 'solid',
  },
  N5: {
    level: 'N5',
    label: 'Certifié',
    meaning:
      'Tous les contrôles des niveaux précédents sont validés, et un juriste identifié a signé une relecture des choix d’interprétation.',
    colorToken: '--level-n5',
    pattern: 'cross',
  },
  REF: {
    level: 'REF',
    label: 'Référence',
    meaning:
      'La version en vigueur de l’article est formalisée par des chercheurs ou une administration (Inria, DGFiP, CNAF), et sa suite de tests réussit dans notre environnement de compilation épinglé. Ce marqueur signale un travail externe à BugDeLoi.',
    colorToken: '--level-ref',
    pattern: 'star',
  },
}

/** Rang pour comparer les niveaux (REF est hors échelle cumulative mais affiché au-dessus). */
export const LEVEL_RANK: Record<Level, number> = { N0: 0, N1: 1, N2: 2, N3: 3, N4: 4, N5: 5, REF: 6 }

export function isLevel(value: unknown): value is Level {
  return typeof value === 'string' && (LEVELS as readonly string[]).includes(value)
}
