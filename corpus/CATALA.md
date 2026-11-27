# Catala 1.3.2 pour les traductions du corpus

Ce guide rassemble la syntaxe française dont une traduction a besoin et les pièges rencontrés sur les
premiers lots. Chaque exemple vient d’un fichier du corpus ; aucun code de l’Inria ou de la DGFiP n’est
recopié.

## Documentation officielle

Le corpus compile avec **Catala 1.3.2** : préfère toujours la documentation de cette version.

| Besoin                                                                                                                       | Lien                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Toute la syntaxe française, version 1.3.2 (types, opérateurs, structures, énumérations, champs d’application, listes, tests) | <https://github.com/CatalaLang/catala/blob/1.3.2/doc/syntax/syntax_fr.catala_fr> |
| Même aide-mémoire en PDF, français et anglais (branche principale, peut devancer 1.3.2)                                      | <https://assets.catala-lang.org/syntax.pdf>                                      |
| Tutoriel : premiers champs d’application                                                                                     | <https://book.catala-lang.org/en/2-0-tutorial.html>                              |
| Conditions et exceptions (logique par défaut)                                                                                | <https://book.catala-lang.org/en/2-2-conditionals-exceptions.html>               |
| Listes et champs d’application imbriqués                                                                                     | <https://book.catala-lang.org/en/2-3-list-scopes.html>                           |
| Guide de référence du langage                                                                                                | <https://book.catala-lang.org/en/5-catala.html>                                  |
| Bibliothèque standard 1.3.2 : fonctions de dates (`Date.…`), de périodes (`Période.…`), de listes et de montants             | <https://github.com/CatalaLang/catala/tree/1.3.2/stdlib>                         |
| Programmes de l’Inria (lecture de la syntaxe en situation ; jamais recopiés)                                                 | <https://github.com/CatalaLang/catala-examples>                                  |

Le livre est en anglais et écrit ses exemples en Catala anglais : les mots-clés français
correspondants sont dans l’aide-mémoire `syntax_fr.catala_fr`. `tools/bdl.sh doc` affiche ces liens.

L’aide-mémoire montre aussi l’arrondi explicite (`arrondi de 9,99€`) et les opérateurs typés (`+€`,
`+^`), absents de ce guide. Il ne liste pas les fonctions de la bibliothèque standard : elles sont
documentées dans les fichiers `stdlib/*_fr.catala_fr` du dépôt Catala, et l’image épinglée les contient
dans `/opt/opam/4.14.2/lib/catala/runtime/`. Elles sont disponibles sans `> Usage de`.

