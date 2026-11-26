# C0.8 · Différentiel avec OpenFisca-France (impôt sur le revenu et allocations familiales)

_Fichier généré par `bun replications/c0.8-openfisca/run.ts`. Ne pas modifier à la main._

**Un compte, pas une probabilité. Un écart ne dit pas lequel des deux calculs est faux.** Ce rejeu n’attribue aucun niveau de preuve.

## État du pont

- Versions : openfisca_france 177.1.4, openfisca_core 46.1.0, numpy 2.3.5, python 3.14.4.
- Impôt : revenus 2025 (demandés : 2025). Allocations : mois 2026-07, × 12.
- Foyers comparés : 328 (297 impôt, 31 allocations).
- Foyers avec au moins un écart : 54.
- Tolérances : impôt 0.005 €, allocations 0.12 € par an.

## Écarts par catégorie

| Catégorie                 | Écarts |
| ------------------------- | -----: |
| `difference_de_millesime` |      0 |
| `difference_de_perimetre` |     30 |
| `divergence_simulateur`   |     24 |

`divergence_simulateur` est la catégorie par défaut : l’écart reste à instruire.

## Détail

### IR · `divergence_simulateur` · 24 écart(s), au plus 61

Non tranché. Disparaît avec des arrondis à l’euro avant et sur la décote (candidat à instruire : ARRONDI).

| Revenu | Situation   | Âges des enfants | Vit seul | Domicile  | BugDeLoi | OpenFisca |
| -----: | ----------- | ---------------- | -------- | --------- | -------: | --------: |
|  17593 | Célibataire | —                | non      | Métropole |       61 |         0 |
|  17594 | Célibataire | —                | non      | Métropole |       61 |         0 |
|  23393 | Célibataire | 10               | non      | Métropole |       61 |         0 |

### IR · `difference_de_perimetre` · 28 écart(s), au plus 12968

OpenFisca ajoute la contribution sur les hauts revenus, hors périmètre de c0.6.

| Revenu | Situation | Âges des enfants | Vit seul | Domicile  | BugDeLoi | OpenFisca |
| -----: | --------- | ---------------- | -------- | --------- | -------: | --------: |
| 636709 | Divorcé   | 10, 8, 6         | oui      | Métropole |   253360 |    266328 |
| 636710 | Divorcé   | 10, 8, 6         | oui      | Métropole |   253360 |    266328 |
| 636711 | Divorcé   | 10, 8, 6         | oui      | Métropole |   253361 |    266329 |

### AF · `difference_de_perimetre` · 1 écart(s), au plus 1160.99

OpenFisca ajoute l’allocation forfaitaire (enfant de 20 ans), non modélisée par c0.7.

| Revenu | Situation         | Âges des enfants | Vit seul | Domicile  | BugDeLoi | OpenFisca |
| -----: | ----------------- | ---------------- | -------- | --------- | -------: | --------: |
|  30000 | ImpositionCommune | 20, 10, 8        | non      | Métropole |  1836.13 |   2997.12 |

### AF · `difference_de_perimetre` · 1 écart(s), au plus 337.44

c0.7 ne modélise que la métropole.

| Revenu | Situation         | Âges des enfants | Vit seul | Domicile                    | BugDeLoi | OpenFisca |
| -----: | ----------------- | ---------------- | -------- | --------------------------- | -------: | --------: |
|  20000 | ImpositionCommune | 10               | non      | GuadeloupeMartiniqueRéunion |        0 |    337.44 |

## Limites

- Le revenu net imposable et la base de ressources sont injectés : leur calcul n’est pas comparé.
- Les ressources N-2 des prestations familiales ne sont pas modélisées : même montant pour les deux.
- Allocations : montants avant CRDS, sans résidence alternée ; enfants de 14 à 17 ans non testés.
- De c0.7, seules les allocations familiales sont comparées : ni aide au logement, ni RSA, ni prime d’activité.
- Un écart d’allocations avec des paramètres différents est classé sur les paramètres seuls.
- Les paramètres OpenFisca sont une source d’oracle, pas le texte officiel : confronter à LEGI et au JORF.
