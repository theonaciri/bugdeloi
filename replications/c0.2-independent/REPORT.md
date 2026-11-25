# C0.2 — Rejeu indépendant sur Tricoteuses

Date de projection des candidats et du contrôle · **25 novembre 2026**. Auteur du contrôleur ·
`codex/gpt-6.2-sol` (famille OpenAI). Le balayage initial a été réalisé par Claude Sonnet 5.5.
Les verdicts ci-dessous portent sur des constats mécaniques soumis à qualification humaine.

## Sources épinglées

| Code | Dépôt Tricoteuses                                                                                                         | Date du commit | Commit                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------ |
| CGI  | [code_general_des_impots](https://git.tricoteuses.fr/codes/code_general_des_impots)                                       | 2026-11-21     | `b3c3c8f01c477624e497077d03da3bd5680c3592` |
| CSS  | [code_de_la_securite_sociale](https://git.tricoteuses.fr/codes/code_de_la_securite_sociale)                               | 2026-11-20     | `b2a09dd621ad9a33ca9a76fecb63f279855f28df` |
| CCH  | [code_de_la_construction_et_de_l_habitation](https://git.tricoteuses.fr/codes/code_de_la_construction_et_de_l_habitation) | 2026-10-09     | `ec16a9dc58e4fa036105081390e52e11ac29252e` |

Les trois commits proviennent de la branche `main` des dépôts de [La loi sous git](https://git.tricoteuses.fr/codes).
Tricoteuses utilise le fonds LEGI de la DILA et le transforme en prises de vue Git. Les chaînes de
transformation sont indépendantes et remontent à la même source juridique.

## Méthode

1. Lire en transaction PostgreSQL `READ ONLY` les certificats C0.2 de `finding` dans `bugdeloi`. Le rejeu
   d’un lot déjà appliqué inclut aussi les certificats portant l’annotation de ce contrôleur.
2. Lire les fichiers Markdown des trois arbres Git épinglés. Indexer leurs métadonnées par identifiant
   et par numéro dans chaque code. Contrôler que la version citante désignée par son identifiant
   est en vigueur au 25 novembre selon ses dates et son état. L’intervalle inclut le début et exclut la
   fin. Une version `MODIFIE` dont la fin vaut `2999-01-01` est écartée.
3. Pour `REF_MORTE`, rechercher au moins un extrait complet du certificat dans le corps de l’article.
   Après retrait du balisage, les deux textes sont normalisés pour les espaces, apostrophes, guillemets
   et variantes typographiques de tiret. Rechercher les versions de la cible par identifiant et
   numéro dans le code désigné. Un numéro cible en vigueur infirme le critère par numéro. Une cible
   sans version en vigueur reçoit `confirmé` si les données portent le dernier état annoncé et une fin
   échue. Une cible absente de l’instantané reçoit `indéterminé`.
4. Pour `SYNTAXE`, apparier parenthèses, crochets et guillemets dans le corps entier en tenant compte des
   marques d’énumération et de continuation des citations. Comparer le type de défaut à celui annoncé.
   Pour les deux `NUMEROTATION`, localiser les extraits et comparer la portée des deux marqueurs
   à partir des citations et des niveaux de subdivision.

Le programme utilise les certificats comme énoncés à contrôler. Les textes et les états comparés
proviennent des articles Tricoteuses. Le code du balayage et de l’ingestion a été tenu à l’écart.

## Résultats

| Type         | Confirmé | Infirmé | Indéterminé |     Total |
| ------------ | -------: | ------: | ----------: | --------: |
| REF_MORTE    |        0 |       5 |       1 112 |     1 117 |
| SYNTAXE      |        9 |       0 |           0 |         9 |
| NUMEROTATION |        0 |       2 |           0 |         2 |
| **Total**    |    **9** |   **7** |   **1 112** | **1 128** |

Tous les extraits cités de `REF_MORTE` ont été retrouvés. Pour les 1 112 cas indéterminés, la cible
n’a aucune version datable dans l’instantané correspondant. Le [fichier de résultats](results.json)
donne le verdict, le motif et les chemins consultés pour chaque candidat. Les chemins sont relatifs
à la racine du cache Tricoteuses et commencent par le nom du dépôt.

### Les sept candidats infirmés

| Candidat      | Fait constaté et cause probable                                                                                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `F-2026-0103` | Le numéro CCH `R111-2` est en vigueur depuis le 2021-07-01 sous `LEGIARTI000043818263`. Le lien original vise `LEGIARTI000039041453`, qui concernait la surface habitable. Réutilisation du numéro après recodification.                                      |
| `F-2026-0238` | Même réutilisation du numéro CCH `R111-2`. Le texte citant se réfère à la surface habitable et l’article portant ce numéro dans Tricoteuses traite des gros et menus ouvrages.                                                                                |
| `F-2026-0241` | Même réutilisation du numéro CCH `R111-2` et même décalage de sujet.                                                                                                                                                                                          |
| `F-2026-0286` | Même réutilisation du numéro CCH `R111-2` et même décalage de sujet.                                                                                                                                                                                          |
| `F-2026-0430` | Le numéro CSS `D136-1` est en vigueur depuis le 2021-06-01 sous `LEGIARTI000043565221`, qui concerne la gratification de stage. Le renvoi vise `LEGIARTI000034623800` dans un passage sur la compensation entre opérations. Réutilisation du numéro probable. |
| `F-2026-1118` | Le premier `c)` est dans la citation introduite au `b)`. La citation se ferme avant le `c)` suivant, qui est un marqueur de la liste englobante. Le balayage a rapproché deux portées.                                                                        |
| `F-2026-1119` | Le premier `2.` relève du III (plan) et le second du III bis (contrat). Le marqueur `III bis.-1.` ouvre une subdivision entre les deux. Le balayage a rapproché deux subdivisions.                                                                            |

Pour les cinq renvois, le verdict porte sur le contrôle **par numéro**. Le décalage de sujet invite
à examiner le lien historique et l’identité de l’article visé lors de la qualification.

## Limites et rejeu

- Les commits sont des instantanés de consolidation. Ils contiennent principalement des articles
  en vigueur. Les versions anciennes ou retirées en sont généralement absentes. Il faut un
  historique affichant explicitement les états terminaux pour trancher les 1 112 cas indéterminés.
- Les commits sont antérieurs au 25 novembre, de quatre jours pour le CGI, de cinq pour le CSS
  et de quarante-sept pour le CCH. Les dates inscrites dans les fichiers guident le contrôle des
  versions présentes. Les éventuels changements absents de ces instantanés échappent au rejeu.
- La syntaxe est contrôlée au niveau du défaut annoncé sur l’article entier. Les positions du
  certificat d’origine dépendent de sa propre représentation du texte. La portée des marqueurs
  de numérotation est évaluée pour les deux paires du lot.
- Le rejeu est local. Une qualification humaine et le rejeu par la CI demeurent nécessaires avant
  publication ou comptage public.

Pour rejouer, placer les trois clones superficiels dans `~/.cache/bugdeloi/ext/tricoteuses/` sous les noms
ci-dessus. Si un commit épinglé manque, le récupérer dans le clone correspondant avec
`git fetch --depth=1 origin <commit>`. Le programme lit les objets Git directement par SHA.

```sh
bun replications/c0.2-independent/run.ts
bun run verify
bun replications/c0.2-independent/run.ts --apply
```

La première commande régénère le JSON en lisant la base. Après les contrôles, `--apply` recalcule le
résultat et compare les données au JSON enregistré. Dans une transaction, il ajoute les verdicts aux
certificats et passe les seuls `confirmé` à `reproduced`. Le champ `commit` de l’annotation associe chacun
des trois codes à son SHA. Un événement `reproduction.finished` conserve les totaux par verdict.
Une seconde application du même lot est sans effet.
