# Déclaration de remise

- Pseudo `codex-gpt-6.2-sol`
- Rôle `translate`
- Famille `openai`
- Modèle `gpt-6.2-sol`

## Sources consultées

- `AGENTS.md`, sections 1, 4 et 7, et les quatre fichiers de `replications/c0.3/task/`.
- Aide-mémoire Catala 1.3.2 pour la syntaxe française des déclarations, des listes et des dates. [Syntaxe Catala](https://assets.catala-lang.org/syntax.pdf)
- Référence des expressions pour les liaisons locales, les appels et les résultats de champs d’application. [Expressions en français](https://book.catala-lang.org/fr/5-5-expressions.html), [Expressions en anglais](https://book.catala-lang.org/en/5-5-expressions.html)
- Référence des types pour les dates, les durées et la conversion monétaire. [Types, valeurs et opérations](https://book.catala-lang.org/en/5-2-types.html)

Les 47 empreintes du paquet concordent avec le SHA-256 des textes fournis après réduction des espaces blancs. Le texte lettré reprend ces versions. Aucune implémentation, donnée d’évaluation ni source juridique extérieure au paquet n’a été consultée.

## Périmètre et dépendances

La traduction couvre la période du 26 août 2019 au 1er mai 2022 inclus. Le fichier lettré indique, pour chaque version, les alinéas codés et les dispositions hors périmètre.

- `CalculMensuel` applique le régime de droit commun en métropole et dans les collectivités visées par L751-1, la dérogation pour un seul enfant de L755-12 et le barème de Mayotte. Pour Saint-Pierre-et-Miquelon, le paquet ne contient pas de texte de rattachement territorial ni de barème. Les deux champs signalent ce cas par une erreur explicite.
- Les articles L512-1 et L512-2 couvrent des conditions de résidence, d’affiliation, de séjour et de cumul qui dépassent les entrées disponibles. Le calcul mensuel s’appuie sur les appréciations fournies. `OuverturePourEnfant` porte sur les conditions individuelles représentables, dont la scolarité, l’âge, la rémunération et l’aide au logement personnelle. Les prescriptions scolaires particulières de L131-1, alinéa 2, sont hors périmètre faute de données et de texte.
- Les articles R532-1 à R532-7, les revalorisations de L161-25, L551-1 et D521-3, et les barèmes d’avantages en nature de R512-2, alinéa 3, sont hors périmètre comme calculs en amont. Le revenu annuel, la base, les plafonds revalorisés et le Smic horaire territorial sont fournis. Le renvoi ancien de R512-2 vers le code du travail n’a pas été résolu. Le paquet annonce des renvois non résolus de L521-2 vers le code civil et l’ordonnance de 1945. Le code emploie les catégories de charge déjà appréciées.
- L511-1 et les exceptions de L512-3 propres à d’autres prestations sont hors périmètre. Pour L521-2 et R521-2, les décisions d’attribution ou de révision du statut, l’ordre subsidiaire entre parents et les situations qui ne figurent pas dans l’énumération sont hors périmètre. Le calendrier de prise d’effet prévu par le renvoi à L552-1 ne figure pas dans le paquet. Les seuils d’âge s’appliquent à la date du droit reçue.

## Points d’interprétation

- À Mayotte, l’ordonnance et le décret fournissent les taux et le maintien du montant de décembre 2011. Le booléen transmis est interprété comme l’appréciation du maintien pour le même enfant resté seul à charge. Faute de dispositions locales dans le paquet, les conditions individuelles d’âge et de rémunération sont reprises du droit commun avec le Smic fourni. Le calcul de Mayotte est limité au barème fourni, sans chiffrage local du forfait, des majorations d’âge ou du partage du versement.
- Le dépassement de ressources est calculé à partir du dernier plafond franchi. Pour la résidence alternée partagée, l’effectif entier sert aux plafonds ordinaires et le poids d’une moitié au montant dû. Le minimum d’enfants et les plafonds du forfait incluent les enfants au forfait. La pondération et la destination du forfait suivent provisoirement la catégorie de charge individuelle.
- Le complément ordinaire utilise le montant après partage de résidence, avant ventilation entre la famille et le service. Le montant de base est ventilé au prorata des charges, les majorations sont affectées aux enfants qui les déclenchent et le complément suit la part du montant due à la famille. Le paquet ne précise pas cette ventilation.
- Pour désigner l’aîné à date de naissance égale, le calcul retient le plus petit identifiant. Un anniversaire du 29 février est reporté au 1er mars en année non bissextile. Le plafond de rémunération est comparé à sa valeur exacte. Le montant total est arrondi au centime le plus proche à la conversion finale en `argent`. Les textes fournis ne règlent pas ces conventions.

## Compilation

Le contrôle rejette le pseudo demandé avec « Pseudo invalide. ». Sous le pseudo temporaire `codex-gpt-6-2-sol`, il rejette aussi `DECLARATION.md` avec « Fichier de soumission interdit ». Une copie à l’identique du seul `Calcul.catala_fr` a passé le contrôle de typage sous ce pseudo. La copie temporaire a été retirée.
