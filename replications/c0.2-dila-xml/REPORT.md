# C0.2 — Reproduction indépendante n° 2 : candidats REF_MORTE contre les XML bruts de la DILA

> **Candidats non qualifiés.** Un verdict `confirmé` signifie seulement que les fichiers officiels de la
> DILA donnent les mêmes faits que le certificat. Il ne dit pas que le renvoi est une erreur du texte :
> seule une qualification humaine conclut (AGENTS.md §4.4).

Date de référence · **25 novembre 2026** (intervalles [début, fin[, fin `2999-01-01` = ouverte).
Contrôleur · `c0.2-dila-xml@1.0.0`. Auteur · `claude/claude-opus-5-5` (famille **Anthropic**).
**Même famille de modèles** que l'auteur des détecteurs C0.2 (Claude Sonnet 5.5). L'ingestion
(`packages/ingest`) a été écrite par une autre famille (OpenAI). Ce contrôle est indépendant par le
**code** et les **données traitées**, pas par la famille. Il n'a lu ni importé `packages/ingest`,
`packages/sweep`, `replications/c0.2-independent`, `docs/notes/legi.md` ou `docs/notes/sweep.md`. Il
ne lit en base que la table `finding` : les certificats y servent d'énoncés à contrôler. Tous les faits
comparés viennent des archives.

## Sources

Archives LEGI de la DILA (Licence Ouverte 2.0), lues depuis `~/.cache/bugdeloi/dila/`. Chaque SHA-256
est recalculé et comparé au fichier `.sha256` publié à côté de l'archive. Le programme s'arrête en cas
d'écart.

| Archive                                       | SHA-256                                                            |
| --------------------------------------------- | ------------------------------------------------------------------ |
| `Freemium_legi_global_20261108-140000.tar.gz` | `90c9dc4a0a362943eef055881f00a727ac5d5f08fb9b4ec472e9da6da572bda2` |
| `LEGI_20261108-210452.tar.gz`                 | `43b7f7726c232e5ad6088f297ce8cf915633ad87281f29af4b8d975bd2a837e5` |
| `LEGI_20261109-212854.tar.gz`                 | `b1ed8ae19727e8dd5793d00f018e891db4928bedf61bde9b90faf16ecf27070f` |
| `LEGI_20261110-213159.tar.gz`                 | `7a8c8a2fb109f33bd6c7dab5ffc9769becd51693aefc080b45ffbf307ae34cd9` |
| `LEGI_20261111-211545.tar.gz`                 | `7fec19a8d5d18e6d8d3ed831fc2c3eaec5d33db11f931541481b597579ec8539` |
| `LEGI_20261112-210355.tar.gz`                 | `5ebdc1df108f747e75d7abf2f2aa284c492c398ea3bfb501057a45286bb3411c` |
| `LEGI_20261113-215108.tar.gz`                 | `dad9a39105d58d9faea3153ea02e828255b4c5324f9e4221187e637ebb2b970b` |
| `LEGI_20261114-210430.tar.gz`                 | `8222412a7f24f6f9f62178785c5a1a8fb6cdc674ba2ce9b3a3395e3c91b8b916` |
| `LEGI_20261115-205552.tar.gz`                 | `c00eb0c3fccca6779fb66b2e6f91fc25032c04892b37d4e71fd82b8a903e5686` |
| `LEGI_20261116-104909.tar.gz`                 | `5326caac1a7cfb22fa3bc81c2dad4efec65ae9d5f3bfec8869e077501e52359e` |
| `LEGI_20261116-212357.tar.gz`                 | `f0937ab12111eea7eae52f5f4bd5c88707d90b93e86684eea4dac8d8074d1296` |
| `LEGI_20261117-212708.tar.gz`                 | `4b4f8310164a307d7bd9ea7406260ab2d014c30a7488e2e4651ab4839c0658e6` |
| `LEGI_20261118-214555.tar.gz`                 | `dd8714e5ce638550358a02583711ac95d8b86fac80d0e61196cb2b6069c774e7` |
| `LEGI_20261119-214726.tar.gz`                 | `9975590ada1a7c495213d8638bd4a2c1359a59bc3f5febde918c0586f4679179` |
| `LEGI_20261120-222218.tar.gz`                 | `a83f756d2c6b6850afe6bf58e645fb53c1a920651d8f2a31d1befaa4c3748d32` |
| `LEGI_20261121-212437.tar.gz`                 | `acf12e52a1d580f88eff2760ebeda749bf25a0e27180b23b1ce691b9d477c921` |
| `LEGI_20261122-205652.tar.gz`                 | `f2d283668adfa0503194e6d431373424c0f02aeb96a8e701de66da6b3761472e` |
| `LEGI_20261123-101912.tar.gz`                 | `8daecca70ba1b4e22d0a95c646414ca26e25168ec2fabb49ee92dbeb42e056d8` |
| `LEGI_20261123-213608.tar.gz`                 | `64c91089575952ca298256d63e59bb9a2017b5f8ce6b5272ef97f506d466d7aa` |
| `LEGI_20261124-221545.tar.gz`                 | `48367a251f52d5dbc3e988904ed5ba094ccc157252b289ee6a30e35cc438bb55` |

## Méthode

1. **Lecture en flux.** `nice gzip -dc` alimente un lecteur tar écrit pour ce contrôle (ustar, noms longs
   GNU et pax). Rien n'est décompressé sur disque. Le lecteur ne garde que les fichiers `article/…/LEGIARTI*.xml`
   rangés sous les dossiers des trois codes : CGI `LEGITEXT000006069577`, CSS `LEGITEXT000006073189`,
   CCH `LEGITEXT000006074096`. Il garde aussi les listes `liste_suppression_legi*.dat`.
2. **Ordre.** Le stock est appliqué d'abord. Les incréments postérieurs au stock suivent dans l'ordre de leur
   horodatage, jusqu'à `LEGI_20261124-221545`. Un fichier réécrit remplace le précédent (clé : chemin). Les
   suppressions annoncées sont appliquées à la fin de chaque incrément (chemin sans `.xml`). Aucun
   chemin n'est à la fois écrit et supprimé dans un même incrément : l'ordre est donc sans effet ici.
3. **Lecture d'un article.** Le programme lit `ID`, `NUM`, `ETAT`, `DATE_DEBUT` et `DATE_FIN`, le `cid`
   du texte de rattachement et les `LIEN_ART` du bloc `VERSIONS`. Pour les seules versions sources, il lit
   aussi le texte (`BLOC_TEXTUEL/CONTENU`, balises retirées, entités décodées) et les `LIEN`.
4. **En vigueur (règle propre à ce contrôle).** Une version est en vigueur à la date D si `début ≤ D < fin`
   et si son état l'admet : `VIGUEUR`, `VIGUEUR_DIFF`, `ABROGE_DIFF`, ou `MODIFIE` à fin datée.
   Un `MODIFIE` à fin ouverte, un état terminal (`ABROGE`, `TRANSFERE`, `PERIME`, `ANNULE`, `DISJOINT`,
   `MODIFIE_MORT_NE`) ou un état inconnu ne le sont pas.
5. **Article.** Un article est l'union de deux ensembles. Le premier est la lignée de la cible :
   composante connexe des identifiants reliés par les blocs `VERSIONS`. Le second rassemble les
   lignées de **toutes** les versions du même code qui portent le même numéro normalisé (minuscules,
   sans espaces, points ni astérisques). Une version sans fichier est prise avec les attributs de son `LIEN_ART`.
6. **Énoncés lus dans le certificat.** Pour `ref-morte-liens` : l'identifiant de la version source, la cible
   du lien (`target_id`, `target_num`, `target_cid`), l'extrait `text_mentions.first`. Pour `ref-morte-texte` :
   l'identifiant de la version source, le numéro cité (`normalized_num`), le code visé et tous les extraits.
   S'y ajoute le sous-type. Les lignées, états et dates du certificat ne sont **pas** utilisés.
7. **Verdict.**
   - (a) La version source doit avoir un fichier XML et être en vigueur selon ses propres métadonnées.
   - (b) Au moins un extrait doit figurer dans son texte. Les deux côtés passent par la même
     normalisation : espaces, apostrophes, guillemets et tirets, puis espaces collés aux guillemets.
     À défaut, le programme compare les deux textes sans aucun espace.
   - (c) Aucune version de l'article (point 5) n'est en vigueur ni annoncée après la date. La dernière
     version de la lignée de la cible (plus grand début, hors versions mort-nées) a un état **terminal**
     qui correspond au sous-type.
   - Une contradiction de (a), (b) ou (c) donne `infirmé`. Une source absente, une cible introuvable ou
     hors des trois codes donne `indéterminé`. C'est aussi le cas si le dernier état n'est pas terminal :
     les XML annoncent alors une version suivante qu'ils ne contiennent pas.

**Témoins négatifs.** Les 5 REF_MORTE déjà `withdrawn` sont recalculés à part et ne sont pas écrits en
base. Ils avaient été retirés parce que leur numéro avait été réattribué. Les 5 ressortent `infirmé`
avec la version en vigueur de l'autre lignée : CCH R111-2 `LEGIARTI000043818263`, CSS D136-1
`LEGIARTI000043565221`. Le contrôle sait donc infirmer un tel cas.

## Corpus reconstitué

71 884 versions d'articles : CGI 23 355, CSS 34 201, CCH 14 328. États : `MODIFIE` 46 000, `VIGUEUR` 13 433,
`ABROGE` 7 937, `TRANSFERE` 2 191, `MODIFIE_MORT_NE` 940, `ABROGE_DIFF` 516, `PERIME` 440, `VIGUEUR_DIFF` 363,
`ANNULE` 33, `DISJOINT` 29, `DEPLACE` 2. Les 71 881 fichiers du stock sont tous sous
`code_et_TNC_en_vigueur/code_en_vigueur`. Aucun échec de lecture. Aucun identifiant sous deux chemins.
Aucun écart entre l'en-tête d'un fichier et les attributs `LIEN_ART` qui le décrivent ailleurs.

Les incréments annoncent 24 suppressions dans les trois codes, soit 20 identifiants distincts (certains
sont répétés d'un jour à l'autre). Deux ont été appliquées. Les 18 autres visent des fichiers absents du
stock, qu'aucun bloc `VERSIONS` ne cite ; aucun candidat n'est concerné.

Incohérences état/dates au 25/11/2026 (constats, sans effet sur les verdicts) : 1 version `MODIFIE` à fin
ouverte ; 1 version à état terminal dont la fin est postérieure à la date ; 0 `VIGUEUR` à fin échue ;
0 `VIGUEUR_DIFF` déjà commencée.

## Résultats

1 112 candidats REF_MORTE au statut `candidate`, tous lisibles.

| Sous-type     |  Confirmé | Infirmé | Indéterminé |     Total |
| ------------- | --------: | ------: | ----------: | --------: |
| abrogé        |       928 |       0 |           0 |       928 |
| transféré     |       166 |       0 |           0 |       166 |
| périmé        |        14 |       0 |           0 |        14 |
| annulé        |         2 |       0 |           0 |         2 |
| autre:MODIFIE |         0 |       0 |           2 |         2 |
| **Total**     | **1 110** |   **0** |       **2** | **1 112** |

| Détecteur               | Confirmé | Infirmé | Indéterminé |
| ----------------------- | -------: | ------: | ----------: |
| `ref-morte-liens@1.1.0` |      443 |       0 |           1 |
| `ref-morte-texte@1.1.0` |      667 |       0 |           1 |

- Extraits : 1 110 retrouvés tels quels après normalisation et 2 retrouvés seulement sans espaces
  (`F-2026-0459`, `F-2026-0962`), soit 0 absent.
- Les 444 candidats `ref-morte-liens` ont tous, dans le XML de la version source, un `LIEN` vers
  l'identifiant cible annoncé.
- 61 versions sources sont `ABROGE_DIFF` : elles restent en vigueur jusqu'à une abrogation datée du
  2027-01-01 (14), du 2028-01-01 (9), du 2029-01-01 (1) ou du 2222-02-22 (37 ; une date de toute évidence conventionnelle, qui ne fixe pas de jour d’abrogation).
  Elles sont tenues pour en vigueur.
- Sur 1 112 candidats, 1 109 ont une seule lignée sous le numéro visé. Les 3 autres en ont deux, et toutes
  sont closes : CCH R131-39 (`F-2026-0317`, `F-2026-0881`) et CSS D756-2 (`F-2026-0839`).
- Dans les 1 110 cas confirmés, la dernière version lue dans les XML est celle que nomme le certificat.

### Infirmés

**Aucun.** Aucun fait lu dans les XML ne contredit un candidat.

### Indéterminés (2)

| Candidat      | Fait constaté dans les XML                                                                                                                                                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `F-2026-0382` | CGI 238 bis AA : quatre versions. La dernière qui a vécu, `LEGIARTI000006303967`, est `MODIFIE` du 1997-04-11 au 2002-01-05. La seule plus récente, `LEGIARTI000006303968`, est `MODIFIE_MORT_NE` (2003-08-31 → 2003-08-02). Aucune version ne prend la suite en 2002. |
| `F-2026-1003` | Même cible, cette fois citée dans le texte.                                                                                                                                                                                                                            |

L'état `MODIFIE` annonce une version suivante absente des XML : la lignée est incomplète. « Aucune version
en vigueur » est exact dans les données, mais rien n'y dit si l'article a pris fin ou si la DILA a perdu sa
suite. Une vérification sur Légifrance ou auprès de la DILA est nécessaire.

## Lecture des résultats

L'accord quasi total était attendu en partie. Les détecteurs appliquent le même critère aux mêmes
archives, lues par l'ingestion. Ce contrôle teste donc surtout la **lecture des données** par une chaîne
séparée : décompression, application des incréments et des suppressions, lignées, règle « en vigueur »,
normalisation du texte. Sur ces points, il n'a trouvé aucune divergence. Il ne teste pas la pertinence
juridique : un renvoi peut viser un article abrogé à dessein (disposition transitoire, citation d'un état
antérieur).

## Écriture en base

`--apply` recalcule tout. Il refuse d'écrire si le résultat diffère de `results.json`. Ensuite, dans une
seule transaction et pour chaque candidat encore `candidate` sans annotation de ce contrôle :

- le programme ajoute la clé `certificate.independent_reproduction_dila_xml` :
  `{ source: 'dila/legi-xml', archives, reference_date, checked_at, verdict, reason, checker, agent }` ;
- un candidat `confirmé` passe à `reproduced` ;
- un candidat `infirmé` passe à `withdrawn`, avec `certificate.withdrawal = { reason: 'independent_reproduction', by, at, note }` ;
- un candidat `indéterminé` garde son statut et reçoit seulement l'annotation.

Aucun autre champ n'est modifié, `updated_at` compris. Un événement `reproduction.finished` est ajouté
au journal `event`. Il ne porte que les totaux par verdict, et son sujet est l'empreinte des couples
(candidat, verdict). Relancer `--apply` ne change rien.

## Limites

- **Même famille de modèles** (Anthropic) que l'auteur des détecteurs. L'indépendance tient au code et
  aux données, et le §4.4 demande aussi une autre famille. Le rejeu par une autre famille sur Tricoteuses
  (`c0.2-independent`, OpenAI) n'a pas pu trancher les REF_MORTE, faute d'historique.
- Les deux chaînes lisent **la même source** (LEGI). Une erreur de la DILA dans les métadonnées (état, date,
  bloc `VERSIONS`) se retrouve dans les deux. Légifrance n'a pas été consulté.
- La règle « en vigueur » est écrite ici et non importée. Elle coïncide avec celle du dépôt sur les cas
  rencontrés, mais elle reste un choix : par exemple, un `MODIFIE` à fin ouverte n'est pas tenu pour en vigueur.
- Un numéro réattribué dans un **autre code** et les renvois vers d'autres textes ne sont pas examinés : les
  candidats ne visent que les trois codes.
- La lecture XML est une extraction par balises, testée sur des cas construits. Le parseur XML n'est pas
  complet (pas de CDATA, pas de validation DTD) ; le corpus réel n'a produit aucun échec de lecture.
- Les blocs `VERSIONS` identiques sont mis en commun grâce à leur longueur et à une empreinte de 64 bits
  (`Bun.hash`). Le risque de collision est négligeable à cette échelle, mais il n'est pas nul.
- Rien ici ne qualifie un candidat. `reproduced` n'est pas `qualified`.

## Rejouer

```sh
bun replications/c0.2-dila-xml/run.ts            # ~45 s, ~500 Mio de mémoire de pointe (aarch64, nice)
bun test replications/c0.2-dila-xml
bun replications/c0.2-dila-xml/run.ts --apply    # écrit les verdicts (idempotent)
```

Sorties : `summary.json` (totaux, versionné), `results.json` (verdict, motif et faits XML par candidat,
non versionné : il se régénère). Pour lister les numéros d'un code et leurs versions :
`C02_DUMP_NUMS='CGI:238 bis a' bun replications/c0.2-dila-xml/run.ts`.
