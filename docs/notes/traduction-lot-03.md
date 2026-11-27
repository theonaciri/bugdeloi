# Lot de traduction n° 3 (27/11/2026) : retour d'expérience

Cinq tâches `translate` (famille `anthropic`, modèle `claude-opus-5-5`) : CGI 38 quater, 39 AA,
39 AA quinquies, 39 B, 39 D. Une PR groupée : [#22](https://github.com/theonaciri/bugdeloi/pull/22).
Articles plus denses que ceux du [lot n° 2](traduction-lot-02.md) : un échéancier sur cinq ans, deux
barèmes de coefficients, des fenêtres de dates.

## Chronologie

| Heure (UTC) | Étape                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------ |
| 07:31:19    | `tools/bdl.sh next 5` : cinq baux et cinq squelettes                                             |
| 07:31–07:34 | lecture des fiches ; ponctuation de « 2, 2, 5 et 3 » vérifiée dans les versions LEGI antérieures |
| 07:36:41    | cinq fichiers écrits, `tools/bdl.sh check` vert sur les cinq du premier coup                     |
| 07:36:50    | contre-épreuve : une assertion faussée fait bien échouer `clerk test`                            |
| 07:37:04    | `tools/bdl.sh submit-batch` : un commit, la PR, cinq baux rendus                                 |

Six minutes de la réservation à la PR. Aucune erreur de compilation : les pièges des lots 1 et 2
(précédence, mots réservés, bibliothèque standard) sont documentés.

## Ce qui a ralenti

1. **Demande de confirmation sans destinataire.** Les fiches de 39 AA et 39 AA quinquies disent « faire
   confirmer la ponctuation décimale avant traduction ». Personne ne reçoit cette demande, et la tâche ne
   donnait aucun moyen de trancher. La base LEGI le permet : les quatre versions antérieures de 39 AA
   écrivent « 2, 2,5 et 3 ». Un contributeur sans base n'y avait pas accès. → La tâche liste maintenant
   les autres versions de l'article (`context_pack.other_versions`, avec dates et liens) ; join.txt
   demande aux analystes de trancher eux-mêmes avec ces versions ; `corpus/CATALA.md` a une section
   « Texte douteux ».
2. **Types en mots, encore.** « couple optionnel : identifiant de l'exercice et montant cumulé », « liste
   de triplets », « booléen si hors dirigeant », « durée par élément » : quatre fiches sur cinq laissent
   des choix de type au traducteur (38 quater surtout). C'est la friction la plus fréquente sur trois
   lots. La règle des types Catala ne vaut que pour les nouvelles fiches.
3. **Choix d'interprétation recopiés à la main dans la PR.** → `tools/bdl.sh submit` et `submit-batch`
   ajoutent à la description une section « Choix d'interprétation à relire » qui reprend chaque
   `# TODO juridique` avec son fichier et sa ligne.
4. **Pas de contrôle après le dépôt.** Une fois le bail rendu, `tools/bdl.sh check <id>` répond « Aucun
   bail local » : impossible de recontrôler une correction demandée par la relecture (lot n° 2). →
   `tools/bdl.sh check <fichier.catala_fr>…` contrôle sans bail.

## Commentaires CodeRabbit (6 fils, corrigés dans 17e6472)

- **Citations trop loin des constantes (3 fils).** Les citations groupées au-dessus d'une définition
  laissaient des constantes à plus de trois lignes de leur citation (AGENTS.md §8). Un programme peut le
  voir : → `scripts/check-corpus-pr.ts` refuse désormais une constante de la règle sans citation dans les
  trois lignes au-dessus, et donne sa ligne. Sur la version déposée, il signale les 12 lignes relevées par
  CodeRabbit ; le reste du corpus passe. `corpus/CATALA.md` montre la citation placée avant chaque branche.
- **Cumul incohérent avec l'échéancier (38 quater).** Un cumul déjà imposé qui ne correspond pas aux parts
  conservées comptait deux fois une partie du profit. → Assertion « Cohérence des entrées » ; motif
  documenté dans `corpus/CATALA.md`.
- **Commentaire contraire au code (39 AA quinquies, et 39 AA).** Le commentaire rangeait « six ans et demi »
  dans la tranche précédente alors que le code, conforme au texte, la traite comme « supérieure à six
  ans ». Corrigé.
- **Borne de fenêtre non testée (39 AA).** Rien ne testait un bien acquis juste après le 1er janvier 2003.
  → Règle ajoutée : chaque borne d'une fenêtre de dates a son cas juste au-delà, des deux côtés.

Second tour (1 fil, corrigé dans 866e14a) : cinq parts arrondies au centime ne faisaient plus le profit
(50 000,03 € → 50 000,05 €), ce qui rendait contradictoires l'assertion de borne et celle de cohérence.
La cinquième part reçoit maintenant le reliquat. Troisième tour (c30bb0b) : pour 0,03 €, l'arrondi au plus
proche rendait la cinquième part négative ; les quatre premières sont désormais tronquées au centime.
Motif « parts égales » ajouté à `corpus/CATALA.md`. Trois tours pour un arrondi : le motif aurait dû être
écrit avant la traduction.

## Choix d'interprétation à relire

Recopiés dans la PR : lecture des coefficients de 39 AA (2 ; 2,5 ; 3) et de 39 AA quinquies
(1,5 ; 2 ; 2,5), fenêtre 2001–2003 de 39 AA bornes comprises, durées non entières rangées dans la tranche
qui commence avant elles, arrondi au centime des parts de 38 quater (reliquat sur la cinquième), sort des primes non déduites à la
cession, appel de 39 D par élément.

## Optimisation à décider

Une campagne d'analyses `@v2` pour retyper en Catala les interfaces décrites en mots, avant d'ouvrir
leurs traductions. Elle changerait les interfaces figées : décision humaine (AGENTS.md §10).
