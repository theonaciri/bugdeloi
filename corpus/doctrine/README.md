# Couche Doctrine (BOFiP)

Index `LEGIARTI` → références BOFiP-Impôts, pour afficher côte à côte la **loi** et la **doctrine administrative**
sur `/article/[legiarti]`.

## Pourquoi la loi et la doctrine sont séparées (`AGENTS.md` §3.2)

- La **couche Loi** vient de LEGI (DILA) : seule source du texte formalisé.
- La **couche Doctrine** (BOFiP-Impôts, BOSS, circulaires CNAF) est l'interprétation de l'administration.
  Elle n'a pas la même force que le texte et peut évoluer sans modification de la loi.
- On ne mélange jamais les deux dans un même scope Catala. Cet index ne contient aucun code de calcul.

## `DIVERGENCE_DOCTRINE`

Quand la doctrine et le texte de loi donnent des résultats différents sur une entrée, on ouvre un finding
`DIVERGENCE_DOCTRINE` au statut `candidate` (cycle de vie du §4.4 : `reproduced` puis `qualified`). Aucune divergence
n'est publiée avant la qualification par un humain. Cet index ne déclare aucune divergence : il liste des références.

## Contenu

- `build-bofip-index.ts` : génère `bofip-index.json` (déterministe, sans horodatage).
- `bofip-index.json` : `{ generatedFrom, totalArticles, totalReferences, articles: Record<LEGIARTI, entrée[]> }`.
- `bofip.test.ts` : contrôle du schéma.

Chaque entrée contient `bofipRef`, `title`, `url`, `source` et `note`.

| `source`                | Origine                                                                                                                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inria_catala_examples` | Référence `BOI-…` relevée dans les commentaires de `catala-examples` (commit épinglé dans `replications/c0.4/ground-truth.json`). Le champ `evidence` donne fichier et ligne. Les références sans `nearestLegiarti` sont ignorées. |
| `cgi_noyau_ir`          | Rattachement thématique des articles du noyau IR 2026 (193, 194, 197, 1657).                                                                                                                                                       |

## Limites

- Aucun numéro de paragraphe ni citation du BOFiP n'est inventé. Le `title` décrit la série du code `BOI-…`,
  pas le titre exact du bulletin.
- L'`url` est une recherche officielle sur `bofip.impots.gouv.fr`, car les identifiants PGP versionnés changent.
- Les rattachements `cgi_noyau_ir` sont thématiques. Un relecteur humain doit confirmer le paragraphe pertinent
  avant d'en tirer un finding.

Régénération : `bun corpus/doctrine/build-bofip-index.ts`.
