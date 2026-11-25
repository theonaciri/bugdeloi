# Chaîne d’outils Catala

## Construire et identifier l’image

Podman rootless, Debian 13, opam 2.3.0, OCaml 4.14.2 et Catala 1.3.2 avec Clerk et Ninja.
Le Containerfile utilise le même chemin opam sur ARM64 et x64. OCaml est compilé avec deux tâches
opam en parallèle. Le build ARM64 a duré environ 8 min 30 s. Python 3.13.5 est présent. Le rejeu utilise
l’interpréteur Catala.

```sh
nice -n 10 podman build -t localhost/bugdeloi-catala:1.3.2 infra/catala
podman image inspect --format '{{.Digest}} {{.Id}} {{.Architecture}}' localhost/bugdeloi-catala:1.3.2
```

Le verrou [image.lock.json](../../infra/catala/image.lock.json) contient le digest du manifeste de
l’image ARM64 construite localement. Le runner compare ce digest et l’architecture avant de lancer
l’ID immuable de l’image avec `--pull=never`. Une reconstruction à partir des dépôts opam et Debian
peut produire un autre digest. Il faut conserver l’image verrouillée pour rejouer avec ce digest.
GHCR et la construction x64 restent à mettre en place.

## Rejouer C0.1 et relever la couverture

Le rejeu utilise l’image verrouillée dans le stockage Podman local, Bun et la base migrée.

```sh
bun install
bun replications/c0.1/run.ts
bun replications/c0.1/coverage.ts
```

Les scripts clonent la source dans `~/.cache/bugdeloi/ext/catala-examples` si elle est absente
et utilisent uniquement l’archive Git du commit épinglé dans [source.ts](../../replications/c0.1/source.ts).
Le runner monte cette archive extraite dans `/work` en lecture seule. Clerk utilise `/build` sur
tmpfs. Clerk 1.3.2 crée aussi son répertoire de cibles durant `test`. Les options `--build-dir=/build`
et `--target-dir=/build/targets` maintiennent toutes ces écritures sur le tmpfs. Le conteneur tourne sans réseau ni capacités, avec racine en lecture seule, mémoire et CPU
limités, au plus 128 processus et sorties capturées à hauteur de 16 Mio par flux. Podman impose
un délai de secours en secondes. Au délai demandé par l’appelant, le runner tue le client et force
la suppression du conteneur.

La base par défaut est `bugdeloi` via socket Unix. `DATABASE_URL` permet de sélectionner
`bugdeloi_test`. Chaque rejeu ajoute les lignes `replication_run` et l’événement
`replication.finished` dans une transaction. Voir les [résultats C0.1](../../replications/c0.1/REPORT.md).

Le [résumé de couverture](../../replications/c0.1/coverage.json) compte les identifiants LEGIARTI
dont le titre est suivi d'un bloc Catala avec une définition, une règle, une assertion ou une déclaration.
La clé de `reference_coverage` regroupe par source, identifiant et fichier. Le relevé conserve le
premier titre qui satisfait cette règle pour un même identifiant dans un fichier.

`bun replications/c0.1/promote.ts --dry-run` rapproche la couverture recalculée de la version en
vigueur et du dernier rejeu terminé du dossier. La suite doit avoir le statut `passed` et compter
au moins un test. Après relecture du résultat, retirer `--dry-run` actualise la couverture et les
marqueurs en base dans une transaction. Le journal conserve le motif de chaque retrait.

Le dépôt BugDeLoi conserve les métadonnées et les résumés. Les journaux bruts restent ignorés par
Git, notamment les sorties de la suite `impot_revenu` sous CeCILL.

## Extensions du compilateur

La livraison standard opam inclut le générateur Python. Exécuter sa sortie demande le runtime
Python de Catala et ses dépendances, absents de l’image C0.1. La version source 1.3.2 déclare séparément `catala-js` avec
`js_of_ocaml` et `catala-proof` avec Z3. Voir les définitions de [catala-js](https://github.com/CatalaLang/catala/blob/1.3.2/catala-js.opam) et [catala-proof](https://github.com/CatalaLang/catala/blob/1.3.2/catala-proof.opam).

Dans le conteneur, `opam list --all --short "catala*"` affiche `catala`, `catala-format` et
`catala-lsp` dans l’index. `catala proof`, `catala js` et `catala api_web` renvoient
« unknown command » (sortie 124). `js_of_ocaml` et Z3 sont absents. La compilation vers JavaScript
demande la chaîne complémentaire du dépôt Catala. Cette compilation reste à essayer dans une
image dédiée.
