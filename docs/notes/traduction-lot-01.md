# Lot de traduction n° 1 (27/11/2026) : retour d'expérience

Dix tâches `translate` prises au guichet de production par l'orchestrateur (famille `anthropic`, modèle
`claude-opus-5-5`) : CGI 4 A, 4 bis, 8 bis, 8 quinquies, 11, 12, 14, 28, 29, 30. Une PR groupée :
[#20](https://github.com/theonaciri/bugdeloi/pull/20). Temps de rédaction : une heure environ, dont deux
itérations de compilation.

## Problèmes rencontrés

1. **Réservation par lot cassée pour les outils.** `GET /desk/next` réserve 20 tâches par défaut et
   répond `{count, tasks:[…]}`. `tools/bdl.sh next` et la commande curl de join.txt lisaient `.task` et
   `.lease` : un agent aurait réservé 20 tâches, échoué, puis laissé 20 baux expirer. Corrigé : `limit=1`
   explicite dans les deux, format de réponse documenté.
2. **Chemin calculé incorrect.** « 1re Sous-section » donnait `1re-sous-section` au lieu de
   `sous-section1`. Corrigé dans `sectionSlug` (ordinal placé avant le type). Les fichiers du lot gardent
   le chemin imposé par leur tâche.
3. **Précédence Catala.** `Argent.somme de transforme … en x = 1 000 €` compare à l'intérieur de la
   somme : erreur « Incompatible types: got bool, expected money ». Documenté.
4. **Renouvellement de dix baux.** `tools/bdl.sh beat` ne prend qu'un identifiant ; il a fallu une
   boucle. Documentée dans join.txt.
5. **Pas de contrôle du texte sans base LEGI.** Seul `promote-corpus` (qui demande la base) comparait le
   texte à LEGI ; `check-corpus-pr.ts` et la CI ne le faisaient pas. Corrigé : 407 fiches sur 408 citent le
   texte avec l'empreinte LEGI exacte ; la CI compare désormais le texte et le nom du champ d'application à
   la fiche d'analyse.

## Informations manquantes

- La syntaxe Catala des listes, des valeurs optionnelles, des sommes et des énumérations (le corpus n'en
  avait aucun exemple) : il a fallu la chercher dans les exemples Inria. → `corpus/CATALA.md`.
- Le sens de `date_fin = 2999-01-01` (sans fin connue). → AGENTS.md §7, CATALA.md, join.txt.
- Catala n'a pas de type texte : une interface qui annonce un « identifiant » se traduit par un entier.
- Les fiches titrent « Classement des dispositions » autant que « des alinéas ». → join.txt.
- Que faire d'un arrondi non fixé par le texte (produit argent × décimal) → `# TODO juridique` et mention
  dans la PR.

## Optimisations de processus

- `tools/bdl.sh next --count N` et `beat --all` éviteraient la boucle manuelle pour un lot.
- Un sous-commande `bdl.sh submit-batch` (un commit, une ligne `BugDeLoi-Task` par tâche, une PR, puis
  `release submitted` pour chaque bail) rendrait les lots aussi sûrs que les tâches unitaires.
- Les fiches d'analyse gagneraient à donner les types Catala directement (`argent`, `liste de …`,
  `optionnel de …`) plutôt qu'en mots.

## Commentaires CodeRabbit (première relecture, 15 fils)

- **Provenance des valeurs d'essai (9 fils).** CodeRabbit refusait tout montant, année ou date des tests
  absent du texte. La cause était notre propre consigne : join.txt et `.coderabbit.yaml` disaient « des
  valeurs tirées du texte seul », impossible pour un article sans chiffres. Les tests attribuaient en outre
  ces valeurs à l'article (`# LEGIARTI… : 12 000 € de revenu brut`). Correction : date d'application =
  début de la version, entrées annoncées par `# Cas d'essai synthétique : …`, politique écrite dans
  AGENTS.md §7, CATALA.md, join.txt et `.coderabbit.yaml`.
- **Couverture (5 fils).** Aucun test au premier jour de la version, aucune exclusion testée sur 14 et 30,
  branches manquantes sur 11. Corrigé : un cas par règle et par condition qui écarte l'article, désormais
  exigé par la consigne. Le test de rejet de la veille demandé sur 8 bis et 8 quinquies est impossible
  (Catala 1.3.2 n'a pas de test d'échec attendu) ; la consigne ne le demande plus.
- **Arrondi sur 8 bis et 8 quinquies (1 fil).** CodeRabbit demandait un paramètre d'arrondi et un finding
  `ARRONDI`. Refusé avec motif : l'écart possible est d'un demi-centime, sous le seuil de 1 € du finding, et
  le paramètre changerait l'interface figée. La consigne le précise maintenant.

Aucun commentaire ne portait sur le texte cité, l'interface ou les règles elles-mêmes : les contrôles
mécaniques ajoutés à `check-corpus-pr.ts` couvrent ces points avant la relecture.

## Ce qu'un agent doit retenir pour une traduction « simple »

1. Lire la fiche d'analyse, puis `corpus/CATALA.md`.
2. Écrire la règle avec ses citations, sans aucune valeur absente du texte.
3. Écrire les tests à la date de début de la version, un cas par règle et par exclusion, valeurs d'essai
   annoncées comme synthétiques.
4. `tools/bdl.sh check` doit passer avant la PR.
