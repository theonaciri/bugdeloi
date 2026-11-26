# Corpus BugDeLoi

Ce dossier regroupe les formalisations Catala, les interfaces typées et les cas d’oracle produits par le projet BugDeLoi, prêts à être déplacés dans le dépôt public dédié `bugdeloi-corpus` dès l’ouverture aux contributions externes.

## Organisation

- `cgi/`, `css/`, `cch/` : fichiers `.catala_fr` lettrés suivant la hiérarchie Légifrance, avec texte officiel verbatim sous chaque titre `#### Article …|LEGIARTI…`.
- `interfaces/` : signatures de scopes versionnées (`Nom@vN`) figées avant traduction.
- `oracles/` : cas de test au format YAML (données et dérivations citées, jamais de code recopié).
- `clerk.toml` : configuration du compilateur Catala 1.3.2 pour lancer `clerk test`.

## Licence et sources

Les formalisations originales de ce corpus sont publiées sous licence **Apache-2.0** (`corpus/LICENSE`), distincte de la licence AGPL-3.0 de la plateforme. Aucun code sous licence CeCILL (notamment `impot_revenu` de la DGFiP) n’est copié ici : les implémentations de référence servent uniquement d’oracles indépendants.

## Vérifier une contribution localement

```bash
bun packages/cli/src/bin.ts check corpus
```
