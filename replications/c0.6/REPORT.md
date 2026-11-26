# C0.6 · Étalonnage du détecteur de coudes et falaises (Impôt sur le revenu 2026)

Balayage déterministe au pas de **1 €** de `0 €` à `200 000 €` de revenu net imposable sur le noyau CGI art. 193, 194, 197 (`LEGIARTI000053542636`) et art. 1657 1 bis (`LEGIARTI000051219510`). **Un compte, pas une probabilité.**

- **Falaises sur le barème pur (CGI 193-197 seuls) :** 0.
- **Falaises avec seuil de mise en recouvrement de 61 € (CGI 1657 1 bis) :** 4 (une sur chaque foyer type : +61 € d’impôt pour +1 € de revenu, soit un taux marginal effectif de **6 100 %** et une baisse de **-60 €** de revenu disponible).
- **Coudes de taux marginal détectés :** 18 sur 4 foyers types.

## Synthèse par foyer type

| Foyer                                          | Parts | Entrée IR | Falaise 61 € (art. 1657 1 bis)   | Zone de décote      | TME décote |  Plafond QF |
| ---------------------------------------------- | ----: | --------: | -------------------------------- | ------------------- | ---------: | ----------: |
| Célibataire sans enfant (1 part)               |     1 |  17 215 € | 17 592 € → 17 593 € (0 € → 61 €) | 17 215 € → 29 595 € |    15,98 % | Non atteint |
| Couple marié ou pacsé sans enfant (2 parts)    |     2 |  32 482 € | 32 860 € → 32 861 € (0 € → 61 €) | 32 482 € → 52 995 € |    15,98 % | Non atteint |
| Couple marié ou pacsé avec 2 enfants (3 parts) |     3 |  44 082 € | 44 460 € → 44 461 € (0 € → 61 €) | 44 082 € → 64 595 € |    15,98 % |    71 464 € |
| Parent isolé avec 1 enfant à charge (2 parts)  |     2 |  28 815 € | 29 192 € → 29 193 € (0 € → 61 €) | 28 815 € → 41 222 € |    15,98 % |    45 295 € |

## Coudes détectés (Célibataire 1 part)

- **17 214 €** : 0,00 % → 15,98 % (Entrée dans l’impôt (zone de décote, taux majoré × 1,4525))
- **29 579 €** : 15,98 % → 43,58 % (Changement de tranche du barème (11 % → 30 %))
- **29 594 €** : 43,58 % → 30,00 % (Sortie de la décote (retour au taux du barème))
- **84 577 €** : 30,00 % → 41,00 % (Changement de tranche du barème (30 % → 41 %))
- **181 917 €** : 41,00 % → 45,00 % (Changement de tranche du barème (41 % → 45 %))
