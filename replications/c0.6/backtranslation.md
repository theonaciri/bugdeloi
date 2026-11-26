# Rétro-traduction française du noyau Impôt sur le revenu 2026

> **Statut de preuve :** paraphrase fidèle du programme `corpus/cgi/livre1/partie1/titre1/chapitre1/section5/noyau_ir.catala_fr` (modèle : `google / gemini-4-neon`). Conformément à `AGENTS.md §4.1`, cette rétro-traduction doit être comparée au texte officiel par un juge d’une autre famille de modèles (ou un juriste) avant de compter pour le niveau N4.

## 1. Arrondi du revenu imposable et principe de calcul (art. 193)

- Le revenu net imposable déclaré en entrée est arrondi à l’euro le plus proche (0,50 € arrondi à l’euro supérieur).
- Ce revenu arrondi est divisé par le nombre de parts fiscales du foyer.
- Le barème progressif est appliqué au revenu d’une part, puis le résultat est multiplié par le nombre de parts pour obtenir l’impôt brut avant plafonnement.
- **Hors périmètre déclaré :** rattachement de l’article 196 B, réductions et crédits d’impôt (art. 199 quater F à 200 undecies).

## 2. Nombre de parts fiscales (art. 194)

- **Parts de base :** 2 parts pour un foyer en imposition commune (marié ou pacsé) ; 1 part pour une personne célibataire, divorcée ou veuve.
- **Majoration pour enfants à charge exclusive ou principale :** 0,5 part pour chacun des deux premiers enfants, puis 1 part entière par enfant à compter du troisième.
- **Parent isolé vivant seul (art. 194 II) :** majoration supplémentaire de 0,5 part si le contribuable est célibataire ou divorcé, remplit l’entrée explicite `appréciation_vit_seul` et a au moins un enfant à charge.
- **Veuf avec enfants à charge :** majoration supplémentaire de 1 part s’il est veuf et a au moins un enfant à charge.
- **Hors périmètre déclaré :** garde alternée (quarts de part) et personnes rattachées au titre de l’article 196 A bis.

## 3. Barème progressif 2026 (art. 197 I.1)

Sur le revenu correspondant à une part :

- 0 % jusqu’à 11 600 € ;
- 11 % sur la part comprise entre 11 600 € et 29 579 € ;
- 30 % sur la part comprise entre 29 579 € et 84 577 € ;
- 41 % sur la part comprise entre 84 577 € et 181 917 € ;
- 45 % sur la part qui dépasse 181 917 €.

## 4. Plafonnement du quotient familial (art. 197 I.2)

- Le programme recalcule l’impôt que paierait le foyer avec ses seules parts de référence (1 part pour une personne seule, 2 parts pour un couple).
- L’avantage maximal accordé par les demi-parts supplémentaires est limité à :
  - **1 807 €** par demi-part supplémentaire dans le cas général ;
  - **4 262 €** pour la première part entière d’un parent isolé vivant seul, plus 1 807 € par demi-part au-delà ;
  - **+ 2 011 €** de réduction complémentaire pour un contribuable veuf ayant au moins un enfant à charge, lorsque son impôt est plafonné.
- L’impôt après plafonnement est le maximum entre l’impôt brut et l’impôt de référence diminué de ce plafond.
- **Hors périmètre déclaré :** demi-parts spéciales de l’article 195 (invalidité, anciens combattants, etc.).

## 5. Réfaction outre-mer (art. 197 I.3)

- **Métropole :** 0 €.
- **Guadeloupe, Martinique et La Réunion :** diminution de 30 % de l’impôt après plafonnement, plafonnée à 2 450 €.
- **Guyane et Mayotte :** diminution de 40 % de l’impôt après plafonnement, plafonnée à 4 050 €.

## 6. Décote (art. 197 I.4.a)

- Sur l’impôt obtenu après réfaction outre-mer, on calcule une décote théorique égale à :
  - `1 483 € - 45,25 % × impôt` pour une imposition commune ;
  - `897 € - 45,25 % × impôt` pour un célibataire, divorcé ou veuf.
- Si ce résultat est nul ou négatif, la décote vaut 0 €. S’il dépasse l’impôt, la décote ramène l’impôt à 0 €. Sinon, elle est soustraite de l’impôt pour donner l’impôt net avant crédits.

## 7. Arrondi de la cotisation et seuil de mise en recouvrement de 61 € (art. 1657, 1 et 1 bis)

- L’impôt net avant crédits est arrondi à l’euro le plus proche (0,50 € arrondi à l’euro supérieur).
- Si cet impôt arrondi est strictement inférieur à **61 €**, l’impôt mis en recouvrement vaut **0 €**. À partir de 61 €, la totalité de l’impôt arrondi est mise en recouvrement.
- **Hors périmètre déclaré :** impôts directs locaux et seuil général de 12 € (art. 1657, 2).
