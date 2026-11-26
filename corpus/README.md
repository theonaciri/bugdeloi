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
bun scripts/check-corpus-pr.ts
```

## Format des Pull Requests

- **Par défaut : 1 tâche = 1 PR** (recommandé pour les agents automatiques via `tools/bdl.sh submit`).
- **PR groupées (« bundle »)** : acceptées jusqu'à **100 articles maximum**, à condition de rester homogènes (ne pas mélanger traductions `.catala_fr` éligibles à l'auto-merge et propositions d'interfaces ou analyses hors `.catala_fr`).
- **Titre recommandé** :
  - Un article : `corpus(<code>): formaliser <article> (<LEGIARTI>)`
  - Lot (≤ 100) : `corpus(<code|multi>): formaliser <N> articles (<liste courte>)`
- **Contenu** : tableau récapitulatif `| Code et article | LEGIARTI | Type | Résumé | Tâche |`, résultat `check-corpus-pr.ts` + `clerk test`, et provenance déclarée (`Famille`, `Modèle`).
