# Lot de traduction n° 2 (27/11/2026) : retour d'expérience

Cinq tâches `translate` prises au guichet de production (famille `anthropic`, modèle `claude-opus-5-5`)
avec les outils issus du [lot n° 1](traduction-lot-01.md) : CGI 33 bis, 33 quater, 33 quinquies, 36 et
37. Une PR groupée : [#21](https://github.com/theonaciri/bugdeloi/pull/21).

## Chronologie

| Heure (UTC) | Étape                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------- |
| 07:10:35    | `tools/bdl.sh next 5` : cinq baux, cinq squelettes (titre et texte officiel déjà écrits) |
| 07:10–07:13 | lecture des fiches, puis des modules `Date` et `Période` de la bibliothèque standard     |
| 07:14:41    | cinq fichiers écrits ; `tools/bdl.sh check` vert sur quatre                              |
| 07:14:50    | CGI 36 corrigé (mot réservé), vert                                                       |
| 07:14:59    | `tools/bdl.sh submit-batch` : un commit, la PR, cinq baux rendus avec `submitted`        |
| 07:15:38    | CI : **ACCEPTED (N2 Compilé)**                                                           |

Environ cinq minutes de la réservation à la PR, contre une heure pour le lot n° 1 : la réservation
groupée, les squelettes, `corpus/CATALA.md` et la politique de tests écrite ont supprimé les allers-retours.

## Ce qui a ralenti

1. **Bibliothèque standard introuvable.** CGI 36 compare la période du dernier bilan à l'année civile.
   L'aide-mémoire `syntax_fr.catala_fr` ne liste pas les fonctions `Date.…` ni `Période.…` ; il a fallu
   lire `date_fr.catala_fr` et `period_fr.catala_fr` dans l'image. On y apprend que la structure
   `Période.Période` et `Période.depuis_année` existent. → Tableau des modules et lien vers
   `stdlib/` (tag 1.3.2) dans `corpus/CATALA.md`, `tools/bdl.sh doc` et join.txt.
2. **Mot réservé comme nom de champ.** `donnée résultat contenu argent` échoue sur « Syntax error at
   "résultat": expected the name of this struct data. Those are valid at this point: "somme" ». Le message
   n'indique pas que `résultat` est un mot-clé. → Liste des mots réservés tentants et lien vers le lexer
   dans `corpus/CATALA.md` ; `scripts/check-corpus-pr.ts` (donc `tools/bdl.sh check` et la CI) refuse
   désormais un mot réservé employé comme nom d'entrée, de sortie ou de champ, avec un message clair.
3. **Types décrits en mots dans les fiches anciennes.** « période et résultat » (36), « couple de
   montants optionnel » (33 quater), « liste de résultats » (37) : le traducteur choisit le type Catala,
   et la relecture ne peut pas le comparer à une interface typée. Ces fiches précèdent la règle qui exige
   des types Catala. Les choix retenus : `PeriodeBeneficeImposable36Bilan` avec un champ
   `Période.Période`, `optionnel de MontantsFonciersHorsTvaMontants`, `liste de argent`.
4. **Égalité des structures non documentée.** Rien n'indiquait que `=` compare deux structures, ni une
   structure optionnelle. Elle fonctionne en 1.3.2. → `corpus/CATALA.md`.

## Commentaires CodeRabbit (1 fil)

- **CGI 36, cas « année civile ».** Le bénéfice annuel et le résultat du bilan valaient tous deux
  18 000 € : l'assertion passait quelle que soit la branche. Corrigé dans dd60408 (17 500 € pour le
  bilan). Règle ajoutée à `corpus/CATALA.md` et `.coderabbit.yaml` : quand la règle choisit entre
  plusieurs entrées, elles ont des valeurs différentes dans chaque cas.

Second tour (1 fil, refusé) : CodeRabbit affirmait que `Période` devait être déclaré par `> Usage de` et que
CGI 36 ne compilait pas. Faux : c'est un module de la bibliothèque standard, et le fichier compile dans
l'image épinglée (CI verte). `.coderabbit.yaml` nomme maintenant les modules de la bibliothèque standard et
renvoie au contrôle `corpus-check` pour tout doute de compilation.

Aucun commentaire sur le texte cité, les interfaces, les types choisis ni les règles elles-mêmes.

## Choix d'interprétation à relire

- **CGI 36** : « l'année civile » est lue comme l'année d'imposition ; la durée de douze mois n'est pas
  contrôlée par le champ d'application (un exercice d'une autre durée relève de l'article 37, dit dans la
  prose du fichier).
- **CGI 37** : la déduction de la troisième phrase ne s'applique qu'aux années où un bilan est dressé ;
  sans bilan, le bénéfice jusqu'au 31 décembre est retenu tel quel.
- **CGI 33 quater** : pour une personne non redevable de la TVA sur ses loyers, la sortie est absente
  (l'article ne la vise pas), et non égale aux montants fournis.

## Optimisations possibles (non faites)

- Une seconde version typée (`Nom@v2`) des fiches qui décrivent leurs types en mots, par une tâche
  d'analyse dédiée ; elle rendrait le choix du traducteur contrôlable.
