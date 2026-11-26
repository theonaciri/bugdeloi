# C0.4 · Rappel des annotations juridiques

Le témoin mécanique a retrouvé **2 annotations sur 44** (4,55 %).
Le paquet contient les textes DILA de **25 versions** d’articles.
**Un compte, pas une probabilité.**

## Inventaire et témoin mécanique

| Groupe                   | Inventaire | Dans le paquet | Appariées |  Rappel |
| ------------------------ | ---------: | -------------: | --------: | ------: |
| Total                    |        113 |             44 |         2 |  4,55 % |
| `todo_juridique`         |         50 |             17 |         2 | 11,76 % |
| `dependance_bofip`       |         63 |             27 |         0 |     0 % |
| `aides_logement`         |          8 |              5 |         1 |    20 % |
| `allocations_familiales` |          3 |              3 |         1 | 33,33 % |
| `asp`                    |         24 |              0 |         0 |       — |
| `impot_revenu`           |         77 |             35 |         0 |     0 % |
| `prestations_familiales` |          1 |              1 |         0 |     0 % |

## Soumissions évaluées

| Soumission            | Signalements | Annotations appariées |  Rappel |
| --------------------- | -----------: | --------------------: | ------: |
| `baseline-rules`      |           13 |                  2/44 |  4,55 % |
| `gemini-4-neon-blind` |          145 |                 16/44 | 36,36 % |

## Méthode et limites

- L’inventaire relève les TODO juridiques et les notes citant un identifiant BOI dans les
  fichiers Catala en français. Le code associe chaque note au dernier titre d’article
  muni d’un LEGIARTI le précédant dans le fichier. Cette proximité peut rattacher une
  note au mauvais article. [Source Inria/DGFiP au commit `9e251b932288cf5f4a74af072d203144a057494b`](https://github.com/CatalaLang/catala-examples/tree/9e251b932288cf5f4a74af072d203144a057494b)
- Le dénominateur comprend uniquement les annotations dont la version exacte figure
  dans le paquet. Le paquet est construit à partir des textes LEGI de la base BugDeLoi.
  La sélection des versions repose sur la présence d’annotations dans le corpus de référence.
  [Provenance des textes LEGI](../../docs/notes/legi.md)
- Pour compter, un signalement doit citer un extrait exact de la même version et partager
  un thème détecté par un motif textuel compatible avec sa catégorie. Une annotation
  et un signalement peuvent chacun servir une seule fois. Des thèmes proches, des notes
  sans contexte ou des reformulations peuvent fausser l’appariement.
  [Règles de comptage](evaluate.ts)
- Le témoin parcourt uniquement le paquet avec des motifs repérant les critères à apprécier,
  les renvois réglementaires, les paramètres et les arrondis.
  [Règles du témoin](baseline-heuristic.ts)
- Les annotations décrivent des choix, des questions ou des précisions de la formalisation
  de référence. Le rappel ne mesure ni la qualité juridique des signalements ni leur
  précision sur les textes hors de ce paquet. Ce rapport n’inclut aucun score d’analyste
  indépendant tant qu’aucune soumission aveugle de ce type n’a été intégrée.
  [Protocole de rejeu](README.md)
