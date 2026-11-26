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
- **Cadence de travail** : traiter **10 à 20 articles courts** par lot, et **1 à 3 articles complexes** à la fois (jamais 100 articles complexes compressés dans une seule passe). Chaque fiche d'analyse doit fournir des types précis (pas de champ `appréciation_…` fourre-tout), classer chaque alinéa et signaler les ambiguïtés ouvertes.
- **PR groupées (« bundle »)** : acceptées jusqu'à **100 articles maximum**, à condition de rester homogènes (ne pas mélanger traductions `.catala_fr` et fichiers hors `.catala_fr` dans une même PR).
- **Titre recommandé** :
  - Un article : `corpus(<code>): formaliser <article> (<LEGIARTI>)`
  - Lot (≤ 100) : `corpus(<code|multi>): formaliser <N> articles (<liste courte>)`
- **Contenu** : tableau récapitulatif `| Code et article | LEGIARTI | Type | Résumé | Tâche |`, résultat `check-corpus-pr.ts` + `clerk test`, et provenance déclarée (`Famille`, `Modèle`).

## Méthode d'analyse avant PR (articles complexes)

Avant d'intégrer une fiche d'analyse (`corpus/analyses/*.md`) dans une PR, relire l'article de bout en bout sur ces 4 points (exemple annoté : [CGI 216 A (`LEGIARTI000006303505.md`)](analyses/LEGIARTI000006303505.md)) :

1. **Unité de calcul et regroupement** : indiquer ce que représente une ligne, par quel identifiant les éléments se regroupent et sur quelle période (ex. CGI 216 A : suivi par engagement, exclusion et réintégration par abandon).
2. **Décisions dans l'ordre et règles dans le temps** : séparer admission, exécution et conséquence du manquement ; nommer le montant utilisé à chaque étape, l'événement déclencheur, la période exacte, l'état antérieur nécessaire (ex. tranches déjà imposées) et l'état à produire si une donnée déterminante manque.
3. **Test des deux cas aux mêmes entrées** : se demander si deux situations juridiquement différentes peuvent encore produire les mêmes entrées (ex. établissement secondaire vs principal sur CGI 11 ; deux abandons de 100 couverts par une promesse de 100 ; un abandon de 100 avec 150 promis et 100 réalisés). Si la fiche ne permet pas de distinguer leur sortie, il manque une entrée ou une règle de décision.
4. **Loi vs Doctrine (BOFiP)** : si un cas limite relève de la doctrine fiscale (BOFiP), le noter comme limite de la fiche et le réserver à une analyse de doctrine distincte, sans le mélanger au texte de loi.

### Pendant la revue (CodeRabbit ou humain)

- Répondre dans chaque fil avec le commit correctif ou le motif du désaccord en citant l'alinéa exact.
- Distinguer dans la PR les contrôles mécaniques passés, les questions d'interprétation ouvertes et les fiches demandant une relecture avant traduction.
