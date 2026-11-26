# `@bugdeloi/parlement` : veille parlementaire

Cette veille relie des amendements au format Tricoteuses (Assemblée nationale et Sénat) aux articles
formalisés par BugDeLoi, puis chiffre en euros les cas qu'elle sait lire. Les montants sont des
**simulations non qualifiées** : ni un constat, ni un conseil juridique.

## Chaîne

1. `veille(json)` (`src/tricoteuses.ts`) valide chaque amendement et écarte ceux qui ne citent aucun
   article suivi : CGI art. 193, 194, 197, 1657 ; CSS art. L521-1, D521-1, D755-5. Chaque
   correspondance donne `code`, `article`, `legiarti`, `version` et `origine`.
2. La même fonction extrait les paramètres du **dispositif** (jamais de l'exposé sommaire).
3. `calculImpact(suivi)` (`src/impact.ts`) compare la loi du millésime 2026 (`calculIR2026`) et la
   version amendée sur quatre foyers types de métropole.

```ts
import { calculImpact } from '@bugdeloi/parlement/impact'
import { veille } from '@bugdeloi/parlement/tricoteuses'

const resultats = veille(lotJson).map((suivi) => calculImpact(suivi))
```

## Entrée attendue

Un tableau d'objets avec les champs texte `uid`, `numero`, `dateDepot` (`AAAA-MM-JJ`), `chambre`
(`AN` ou `Sénat`), `texteLegislatifRef`, `articleCible`, `dispositif` et `exposeSommaire`. Le HTML est
accepté dans les deux derniers champs.

Ce format est **à plat**. Le paquet ne télécharge rien et ne convertit pas les exports bruts de
Tricoteuses : un adaptateur, à écrire et à contrôler sur des données réelles, devra produire ces champs.
Les trois amendements de `src/fixtures/plf2026-sample.json` sont **fictifs**.

## Formulations reconnues

| Paramètre                     | Dispositif                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| Indexation du barème de x %   | « Au 1 du I de l'article 197 du code général des impôts, les montants sont relevés de x %. »           |
| Suppression du seuil de 61 €  | « Le 1 bis de l'article 1657 du code général des impôts est abrogé. »                                  |
| Suppression de la décote      | « Le a du 4 du I de l'article 197 du code général des impôts est abrogé. »                             |
| Montants ou taux de la décote | « Au a du 4 du I de l'article 197 …, le montant : « 897 € » est remplacé par le montant : « 950 € ». » |

La phrase de gage sur l'accise sur les tabacs est reconnue et sans effet sur le calcul.

La lecture est volontairement stricte. Si une seule phrase est inconnue, ou si deux paramètres se
contredisent, le résultat est `non_calculable` : aucun chiffre partiel n'est produit.

## Hypothèses et limites

- Revenu net imposable et foyer constants, impôt avant réductions et crédits d'impôt.
- Une indexation « de x % » ne fixe pas l'arrondi des nouveaux seuils. Par défaut, ils sont arrondis à
  l'euro le plus proche ; l'option `arrondiSeuils: 'euro_inferieur'` change ce choix, rappelé dans
  `hypotheses`.
- L'indexation reconnue ne change que le barème : ni la décote, ni les plafonds du quotient familial,
  ni le seuil de 61 €.
- Le remplacement un à un des montants du barème n'est pas encore reconnu.
- Les articles 193, 194 et les articles du CSS sont détectés, mais pas chiffrés.
- Un article n'est rattaché que si son code est nommé. « Du même code » et les plages « 193 à 197 »
  (hors bornes) ne sont pas résolus. Une correspondance signale une citation, pas forcément une
  modification de l'article.

## Contrôles

```bash
bunx tsc -p packages/parlement/tsconfig.json
bun test packages/parlement/src/
bunx biome check packages/parlement/
```