| Module    | Fichier                                                                                             | Fonctions utiles                                                                                                       |
| --------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `Date`    | [`date_fr.catala_fr`](https://github.com/CatalaLang/catala/blob/1.3.2/stdlib/date_fr.catala_fr)     | `accès_année`, `accès_mois`, `depuis_année_mois_jour de 2025, 1, 1`, `premier_jour_de_l_année`, `dernier_jour_du_mois` |
| `Période` | [`period_fr.catala_fr`](https://github.com/CatalaLang/catala/blob/1.3.2/stdlib/period_fr.catala_fr) | structure `Période.Période` (`début`, `fin` incluse), `depuis_année de 2025`, `durée`, `est_contenue`, `chevauche`     |
| `Liste`   | [`list_fr.catala_fr`](https://github.com/CatalaLang/catala/blob/1.3.2/stdlib/list_fr.catala_fr)     | accès par position, tri, concaténation                                                                                 |
| `Argent`  | [`money_fr.catala_fr`](https://github.com/CatalaLang/catala/blob/1.3.2/stdlib/money_fr.catala_fr)   | `somme`, arrondis au centime ou à l’euro, plafonds et planchers                                                        |

## Plan d’un fichier

````text
#### Article <numéro>|<LEGIARTI>

<texte officiel, recopié tel quel depuis task.legal_units[0].text>

Interface `<Nom>@v1`. Version applicable à compter du <date_debut>, sans date de fin connue.

<une ou deux phrases sur ce que l’appelant fournit et ce que la sortie signifie>

```catala
… déclarations, champ d’application, tests …
```
````

Le titre et le texte sont écrits par `tools/bdl.sh next`. Le texte reste identique au caractère près :
`tools/bdl.sh check` le compare à la citation de la fiche d’analyse, et `promote-corpus` à LEGI.

## Texte douteux

LEGI consolide parfois mal un nombre : la version de 2002 de l’article 39 AA écrit « 2, 2, 5 et 3 » là où
les quatre versions antérieures écrivent « 2, 2,5 et 3 ». Compare alors le texte aux autres versions de
l’article, que la tâche liste dans `context_pack.other_versions` (et la page
`/article/<LEGIARTI>` du site) : une version antérieure est une source LEGI citable. Écris la lecture
retenue et sa justification dans la prose du fichier, puis un `# TODO juridique` au-dessus de la règle.

## Dates de validité

`task.legal_units[0].date_debut` borne la version : `assertion date_d_application >= |AAAA-MM-JJ|`. Une
`date_fin` égale à `2999-01-01` est la convention DILA pour « sans date de fin connue » : n’écris alors
aucune assertion de fin. Une vraie date de fin donne `assertion date_d_application < |AAAA-MM-JJ|`.

## Types

| Besoin                  | Catala                                                      | Exemple dans le corpus |
| ----------------------- | ----------------------------------------------------------- | ---------------------- |
| Montant                 | `argent`, littéral `1 000 €`                                | CGI 28                 |
| Taux ou proportion      | `décimal`, littéral `0,25` ou `20%`                         | CGI 8 bis, CGI 278     |
| Année, compte, code     | `entier`                                                    | CGI 11, CGI 12         |
| Date                    | `date`, littéral `                                          | 2026-01-01             | `   | tous |
| Oui ou non              | `booléen`, `vrai`, `faux`                                   | CGI 4 bis              |
| Valeur qui peut manquer | `optionnel de argent`, `Présent contenu 10 €`, `Absent`     | CGI 8 bis, 29, 30      |
| Liste                   | `liste de argent`, littéral `[2 000 €; 1 500 €]`            | CGI 28                 |
| Enregistrement          | `déclaration structure Nom:` puis `donnée x contenu argent` | CGI 4 A, 12            |
| Choix fermé             | `déclaration énumération Nom:` puis `-- Cas`                | CGI 14                 |

Une période (exercice, année civile) se déclare avec la structure de la bibliothèque,
`donnée période contenu Période.Période`, et se compare en entier :
`dernier_bilan.période = Période.depuis_année de année_d_imposition` (CGI 36). L’égalité `=` vaut aussi
pour une structure du corpus, optionnelle ou non (CGI 33 quater).

Catala n’a pas de type texte : un lieu, un identifiant ou un code est un `entier` (CGI 11) ou une
énumération quand la liste des valeurs est fermée. Préfixe chaque structure et chaque énumération par le
nom de l’interface (`AssietteTerritorialeIrRevenu`) : les noms sont uniques dans tout le corpus.

## Expressions utiles

```catala
# Filtrer une liste (CGI 4 A)
liste de revenu parmi revenus tel que revenu.source_française

# Transformer chaque élément (CGI 12)
transforme chaque élément parmi éléments en élément.montant

# Existence (CGI 4 bis)
existe attribuée parmi attributions tel que attribuée

# Somme et nombre (CGI 28, CGI 4 A)
Argent.somme de charges
nombre de revenus_retenus

# Valeur optionnelle (CGI 30)
selon loyer_par_comparaison sous forme
-- Présent contenu loyer : loyer
-- Absent : loyer_direct

# Énumération avec cas par défaut (CGI 14)
selon catégorie sous forme
-- AutreBien : faux
-- n'importe quel : vrai
```

**Précédence** : `Argent.somme de` et `transforme … en` s’étendent jusqu’à la fin de l’expression. Mets des
parenthèses avant une comparaison, sinon Catala compare à l’intérieur :
`(Argent.somme de (transforme chaque r parmi l en r.montant)) = 1 000 €`.

**Mots réservés** : un nom de champ, d’entrée ou de cas ne peut pas être un mot-clé. Les plus
tentants sont `résultat`, `entrée`, `interne`, `contexte`, `donnée`, `condition`, `conséquence`, `état`,
`étiquette`, `exception`, `type`, `règle`, `structure`, `somme`, `contenu`, `date`, `durée`, `argent`,
`entier`, `an`, `mois`, `jour`, `minimum`, `maximum`. L’erreur est obscure (« Syntax error at "résultat":
expected the name of this struct data. Those are valid at this point: "somme" ») : préfère
`résultat_du_bilan`, `date_de_clôture`, `montant_de_la_somme`. `tools/bdl.sh check` refuse ces noms
avant la compilation, avec un message clair. Liste complète : les `MS_` du
[lexer français 1.3.2](https://github.com/CatalaLang/catala/blob/1.3.2/compiler/surface/lexer_fr.cppo.ml).

**Arrondi** : le produit d’un `argent` par un `décimal` est arrondi au centime par Catala. Si le texte ne
fixe pas d’arrondi, écris au-dessus de la définition
`# TODO juridique : le texte ne fixe pas d’arrondi ; Catala arrondit au centime…`, pour qu’un relecteur
le voie (AGENTS.md §7). L’écart possible reste alors sous 1 € : ce n’est pas un finding `ARRONDI`, qui
suppose deux placements d’arrondi distants de plus de 1 € (AGENTS.md §4.4).

**Parts égales** : un montant réparti en N parts arrondies au plus proche ne fait plus le total (50 000,03 €
en cinq parts de 10 000,01 € font 50 000,05 €), et la dernière part peut devenir négative (0,03 €).
Arrondis les N − 1 premières parts au centime inférieur, en centimes :
`(Argent.arrondi_par_défaut de ((profit * 100,0) / 5,0)) * 0,01`, puis donne le reliquat à la dernière,
`si rang = 4 alors profit - part * 4,0 sinon part`. La somme égale le montant, aucune part n’est négative,
et un `# TODO juridique` expose ce choix (CGI 38 quater). Teste un montant dont le reliquat n’est pas nul
et un montant de quelques centimes.

## Citations et tests

Chaque constante de la règle (montant, taux, seuil, durée, date, rang) est précédée dans les trois
lignes au-dessus d’un commentaire qui cite l’article et l’alinéa qui la fixent : `# CGI, article 28 : …`.
`tools/bdl.sh check` refuse une constante sans citation et donne sa ligne. Dans une expression longue
(barème, fenêtre de dates), un commentaire se place entre deux lignes, juste avant la branche :

```catala
  définition coefficient_spécial égal à
    si non dans_le_champ alors Absent
    # CGI, article 39 AA, premier alinéa : 2 pour une durée de trois ou quatre ans.
    sinon si durée_normale < 5 an alors Présent contenu 2,0
    # CGI, article 39 AA, premier alinéa : 2,5 pour une durée de cinq ou six ans.
    sinon si durée_normale <= 6 an alors Présent contenu 2,5
```

Quand deux entrées de l’interface doivent concorder (un cumul et l’échéancier dont il découle), une
`assertion` le vérifie dans le champ d’application, avec un commentaire « Cohérence des entrées » (CGI 38
quater).

Les tests suivent une autre règle, parce que la plupart des articles ne donnent aucun exemple chiffré :

- `date_d_application` vaut le début de validité de la version, ce qui teste aussi la borne ;
- les autres entrées sont des valeurs d’essai synthétiques, annoncées comme telles par
  `# Cas d’essai synthétique : valeurs choisies pour le test, absentes du texte ; <calcul attendu>` ;
  ne les attribue jamais à l’article ;
- le résultat attendu se calcule à la main par la règle de l’article ;
- il y a un cas où l’article s’applique, puis un cas par condition booléenne de la règle, chacune mise
  seule à la valeur qui écarte l’article (même la plus évidente, comme « membre ») ;
- chaque valeur d’une énumération a son cas (CGI 14 en a neuf) ;
- chaque borne d’une fenêtre de dates a son cas juste au-delà, des deux côtés (CGI 39 AA : 1976, 1995 et
  2003-01-02 autour des fenêtres 1977–1990 et 2001–2003) ;
- quand la règle choisit entre plusieurs entrées, elles ont des valeurs différentes dans chaque cas : avec
  deux montants égaux, l’assertion passe quelle que soit la branche (CGI 36) ;
- Catala 1.3.2 n’a pas de test d’échec attendu : une date antérieure à la version ne se teste pas, puisque
  son assertion ferait échouer toute la suite.

Un test compare des nombres, des booléens ou des valeurs optionnelles ; pour une liste, compare
`nombre de …` et `Argent.somme de …`.

```catala
#[test]
déclaration champ d'application TestRevenuNetFoncier:
  bénéficiaire champ d'application RevenuNetFoncier

champ d'application TestRevenuNetFoncier:
  # LEGIARTI000006302228, date de début de la version : le cas s'applique dès le premier jour.
  définition bénéficiaire.date_d_application égal à |1950-04-30|
  # Cas d'essai synthétique : valeurs choisies pour le test, absentes du texte ; 12 000 € − 3 500 € = 8 500 €.
  définition bénéficiaire.revenu_brut égal à 12 000 €
  définition bénéficiaire.charges_de_la_propriété égal à [2 000 €; 1 500 €]
  assertion bénéficiaire.revenu_net_foncier = 8 500 €
```

## Contrôler

`tools/bdl.sh check <id>` (ou `tools/bdl.sh check <fichier.catala_fr>…` sans bail, pour corriger un
fichier déjà déposé) lance `scripts/check-corpus-pr.ts` (en-têtes, doublons, texte et nom du champ
d’application comparés à la fiche d’analyse) puis `clerk test` dans le conteneur Catala épinglé. Une
erreur « Incompatible types: got bool, expected money » vient presque toujours d’une parenthèse manquante.
