# Ingestion DILA LEGI

## Commandes

```sh
bun install
bun run db:migrate
nice bun packages/ingest/src/cli.ts legi --incremental
nice bun packages/ingest/src/cli.ts legi --codes CGI,CSS --date 2026-11-25 --dry-run
bun run --filter @bugdeloi/ingest ingest legi --help
```

- La date par défaut est la date UTC. `--date` projette l'arbre des codes sélectionnés à cette date.
  Les articles conservent toutes les versions reçues. Chaque code mémorise sa date de projection.
- Par défaut, la CLI propose le dernier stock. Avec `--incremental`, elle ajoute dans l'ordre les
  incréments qui suivent ce stock et reprend après le dernier lot de chaque code. Un état plus récent
  est conservé lorsqu'un stock antérieur reste au catalogue.
- `--archive` accepte un chemin local portant le nom DILA. Un stock local seul fonctionne hors
  ligne. Combiné à `--incremental`, il sert de base aux incréments du catalogue. Un incrément local
  avec `--incremental` s'applique seul. Dans ce dernier cas, l'opérateur fournit les lots successifs
  dans l'ordre.
- `--dry-run` utilise le cache et calcule en mémoire la projection d'un stock et de ses incréments.
  Pour un incrément local seul, il résume les documents et retraits du lot. La simulation ne se
  connecte pas à Postgres.
- Les téléchargements nécessitent `curl` et `flock`. Les fichiers compressés, les reprises `.part`
  et les empreintes `.sha256` se trouvent sous `~/.cache/bugdeloi/dila/`. La CLI reprend un fichier
  partiel et contrôle l'empreinte d'une archive déjà présente avant de la lire.
- Le test d'intégration `bun test` utilise `bugdeloi_test` sur le socket Unix avec le rôle `ubuntu`.
  Appliquer les migrations à cette base après avoir activé les extensions prévues pour le dépôt.

## Structure observée

