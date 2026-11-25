# C0.3 · Harnais de re-formalisation aveugle

L’auteur reçoit les [consignes](task/TASK.md), les [textes LEGI](task/articles.json) et
[l’interface](task/interface.md). Remettre uniquement les chemins suivants dans un environnement isolé
sans connexion, avec l’image Catala préparée. Le destinataire peut compiler sa soumission sur place.

```sh
git archive HEAD replications/c0.3/task replications/c0.3/check.ts \
  packages/runner/src/index.ts infra/catala/image.lock.json | tar -x -C "$C03_EXPORT"
```

## Génération et rejeu côté évaluation

```sh
bun replications/c0.3/generate-task.ts [/chemin/Freemium_legi_global_20261108-140000.tar.gz]
bun replications/c0.3/check-leaks.ts
bun replications/c0.3/evaluate.ts <pseudo> [commit]
C03_REPLAY=1 bun test replications/c0.3/harness.test.ts
```

- Le générateur repère les titres d’articles avec code selon la règle C0.1. Il conserve les
  LEGIARTI cités puis ajoute les versions applicables aux dates de calcul relevées dans la suite,
  du 26 août 2019 au 1er mai 2022. Il résout les citations sortantes directes dans Postgres et
  ajoute des renvois de contexte. La transaction est en lecture seule. L’éducation et le décret
  relatif à Mayotte viennent du stock XML DILA, qui fournit aussi le tableau de l’annexe.
  Les renvois encore absents figurent dans le JSON.
- L’évaluateur lit les fichiers de soumission au commit demandé (par défaut `HEAD`). Il compile
  d’abord la soumission seule. Il copie ensuite les cas Inria dans un dossier temporaire et
  traduit leurs entrées et sorties par l’adaptateur. Le JSON écrit dans `results/<pseudo>.json`
  consigne le commit Inria, le commit évalué, le digest de l’image et les résultats détaillés.
  Le champ `classification` reste à renseigner en revue.
- Le score divise le nombre de réussites par les 32 entrées Clerk, dont 15 scopes d’assertions et
  17 commandes CLI. Il conserve le doublon CLI et les deux contrôles structurels d’Inria.
  Le test de fuite fait partie de `bun run verify`. Le rejeu d’intégration demande l’image locale
  et s’active avec `C03_REPLAY=1`.
- Le témoin adapte l’implémentation Inria d’origine et conserve ses barèmes internes. Les remises
  aveugles reçoivent les paramètres officiels sourcés dans [l’interface](task/interface.md).
  Les deux séries diffèrent sur le Smic de fin 2021 et les plafonds de ressources 2022.
  Ces écarts de données sont à examiner lors de la revue des échecs.

Source épinglée par C0.1 à `9e251b932288cf5f4a74af072d203144a057494b`. Les allocations familiales
et leurs dépendances de rejeu relèvent de la licence Apache-2.0 du dépôt. Le rejeu temporaire conserve
la licence d’origine. Les textes du paquet viennent de la DILA, sous Licence Ouverte 2.0.
[Licence Inria](https://github.com/CatalaLang/catala-examples/blob/9e251b932288cf5f4a74af072d203144a057494b/LICENSE.txt)
· [Provenance LEGI](../../docs/notes/legi.md)
