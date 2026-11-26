# C0.8 · Différentiel avec OpenFisca-France

Ce rejeu compare, foyer par foyer :

- l'impôt sur le revenu de [`../c0.6/ir2026.ts`](../c0.6/ir2026.ts) ;
- les allocations familiales de [`../c0.7/revenu-disponible.ts`](../c0.7/revenu-disponible.ts) ;

avec [OpenFisca-France](https://github.com/openfisca/openfisca-france), un simulateur développé à part.
Il tourne sur votre machine. Le calcul n'appelle aucun service en ligne.

**Un écart ne dit pas lequel des deux calculs est faux. Un compte, pas une probabilité.**
Ce rejeu n'attribue aucun niveau de preuve.

## Lancer

Depuis la racine du dépôt, après `bun install` :

```bash
cd replications/c0.8-openfisca
python3 -m venv .venv && .venv/bin/pip install openfisca-france
cd ../.. && bun replications/c0.8-openfisca/run.ts
```

Pour retrouver les versions du rapport consigné, installez
`-r requirements.txt` au lieu de `openfisca-france`.

Sur Debian ou Ubuntu, si `python3 -m venv` signale l'absence de `ensurepip` et que `pip` est
déjà installé sur le système :

```bash
cd replications/c0.8-openfisca
python3 -m venv --without-pip .venv
python3 -m pip --python .venv/bin/python install -r requirements.txt
```

Compter environ 150 Mo de disque et deux minutes de calcul sur 4 cœurs ARM64.

## Sans Python ni OpenFisca

Si `.venv` est absent, ou si `openfisca_france` n'y est pas installé, `run.ts` passe en mode
hors ligne : il génère les foyers, ne compare rien et le dit dans le rapport. L'option `--offline`
force ce mode.

Attention : chaque lancement **remplace** `summary.json` et `REPORT.md`. Un lancement hors ligne
efface donc le résultat d'une comparaison précédente.

Les tests n'ont besoin ni de Python ni d'OpenFisca :

```bash
bun test replications/c0.8-openfisca/
```

## Ce qui est comparé

| Sujet                  | Entrée injectée             | Sorties comparées                      | Tolérance     |
| ---------------------- | --------------------------- | -------------------------------------- | ------------- |
| Impôt sur le revenu    | revenu net imposable        | nombre de parts, impôt à payer (euros) | aucune        |
| Allocations familiales | base de ressources annuelle | total annuel avant CRDS                | 0,12 € par an |

Impôt : la période demandée est 2025 (revenus 2025). Si la version installée ne va pas jusque-là,
la dernière année de son barème est utilisée, et le rapport l'indique.

Allocations : c0.7 modélise le droit au 1er juillet 2026. OpenFisca est donc évalué sur juillet
2026, multiplié par douze. Les enfants de 14 à 17 ans ne sont pas testés : leur droit à la
majoration dépend de la date de naissance, que c0.7 reçoit déjà tranché. De c0.7, l'aide au
logement, le RSA et la prime d'activité ne sont pas comparés.

Les foyers couvrent chaque seuil du barème, l'entrée dans l'impôt, le seuil de 61 €, la sortie de la
décote, le plafonnement du quotient familial et les plafonds des allocations, chacun à ± 1 €. Les
plafonds sont ceux de c0.7 et, quand le pont répond, ceux lus dans OpenFisca.

## Classement des écarts

| Catégorie                 | Condition vérifiée par le programme                                                 |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `difference_de_millesime` | Les paramètres diffèrent de ceux de la période évaluée.                             |
| `difference_de_perimetre` | Un composant ou un territoire hors du périmètre local explique l'écart.             |
| `divergence_simulateur`   | Tout le reste, y compris une valeur locale introuvable dans l'historique OpenFisca. |

Pour les allocations, `difference_de_millesime` exige en plus que chaque valeur locale différente
existe à une autre date dans OpenFisca. Pour l'impôt, aucun historique n'est lu. Quand le programme
peut le vérifier, le motif précise qu'un écart disparaît avec un autre ordre d'arrondi.

`divergence_simulateur` reste **non expliqué** au sens du §4.1 de `AGENTS.md`. Un humain doit le
confronter au texte (LEGI, JORF) avant tout finding. Les indices écrits dans le motif sont des pistes.

## Fichiers

- `compare_openfisca.py` : lit une liste JSON de foyers, rend `impot_revenu` et `af` en JSON.
  Codes de sortie : 0 succès, 1 échec du calcul, 2 entrée invalide, 3 OpenFisca absent.
- `scenarios.ts` : foyers générés, sans aléa.
- `bridge.ts` : validation de la sortie Python.
- `classify.ts` : comparaison et classement.
- `report.ts`, `run.ts` : rapport et lancement.
- `summary.json`, `REPORT.md` : générés.

OpenFisca-France est distribué sous licence AGPL. Il est importé comme bibliothèque ; aucun de ses
codes n'est recopié ici.
