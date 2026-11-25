# Notes — balayage mécanique (`packages/sweep`, C0.2)

Apprentissages du chantier « première lumière sans LLM » (25/11/2026). Court et factuel. Rapport chiffré :
[`replications/c0.2/REPORT.md`](../../replications/c0.2/REPORT.md).

## Utiliser

```sh
bun packages/sweep/src/cli.ts run [--codes CGI,CSS,CCH] [--detectors a,b] [--dry-run] [--json]
bun packages/sweep/src/cli.ts replay F-2026-0001        # code de sortie 0 si la preuve est identique
bun packages/sweep/src/cli.ts list --type REF_MORTE --subtype abrogé --limit 20
bun replications/c0.2/run.ts [--report-only]            # balayage + candidates.json + results.json + REPORT.md
bun replications/c0.2/triage-input.ts out.json          # retire l'échantillon de triage (graine 20261125)
```

Un lancement écrit : une ligne `sweep_run`, des `finding` au statut `candidate` (dédoublonnés par
`finding_fingerprint`), un événement `sweep.finished`. **Aucun** événement `finding.*`, et la charge utile de
`sweep.finished` ne contient aucun nombre de candidats (le journal public l'affiche tel quel). Un second lancement
sur la même base et avec les mêmes versions ne crée aucun finding et ajoute un `sweep_run` et un événement.

Lors d'une montée de version, un finding encore produit conserve son identifiant, son empreinte et son
certificat d'origine. Pour les statuts `candidate` et `reproduced`, seule la version dans la colonne `detector`
est actualisée. Si son empreinte disparaît du nouveau balayage, il passe à `withdrawn` avec
`certificate.withdrawal = { reason: 'detector_fix', by, at, note }`. L'ancien certificat et l'empreinte restent
en base. La réconciliation couvre les sources identifiées dans les codes balayés. La disparition d'un finding
`qualified`, `published` ou `rejected` annule les écritures du balayage. Le détail est consigné dans
`sweep_run.error` et remonté par la commande de rapport. Le rejeu applique le détecteur courant à la version citante et indique si sa version diffère
de celle épinglée dans le certificat.

## Structure du paquet

- `context.ts` : charge la base une fois (`loadContext`, ≈ 3 s, ≈ 500 Mio) ; `buildContext` est pure (tests sans base).
  Contrôle à chaque chargement que `isInForce` (JS) et `articleInForce()` (SQL) retiennent les mêmes versions.
- `detectors/*.ts` : un détecteur = un fichier, `scan(ctx, {only, codes}) → {candidates, stats, notes}` ; version dans
  `VERSION` (le certificat garde `nom@version` ; l'empreinte n'en dépend pas).
- `run.ts` : exécution, insertion, numérotation `F-AAAA-NNNN` sous verrou consultatif (ordre déterministe : type,
  sous-type, version source, empreinte). `replay.ts` : relance le détecteur sur la seule version citante.
- `citations.ts` : extraction des numéros d'articles écrits dans le texte (pure, la plus testée).

## Pièges LEGI rencontrés

- **Sens des liens** : pour `CITATION`, `sens = 'source'` = « CET article cite la cible » ; `cible` = « la cible cite
  cet article ». Contrôlé sur CSS L521-1 (cite L512-3 et L521-3 : liens `source` ; D521-1 le cite : lien `cible`).
  Les liens `cible` ne sont jamais lus (ce sont les citations entrantes).
- **Blocs `VERSIONS` incomplets** : la liste d'une ancienne version n'inclut pas les versions plus récentes (287
  numéros d'article ont plusieurs listes différentes). Un « article » est donc la **composante connexe** de tous les
  blocs (union-find, plus petit LEGIARTI comme identifiant). 278 versions listées ne sont pas en base.
- **Liens vers des versions absentes du stock** : 3 160 liens (11 %) pointent vers un LEGIARTI inconnu de la base alors que
  l'article existe sous un autre LEGIARTI. Rattachement par `(target_cid, target_num)` ; un numéro porté par plusieurs
  lignées n'est « mort » que si toutes le sont.
- **Numéro réattribué** : un lien vers une lignée historique terminée peut porter le même numéro qu'une
  autre lignée en vigueur dans le même code (CCH `R111-2`, CSS `D136-1`). Le lien conserve sa cible
  historique et entre dans la classe `numero_reattribue`, exclue des candidats. La version en vigueur doit
  porter ce numéro elle-même. Un ancien numéro d'une lignée en vigueur sous un autre numéro ne suffit pas.
  La citation textuelle donne la priorité à la version qui porte le numéro cité en vigueur.
- **Liens parasites** : certains liens vers un article mort ne correspondent à aucune citation du texte actuel (héritage
  d'une rédaction antérieure). Ils ne sont pas des candidats (voir `ecarts-lien-texte.json`).
- **Une version `MODIFIE_MORT_NE`** (fin avant début) ne dit rien de la fin de vie de l'article : exclue du choix de la
  « dernière version » qui donne le sous-type (`abrogé`, `transféré`, `périmé`, `disjoint`, `annulé`, `autre:<état>`).
- **Deux versions d'un même article en vigueur** (CSS R611-2, voir `legi.md`) : comptées, jamais candidates.
- **Numéros** : `R*111-9` (astérisque) s'écrit « R. 111-9 » dans le texte ; un « İ » (I point suscrit) se glisse dans
  certains numéros ; les annexes ont des numéros du type « Annexe I à l'article D353-59 ».
- **Le HTML mélange `<p>` et `<br/>`** : les alinéas sont obtenus en coupant sur `</p>` et `<br>`. Le premier alinéa
  d'un article n'a souvent pas de `<p>` ouvrant.
- **`normalizeLegalText` remplace « et » par `"`** : pour contrôler les guillemets français, `text.ts` protège « » le
  temps de la normalisation (`normalizeKeepingGuillemets`) ; le texte normalisé canonique, lui, reste celui du hachage N1.

## Pièges JavaScript

- `\b` ne reconnaît que l'ASCII : `traité\b` ne coupe pas après « é ». Utiliser `(?![\p{L}])`.
- Une alternance de suffixes (`quater|quatervicies`) doit être triée par longueur décroissante, avec un `(?![\p{L}\d])`
  derrière, sinon « quatervicies » est lu « quater » (bug trouvé par le triage).
- Le biome `useMathMinMax` propose `Math.min` pour des chaînes : faux, à réécrire autrement.

## Choix de précision (détecteur textuel)

- Un numéro n'est jugé que si la norme visée est certaine : « du présent code », un des trois codes nommés, ou rien.
  Écartés : loi, décret, annexe, sigle, « du même code », « précité », désignation donnée plus loin dans la proposition.
- CSS/CCH : numéro sans préfixe L/R/D jamais cherché ; CGI : préfixe sans désignation jamais cherché ; « article 1er »
  sans désignation écarté (presque toujours l'article 1er d'une loi).
- Un numéro absent de la base n'est jamais jugé ; la part des occurrences jugées est publiée dans le rapport (couverture).
- Les indices (`hints`) ne filtrent rien : ils signalent « dans sa rédaction… », « en vigueur avant le… », etc.

## Portée des subdivisions

- Les marqueurs à l'intérieur d'une citation entre guillemets français ou droits sont écartés.
  Une citation peut couvrir plusieurs alinéas, avec reprise du guillemet ouvrant en tête d'alinéa.
  La liste englobante reprend à la fermeture de la citation. Un guillemet laissé ouvert jusqu'à la
  fin de l'article peut donc masquer des marqueurs.
- Chaque marqueur de niveau supérieur réinitialise les suites de ses descendants. Les titres
  romains suffixés, dont `III bis.-1.`, `III. bis.-1.` et `III. – bis`, ouvrent leur propre subdivision.
  Le suffixe ouvre une nouvelle portée sans fournir de rang numérique pour la détection de doublons.

## Triage de l'échantillon

30 candidats tirés par graine fixée (`replications/c0.2/sample.ts`, mulberry32, strates triées par empreinte) et classés par
un LLM sans accès à Légifrance. C'est non probant (AGENTS.md §4.2) : il a servi à trouver et corriger des détecteurs
(adverbes, « article 1er de la même loi », guillemets sur plusieurs alinéas, marqueurs composés « B. 1° »), pas à qualifier.
Le tirage change si le jeu de candidats change : figer les détecteurs avant de trier.

## Reste à faire

- Détecter les renvois vers des **alinéas inexistants** (PLAN C0.2) : non couvert, il faut un modèle des subdivisions.
- Plages : seules les bornes sont lues ; les articles intermédiaires d'une plage ne sont pas jugés.
- Étendre la résolution aux codes cités mais non ingérés quand d'autres codes seront chargés.
- Rejeu en CI : `replay` sait comparer la preuve, pas encore passer un candidat à `reproduced`.
