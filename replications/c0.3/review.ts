export type FailureClassification =
  | 'erreur_traduction'
  | 'erreur_harnais'
  | 'ambiguïté'
  | 'différence_de_périmètre'
  | 'erreur_oracle'

export type FixtureInputs = 'original' | 'completed'

// Audit du 25 novembre 2026. Les lignes de la suite renvoient à la révision Inria épinglée.
const originalAmounts: Record<string, [expected: string, parentRuleLine: number]> = {
  Test1: ['285,24', 72],
  Test2: ['216,46', 86],
  Test3: ['24,37', 99],
  Test4: ['99,46', 112],
  Test6: ['66,30', 155],
  Test7: ['351,54', 169],
  Test8: ['197,90', 199],
  Test10: ['99,46', 259],
  Test11: ['435,55', 297],
  Test12: ['315,84', 344],
  Test13: ['34,99', 366],
  Test14: ['48,77', 396],
}

const completedAmounts: Record<
  string,
  [actual: string, classification: FailureClassification, justification: string]
> = {
  Test1: [
    '285,25',
    'ambiguïté',
    'L’arrondi final de Calcul.catala_fr:1186 et celui des composantes en argent chez Inria (securite_sociale_D.catala_fr:38-46 et :60-63) diffèrent d’un centime sur le calcul partagé.',
  ],
  Test3: [
    '39,66',
    'erreur_oracle',
    'Le filtre Inria sur le droit à majoration (securite_sociale_D.catala_fr:413-423, securite_sociale_L.catala_fr:315-322) écarte les 3,69 % prévus pour cet enfant unique de 13 ans par D755-5, II, alinéa 2 (LEGIARTI000006738575, 1998-12-30).',
  ],
  Test7: [
    '351,55',
    'ambiguïté',
    'L’arrondi final de Calcul.catala_fr:1186 et celui des composantes en argent chez Inria (securite_sociale_D.catala_fr:38-46 et :60-63) diffèrent d’un centime après cumul des majorations.',
  ],
  Test8: [
    '197,91',
    'ambiguïté',
    'Le complément prend pour base des composantes déjà exactes au centime chez Inria (securite_sociale_D.catala_fr:81-83, :105-108 et :190-199), tandis que Calcul.catala_fr:948-950 et :1186 conservent les fractions de centime jusqu’au versement.',
  ],
  Test12: [
    '192,45',
    'erreur_oracle',
    'Inria additionne 57,28 € au barème de plusieurs enfants (decrets_divers.catala_fr:185-189 et :400-405) alors que le maintien cesse dès que l’enfant n’est plus seul à charge selon l’article 7, alinéa 5, de l’ordonnance (LEGIARTI000034109930, 2018-01-01).',
  ],
}

export function reviewFailure(inputs: FixtureInputs, name: string, diagnostic: string | null) {
  const original = originalAmounts[name]
  if (!original) return
  const [expected, line] = original
  if (inputs === 'original' && diagnostic === `Assertion failed: 0,00 € ≠ ${expected} €`) {
    return {
      classification: 'erreur_harnais' as const,
      justification: `tests_allocations_familiales.catala_fr:${line} renseigne la qualité de parent seule, laissant l’appréciation générale à faux dans la condition de Calcul.catala_fr:1141.`,
    }
  }
  const completed = completedAmounts[name]
  if (inputs === 'completed' && completed) {
    const [actual, classification, justification] = completed
    if (diagnostic === `Assertion failed: ${actual} € ≠ ${expected} €`) {
      return { classification, justification }
    }
  }
}
