# Interface Allocations familiales v1

[Déclarations Catala](interface.catala_fr) · [Textes LEGI](articles.json)

La date du droit sélectionne les versions historiques. Les bornes des versions LEGI sont inclusives
au début et exclusives à la fin. Le stock représente une fin ouverte par `2999-01-01`. Appliquez les
versions couvertes par la période du paquet et signalez les éventuelles lacunes.

## CalculMensuel

- `jour_de_droit`, `territoire_du_foyer` et `revenu_annuel_de_référence` décrivent le mois considéré, le
  régime territorial et les ressources annuelles déjà déterminées en euros pour le foyer.
- `personnes_à_charge` décrit les enfants à examiner, chacun avec un identifiant distinct, sa date de
  naissance, sa rémunération mensuelle, l’appréciation de sa charge, son droit antérieur aux allocations
  familiales et l’existence d’une aide personnelle au logement à son propre titre.
- `appréciation_parent_en_charge` et `appréciation_conditions_générales` décrivent la qualité du parent
  et l’appréciation des autres conditions générales d’ouverture du droit. L’appelant renseigne les
  deux booléens explicitement. La qualité de parent ne détermine pas la valeur du second.
  L’information sur la charge antérieure vise le régime transitoire de Mayotte décrit dans le décret
  du 29 mars 2002 et son annexe.
- `allocation_mensuelle` donne le total en euros pour le foyer, y compris les majorations, l’allocation
  forfaitaire et les compléments applicables.

## OuverturePourEnfant

Ce champ d’application donne le droit individuel d’un enfant aux prestations familiales pour une
situation, une date et un territoire donnés. Pour cet appel, le statut au regard de l’obligation
scolaire est fourni. Dans le calcul du ménage, déterminez ce statut à partir des textes fournis.

## Paramètres monétaires apportés par l’appelant

Les sources ci-dessous documentent les paramètres du harnais. Leur montant applicable est transmis à
l’exécution. Les taux et autres conditions à traduire viennent des textes LEGI du paquet.

| Entrée                                                                                          | Unité et provenance                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base_mensuelle_de_calcul`                                                                      | BMAF en euros par mois, selon la date. CSS L551-1 et instructions de revalorisation [2019](https://www.legifrance.gouv.fr/circulaire/id/44472), [2020](https://sante.gouv.fr/fichiers/bo/2020/20-02/ste_20200002_0000_0046.pdf), [2021](https://sante.gouv.fr/fichiers/bo/2021/2021.5.sante.pdf) et [2022](https://info.agriculture.gouv.fr/boagri/instruction-2022-317/telechargement).                                                                                                 |
| `premier_plafond_hors_enfants`, `second_plafond_hors_enfants`, `majoration_plafonds_par_enfant` | Montants annuels en euros, revalorisés au titre de D521-3. Arrêtés [2019](https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000037864990), [2020](https://www.legifrance.gouv.fr/loda/id/JORFTEXT000039663220), [2021](https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000042694985) et [2022](https://www.legifrance.gouv.fr/jorf/id/JORFARTI000044572370).                                                                                                                 |
| `minimum_horaire_brut`, `salaire_minimum_horaire`                                               | Smic brut en euros par heure, à la date et dans le territoire du calcul. Décrets [2019](https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000037833214), [2020](https://www.legifrance.gouv.fr/eli/decret/2019/12/18/MTRX1933646D/jo/texte), [2021](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000042677359) et arrêtés [octobre 2021](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000044126026) et [mai 2022](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000045602317). |
