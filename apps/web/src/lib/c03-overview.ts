/**
 * Résumé éditorial factuel des cas numériques de l'expérience C0.3 (allocations familiales).
 * Source unique : `replications/c0.3/summary.json` et `docs/audits/2026-11-25-c0.3-evaluation.md`.
 */

export const C03_CASE_CONTEXT: Record<string, string> = {
  Test1: 'Arrondi des composantes avant partage et somme (écart de 0,01 €)',
  Test2: 'Cas standard en métropole : montant mensuel identique',
  Test3: 'Guyane, enfant unique de 13 ans (art. D755-5, II, alinéa 2) : +15,29 €/mois',
  Test4: 'Cas standard en métropole : montant mensuel identique',
  Test5: 'Droit non ouvert : 0,00 € confirmé',
  Test6: 'Cas standard en métropole : montant mensuel identique',
  Test7: 'Arrondi des composantes avant cumul des majorations (écart de 0,01 €)',
  Test8: 'Complément calculé sur composantes arrondies (écart de 0,01 €)',
  Test9: 'Droit non ouvert : 0,00 € confirmé',
  Test10: 'Cas standard en métropole : montant mensuel identique',
  Test11: 'Famille nombreuse : montant mensuel identique (435,55 €)',
  Test12: 'Mayotte, 4 enfants à charge (ordonnance du 7 février 2002, art. 7) : -123,39 €/mois',
  Test13: 'Cas standard : montant mensuel identique (34,99 €)',
  Test14: 'Cas standard : montant mensuel identique (48,77 €)',
}