Données de la DILA, base LEGI, Licence Ouverte 2.0. Stock
[Freemium_legi_global_20261108-140000.tar.gz du 8 novembre 2026](https://echanges.dila.gouv.fr/OPENDATA/LEGI/Freemium_legi_global_20261108-140000.tar.gz).
Incréments jusqu'au
[LEGI_20261124-221545.tar.gz du 24 novembre 2026](https://echanges.dila.gouv.fr/OPENDATA/LEGI/LEGI_20261124-221545.tar.gz).
[Fiche DILA](https://echanges.dila.gouv.fr/OPENDATA/LEGI/DILA_LEGI_Presentation_20170824.pdf) et
[DTD Légifrance](https://echanges.dila.gouv.fr/OPENDATA/DTD_LEGIFRANCE/).

Sous `<horodatage>/legi/global/code_et_TNC_en_vigueur/code_en_vigueur/LEGI/TEXT/`, le chemin
comporte cinq répertoires de deux chiffres puis le CID du code. Les titres dans
`texte/version/<LEGITEXT>.xml` confirment les trois identifiants de `CODES`.

| Code | LEGITEXT               | Titre DILA                                 |
| ---- | ---------------------- | ------------------------------------------ |
| CGI  | `LEGITEXT000006069577` | Code général des impôts                    |
| CSS  | `LEGITEXT000006073189` | Code de la sécurité sociale                |
| CCH  | `LEGITEXT000006074096` | Code de la construction et de l'habitation |

- La racine est `texte/struct/<LEGITEXT>.xml` (`TEXTELR/STRUCT`). Une section se trouve sous
  `section_ta/LEGI/SCTA/…` (`SECTION_TA/STRUCTURE_TA`) et un article sous `article/LEGI/ARTI/…`.
  La racine et les sections référencent les enfants dans leur ordre de lecture. Les sections vides
  et les éventuels articles directement à la racine sont pris en compte.
- Les positions commencent à 1. La position 0 marque un article sans placement à la date demandée.
  Les dates d'un lien sont évaluées sur l'intervalle `[début, fin[`, avec `2999-01-01` comme fin
  ouverte. Les états `ANNULE`, `NON_VIGUEUR` et `MODIFIE_MORT_NE` sont écartés de la projection.
  Un enfant ne peut apparaître que si ses liens ancêtres figurent également dans l'arbre daté.
- `BLOC_TEXTUEL/CONTENU` et `NOTA/CONTENU` gardent le HTML source. La normalisation et
  l'empreinte utilisent `@bugdeloi/core`. Un article sans numéro a une clé `article_key` nulle.
  Chaque entrée du bloc `LIENS` est conservée, avec sa direction et l'attribut `nortexte`.
- `liste_suppression_legi.dat` donne les chemins des documents, généralement sans `.xml`.
  `liste_suppression_legi_dossier.dat` marque les dossiers par un suffixe ` D`. Un XML fourni
  dans le même lot remplace son ancienne version. Un retrait sans remplacement qui effacerait
  un niveau supérieur à N0, un drapeau ou des éléments de preuve fait échouer la transaction
  du code et reste visible dans le journal d'ingestion.
- Le stock peut être relu en flux avec `node:zlib` et [tar-stream](https://github.com/mafintosh/tar-stream)
  (MIT, prise en charge des en-têtes tar étendus). [Saxes](https://github.com/lddubeau/saxes)
  (ISC, dernière version majeure 6, dépôt amont archivé) contrôle la syntaxe XML et fournit les
  positions nécessaires pour conserver le HTML sans le resérialiser. Les versions sont épinglées.
  La CLI écrit seulement les articles ciblés dans des fichiers temporaires et les charge par lots.
  Les autres entrées sont consommées en flux puis écartées.

## État chargé dans Postgres

Stock initial et 19 incréments appliqués dans `bugdeloi`. Empreinte du stock
`90c9dc4a0a362943eef055881f00a727ac5d5f08fb9b4ec472e9da6da572bda2`. La commande complète
avec `nice` a duré 7 min 09 s sur ARM64, avec un pic RSS de 723 Mio et des incréments en partie
déjà en cache. La reprise au même lot et à la même date a duré 1,20 s.

| Code | En vigueur au 25/11/2026 | Hors arbre | Versions | Sections | Profondeur |   Liens |
| ---- | -----------------------: | ---------: | -------: | -------: | ---------: | ------: |
| CGI  |                    2 405 |         32 |   23 355 |    1 213 |         10 | 449 916 |
| CSS  |                    7 420 |          0 |   34 201 |    2 584 |          8 | 602 913 |
| CCH  |                    4 126 |          0 |   14 328 |    1 253 |          7 | 157 223 |

Les compteurs « en vigueur » suivent les dates et états DILA au niveau article. Dans le CGI,
30 versions `ABROGE_DIFF` et 2 `VIGUEUR` restent hors de l'arbre daté. Les parents immédiats
des articles CGI 302 B (`LEGIARTI000041535200@2026-01-01`) et 591
(`LEGIARTI000048391647@1950-04-30`) portent des liens expirés dans leur hiérarchie. Deux dates
atypiques restent telles que livrées. Le CGI 302 J (`LEGIARTI000021664265@2010-04-01`) est
`ABROGE` avec une fin portée à `2222-02-22`. Le CSS R611-2 (`LEGIARTI000036704272@2018-01-01`)
est `MODIFIE` avec une fin ouverte alors qu'une version ultérieure figure dans le même groupe.
Leur intervalle source contient la date de projection.

Les fenêtres **[début, fin[**, le HTML, le texte normalisé et l'empreinte en base concordent
avec les XML extraits directement des lots ci-dessous. Les deux blocs textuels ont aussi été
relus sur leurs extraits de début et de fin.

| Article    | Version LEGI           | Période DILA             | Lot du XML                                    | SHA-256 du texte normalisé                                         |
| ---------- | ---------------------- | ------------------------ | --------------------------------------------- | ------------------------------------------------------------------ |
| CGI 197    | `LEGIARTI000053542636` | 2026-02-21 à fin ouverte | `LEGI_20261117-212708.tar.gz`                 | `ce26346a219e9c3c9a4628236dcf3e1f6dba2a9699443769b22f37e191eecbfa` |
| CSS L521-1 | `LEGIARTI000029963006` | 2015-07-01 à fin ouverte | `Freemium_legi_global_20261108-140000.tar.gz` | `dba7791b101b866ba384539583d0af97f9feb65f34ee5b6b876ff7782f8e3b59` |
