# C0.1 — Rejeu des tests Inria

Source [catala-examples@9e251b932288](https://github.com/CatalaLang/catala-examples/tree/9e251b932288cf5f4a74af072d203144a057494b)

Catala 1.3.2 · arm64 · `sha256:d62905c562db64c7ad8d7aebc0ae7032e035e0f41594b8b05be107fd8c63e26b`

```sh
bun replications/c0.1/run.ts
```

Prérequis locaux et préparation de l’image dans les [notes Catala](../../docs/notes/catala.md).

| Dossier                                 | État       | Tests comptés | Réussis | Échoués | Durée (s) |
| --------------------------------------- | ---------- | ------------: | ------: | ------: | --------: |
| `allocations_familiales`                | Réussi     |            32 |      32 |       0 |      3.49 |
| `aides_logement`                        | Réussi     |            68 |      68 |       0 |     17.06 |
| `impot_revenu`                          | Réussi     |            54 |      54 |       0 |      4.95 |
| `prestations_familiales`                | Réussi     |             2 |       2 |       0 |      1.44 |
| `smic`                                  | Aucun test |             0 |       0 |       0 |      0.32 |
| `base_mensuelle_allocations_familiales` | Aucun test |             0 |       0 |       0 |      0.31 |
| `droit_successions`                     | Réussi     |             8 |       8 |       0 |      1.31 |
| `asp/aide_fibre`                        | Réussi     |             1 |       1 |       0 |      1.35 |
| `asp/bcae7`                             | Réussi     |             5 |       5 |       0 |      1.94 |
| `asp/fonpeps`                           | Réussi     |             1 |       1 |       0 |      1.44 |

Le rejeu exécute les dossiers français sélectionnés avec le backend interpréteur, en isolant
les trois suites ASP déclarées par le projet source. Les compteurs reprennent les scopes annotés
et les tests CLI énumérés dans le rapport JSON de Clerk. Si Clerk
s’interrompt avant d’émettre son rapport, le dossier est en erreur et le total des tests reste
inconnu. Les lignes à zéro test décrivent uniquement ce que Clerk a compté.

- `smic` — aucun test signalé par Clerk.
- `base_mensuelle_allocations_familiales` — aucun test signalé par Clerk.

Les sorties brutes sont dans `raw/run-abqUPY/` sur la machine du rejeu. Les commandes et
les résultats par fichier figurent dans [results.json](results.json).
