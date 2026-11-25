# Notes — qualification humaine des anomalies

Le dossier est généré dans `qualifications/dossiers/`, ignoré par Git. Sans filtre, il prend au plus
25 constats reproduits, tous types confondus. Pour un statut donné, les fiches sans indice textuel de
légitimité passent en premier. `--seed` départage les fiches d’une même priorité dans un ordre
reproductible à jeu de certificats inchangé. Les extraits proviennent du certificat. Pour les renvois,
le passage est repéré par la position du segment dans le texte normalisé.

```sh
bun packages/sweep/src/cli.ts dossier
bun packages/sweep/src/cli.ts dossier --status candidate --type REF_MORTE --limit 25 --seed 20261125
bun packages/sweep/src/cli.ts qualify qualifications/verdicts/AAAA-MM-JJ-handle.yaml --dry-run
bun packages/sweep/src/cli.ts qualify qualifications/verdicts/AAAA-MM-JJ-handle.yaml
bun packages/sweep/src/cli.ts publish F-AAAA-NNNN
```

Le relecteur crée et commite son fichier en suivant `qualifications/verdicts/EXEMPLE.yaml.sample`.
Chaque entrée comporte un identifiant unique, un verdict, une note motivée et le handle du relecteur,
identique à celui du nom du fichier. Le CLI lit le blob Git, compare l’index et le fichier local et
enregistre le dernier commit ayant touché le fichier. Le rapprochement entre le commit et le relecteur
relève de la revue du dépôt. Un lot est appliqué dans une transaction avec ses événements. Le même
lot peut être rejoué sans effet, y compris après publication.

Le registre et le compteur sélectionnent `qualified` et `published`. Le cimetière exige un statut
`rejected`, un verdict défavorable et les champs de traçabilité Git. Le journal public continue à
afficher les événements de qualification favorable et de publication. Les pages sont en lecture seule
avec la politique de cache des pages de données.

Dépendance `yaml@2.8.3` dans le CLI sweep (ISC, sans dépendance transitive, maintenue). Le parseur
détecte les clés répétées et les documents multiples. Le schéma métier rejette les entrées ambiguës.
Les alias sont désactivés.
