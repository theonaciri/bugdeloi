# C0.2 — Balayage mécanique du CGI, du CSS et du CCH

> **Candidats non qualifiés.** Ce document décrit ce que des détecteurs déterministes (sans modèle de
> langage) signalent dans les articles en vigueur. Aucun candidat n'est qualifié : seuls un rejeu par la CI
> et un verdict humain feraient entrer un résultat dans un compteur public (AGENTS.md §4.4).

Balayage n° 5 · 2026-11-25.

## Périmètre et données

| Code | Versions en vigueur contrôlées | Date de projection | Dernier lot DILA appliqué     | SHA-256 du lot      |
| ---- | ------------------------------ | ------------------ | ----------------------------- | ------------------- |
| CCH  | 4 126                          | 2026-11-25         | `LEGI_20261124-221545.tar.gz` | `48367a251f52d5db…` |
| CGI  | 2 405                          | 2026-11-25         | `LEGI_20261124-221545.tar.gz` | `48367a251f52d5db…` |
| CSS  | 7 420                          | 2026-11-25         | `LEGI_20261124-221545.tar.gz` | `48367a251f52d5db…` |

Total : 13 951 versions d'articles en vigueur. « En vigueur » suit la règle unique du dépôt
(`isInForce` de `@bugdeloi/core` ≡ `articleInForce()` de `@bugdeloi/db`) à la date de projection de chaque
code ; le balayage s'arrête si les deux règles divergent. Un article est un **groupe de versions** (composante
connexe des blocs `VERSIONS` de LEGI) : un renvoi vers une version `MODIFIE` dont l'article a une version
plus récente en vigueur n'est pas mort. Données : base LEGI de la DILA, Licence Ouverte 2.0
([notes d'ingestion](../../docs/notes/legi.md)).

## Détecteurs

| Détecteur               | Type         | Définition exacte                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ref-morte-liens@1.0.0` | REF_MORTE    | Lien LEGI `CITATION` de sens `source` (l'article porteur cite la cible) d'une version en vigueur vers un article dont **aucune** version n'est en vigueur à la date de projection et dont aucune n'est annoncée plus tard. Sous-type = état de la dernière version (`abrogé`, `transféré`, `périmé`, `disjoint`, `annulé`, `autre:<état>`). Le numéro cité doit figurer dans le texte, sinon le constat est un écart lien/texte (voir plus bas), pas un candidat.                                                                                                |
| `ref-morte-texte@1.0.0` | REF_MORTE    | Numéro écrit dans le texte (« l'article L. 521-1 du présent code », « aux articles 199 decies E à 199 decies G ») résolu par son numéro normalisé dans le code visé (présent code, CGI, CSS ou CCH nommés, ou même code sans désignation) ; l'article n'a aucune version en vigueur. Écartés : autre norme (loi, décret, directive, annexe, sigle, « du même code », « précité »), numéro sans préfixe L/R/D dans le CSS et le CCH, numéro à préfixe sans désignation dans le CGI, « article 1er » sans désignation. Un numéro absent de la base n'est pas jugé. |
| `numerotation@1.0.0`    | NUMEROTATION | Deux versions en vigueur de **lignées différentes** portant le même numéro normalisé dans le même code ; deux marqueurs de subdivision identiques à la suite (« …, 2°, 3°, 3° »), même niveau, sans niveau supérieur intercalé, en milieu de suite croissante, articles dont le numéro commence par « Annexe » exclus. Pas de recherche de « trous ».                                                                                                                                                                                                            |
| `syntaxe@1.0.0`         | SYNTAXE      | Parenthèse, crochet ou guillemet français non apparié sur l'article entier ; citation à guillemets droits laissée ouverte. Exclusions : énumérations « a) », « 1) », « i) », « 1°) », « a bis) » ; « ou " en tête d'alinéa qui poursuit une citation déjà ouverte (citation sur plusieurs alinéas) ; articles d'annexes.                                                                                                                                                                                                                                         |

Chaque candidat est un enregistrement `finding` de statut `candidate`, dédoublonné par empreinte (la
version du détecteur n'en fait pas partie), avec un certificat JSON : identifiants et dates des versions
source et cible, état de la cible, extrait exact et position (dans le texte normalisé), lien LEGI brut,
lot DILA et son SHA-256, URL Légifrance, et des **indices** (`hints`) qui signalent sans les écarter les cas
probablement légitimes (« dans sa rédaction antérieure », « en vigueur avant le », dispositions transitoires,
mention d'abrogation).

## Résultats

| Type / sous-type                      | Candidats |
| ------------------------------------- | --------- |
| NUMEROTATION / subdivision_dupliquee  | 2         |
| REF_MORTE / abrogé                    | 932       |
| REF_MORTE / annulé                    | 2         |
| REF_MORTE / autre:MODIFIE             | 2         |
| REF_MORTE / périmé                    | 14        |
| REF_MORTE / transféré                 | 167       |
| SYNTAXE / guillemet_droit_non_apparie | 7         |
| SYNTAXE / parenthese_non_fermee       | 1         |
| SYNTAXE / parenthese_non_ouverte      | 1         |

Total par type : NUMEROTATION 2 · REF_MORTE 1 117 · SYNTAXE 9.

Par détecteur : `numerotation@1.0.0` 2 · `ref-morte-liens@1.0.0` 449 · `ref-morte-texte@1.0.0` 668 · `syntaxe@1.0.0` 9.

- NUMEROTATION : aucun numéro d'article dupliqué entre deux articles distincts en vigueur (0).
  1 cas où **deux versions d'un même article** sont en vigueur à la fois (CSS R611-2 : la version
  `MODIFIE` du 2018-01-01 garde une fin ouverte alors que celle du 2023-01-01 est entrée en vigueur) : anomalie de dates DILA,
  notée mais pas candidate.
- Recoupement : sur 668 candidats textuels, 443 désignent le même couple
  (version citante, article cité) qu'un candidat par lien ; 417 ont un lien LEGI vers la cible morte.

## Couverture

**Liens LEGI.** 27 581 liens `CITATION` sortants des versions en vigueur ; 20 008 (72,5 %) sont résolubles
dans les trois codes ingérés et donc jugés. Le reste n'est pas jugé :

| Classe du lien                                       | Liens  | Part    |
| ---------------------------------------------------- | ------ | ------- |
| résolu, article en vigueur                           | 18 968 | 68,8 %  |
| cible hors des trois codes (autre code, loi, décret) | 6 105  | 22,1 %  |
| cible = texte entier ou section                      | 1 346  | 4,9 %   |
| résolu, **aucune version en vigueur**                | 1 038  | 3,8 %   |
| lien sans identifiant de cible                       | 109    | 0,4 %   |
| code ingéré mais numéro inconnu de la base           | 13     | < 0,1 % |
| résolu, entrée en vigueur annoncée                   | 2      | < 0,1 % |

Rattachement des liens résolus : version connue 16 835 · numéro et code du lien (la version citée n’est pas dans le stock) 3 160 · identifiant listé par un bloc VERSIONS 13.

**Citations textuelles.** 47 228 numéros d'articles extraits du texte (occurrences) ; 11 345 écartés
parce que la norme visée est une autre (loi, décret, autre code…) et 436 par la règle des préfixes L/R/D. Les autres sont regroupés en
28 115 couples (article citant, numéro cité) : 27 718 se résolvent dans la base
(27 049 vers un article en vigueur, 668 vers un article sans version en vigueur, 1 à venir) et
397 portent un numéro absent de la base (non jugés). **Taux de couverture** : 35 012 occurrences jugées
sur 47 228 extraites (74,1 %).

## Écarts entre lien LEGI et texte

589 liens LEGI mènent à un article sans version en vigueur **alors que le texte actuel de la version
citante ne contient pas ce numéro** (liens hérités d'une rédaction antérieure, ou lien rattaché à la mauvaise
cible). Ce n'est pas une anomalie du texte : ils ne sont pas des candidats mais une information pour la DILA.
Liste complète : [`ecarts-lien-texte.json`](ecarts-lien-texte.json). L'inverse (numéro cité dans le texte sans lien LEGI
correspondant) est visible dans le certificat des candidats textuels (`legi_link_to_target`).

## Échantillon de triage — **tri par LLM, non probant**

Tirage de 30 candidats, graine `20261125`, strates fixées (liens 8, texte 12, numérotation 2, syntaxe 8) :
`bun replications/c0.2/triage-input.ts`. Chaque candidat a été classé par un modèle (Claude Sonnet 5.5) à partir du
certificat et de l'extrait, **sans consulter Légifrance**. C'est un tri par LLM, non probant (AGENTS.md §4.2) :
il sert à prioriser la qualification humaine et à corriger les détecteurs, rien d'autre. Un échantillon de 30 ne
donne qu'un ordre de grandeur (l'intervalle d'incertitude d'une proportion estimée sur 12 cas dépasse ±25 points).

| Strate       | Tiré | Probablement réel | Probablement légitime | Faux positif du détecteur |
| ------------ | ---- | ----------------- | --------------------- | ------------------------- |
| liens        | 8    | 8                 | 0                     | 0                         |
| texte        | 12   | 11                | 1                     | 0                         |
| numerotation | 2    | 0                 | 2                     | 0                         |
| syntaxe      | 8    | 8                 | 0                     | 0                         |

« Probablement réel » signifie seulement que l'anomalie décrite par le candidat existe dans les données et ne
s'explique pas par un indice visible ; ce n'est pas une qualification. La principale source de faux positifs
écartée en cours de route : les liens LEGI vers un article mort dont le numéro n'est pas dans le texte (désormais
une note, voir plus haut).

| #   | Identifiant   | Détecteur / sous-type                 | Classement            | Justification                                                                                                                                                          |
| --- | ------------- | ------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `F-2026-0419` | ref-morte-liens / transféré           | probablement réel     | Cible R. 331-1 transférée le 2019-09-01 (décret 2019-873) ; le texte la cite toujours, sans indice de rédaction antérieure.                                            |
| 2   | `F-2026-0287` | ref-morte-liens / abrogé              | probablement réel     | L. 111-1-1 abrogé le 2021-07-01 (ordonnance 2020-71) ; la version citante (2020) le cite sans indice.                                                                  |
| 3   | `F-2026-0386` | ref-morte-liens / transféré           | probablement réel     | L. 322-3 transféré le 2016-01-01 (loi 2015-1702) ; renvoi aux 3° et 4° de cet article resté tel quel.                                                                  |
| 4   | `F-2026-0017` | ref-morte-liens / abrogé              | probablement réel     | Plage « L. 432-5 à L. 432-10 » dont la borne L. 432-5 est abrogée depuis 2008 ; citation sans indice.                                                                  |
| 5   | `F-2026-0159` | ref-morte-liens / abrogé              | probablement réel     | Annexe-modèle citant L. 422-4-1 du code, abrogé le 2008-01-01 ; trois occurrences, aucun indice.                                                                       |
| 6   | `F-2026-0247` | ref-morte-liens / abrogé              | probablement réel     | L. 421-19 abrogé le 2021-01-01 ; renvoi aux 5° et 6° de cet article dans un article réglementaire encore en vigueur.                                                   |
| 7   | `F-2026-0036` | ref-morte-liens / abrogé              | probablement réel     | D. 811-10 abrogé le 2007-01-13 ; liste d’articles « applicables » restée inchangée, confirmée par le texte.                                                            |
| 8   | `F-2026-0448` | ref-morte-liens / transféré           | probablement réel     | Annexe type citant R. 353-16, transféré le 2019-09-01 ; pas d’indice de rédaction antérieure.                                                                          |
| 9   | `F-2026-1119` | numerotation / subdivision_dupliquee  | probablement légitime | Deux « 2. » parallèles (plan, contrat) dans des sous-sections que le détecteur ne distingue pas : structure probablement voulue.                                       |
| 10  | `F-2026-1118` | numerotation / subdivision_dupliquee  | probablement légitime | Article de modification : deux séries distinctes de « c) » (années, puis seizième alinéa) ; répétition apparente seulement.                                            |
| 11  | `F-2026-1128` | syntaxe / parenthese_non_ouverte      | probablement réel     | « l2°) » (lettre l) au lieu de « 12°) » : coquille de saisie, la parenthèse fermante n’a pas d’ouvrante.                                                               |
| 12  | `F-2026-1127` | syntaxe / parenthese_non_fermee       | probablement réel     | Parenthèse « (régime de l’imposition… » jamais fermée dans l’alinéa 1 de l’article 223.                                                                                |
| 13  | `F-2026-1123` | syntaxe / guillemet_droit_non_apparie | probablement réel     | Définition « 10° » ouverte par un guillemet droit sans fermant, alors que les définitions voisines sont fermées.                                                       |
| 14  | `F-2026-1126` | syntaxe / guillemet_droit_non_apparie | probablement réel     | Dernier alinéa cité (« Art. R. 822-24… ») précédé d’un guillemet droit jamais refermé.                                                                                 |
| 15  | `F-2026-1122` | syntaxe / guillemet_droit_non_apparie | probablement réel     | Guillemet fermant écrit avec U+02EE au lieu d’un guillemet usuel : le guillemet droit ouvert n’a pas de pendant.                                                       |
| 16  | `F-2026-1121` | syntaxe / guillemet_droit_non_apparie | probablement réel     | Guillemet ouvrant absent avant « par les autorités compétentes… » (le fermant est présent).                                                                            |
| 17  | `F-2026-1120` | syntaxe / guillemet_droit_non_apparie | probablement réel     | Citation ouverte à l’alinéa 17 (« Cet encadré… ») jamais refermée dans cet arrêté.                                                                                     |
| 18  | `F-2026-1125` | syntaxe / guillemet_droit_non_apparie | probablement réel     | Même schéma que D863-5 : dernier alinéa cité (« Art. … ») sans guillemet fermant.                                                                                      |
| 19  | `F-2026-0985` | ref-morte-texte / abrogé              | probablement réel     | Article 1791 abrogé le 2026-05-01 ; « le 1° de l’article 1791 » cité par 1791 bis sans indice de rédaction antérieure.                                                 |
| 20  | `F-2026-0778` | ref-morte-texte / abrogé              | probablement réel     | R. 111-18-2 abrogé le 2021-07-01 (recodification du livre I) ; liste citée sans indice, lien LEGI concordant.                                                          |
| 21  | `F-2026-0603` | ref-morte-texte / abrogé              | probablement réel     | R. 215-2 abrogé le 2010-04-01 ; cité par un article de 2010 sans indice.                                                                                               |
| 22  | `F-2026-0516` | ref-morte-texte / abrogé              | probablement réel     | L. 251-1 abrogé le 2001-01-01 (loi 2000-1257) et toujours cité dans la liste des recettes du fonds.                                                                    |
| 23  | `F-2026-0836` | ref-morte-texte / abrogé              | probablement réel     | Annexe-modèle de contrat citant « L. 111-1-1 du code de la construction » (2 occ.), abrogé le 2021-07-01.                                                              |
| 24  | `F-2026-0578` | ref-morte-texte / abrogé              | probablement légitime | Article d’adaptation qui cite mot pour mot un autre article (« …second alinéa de l’article R. 111-24 du présent code » sont supprimés) : citation d’un état antérieur. |
| 25  | `F-2026-1035` | ref-morte-texte / transféré           | probablement réel     | R. 442-19 transféré le 2010-01-01 ; D442-20 y renvoie encore (« premier alinéa de l’article R. 442-19 »).                                                              |
| 26  | `F-2026-1067` | ref-morte-texte / transféré           | probablement réel     | R. 331-63 transféré le 2019-09-01 ; renvoi sans indice, lien LEGI absent mais citation claire.                                                                         |
| 27  | `F-2026-0668` | ref-morte-texte / abrogé              | probablement réel     | L. 811-14 abrogé le 2006-01-01 ; « l’article L. 811-14 est applicable… » sans indice.                                                                                  |
| 28  | `F-2026-0965` | ref-morte-texte / abrogé              | probablement réel     | L. 381-4 abrogé le 2018-09-01 ; cité au titre des assurés concernés sans indice de rédaction antérieure.                                                               |
| 29  | `F-2026-1053` | ref-morte-texte / transféré           | probablement réel     | R. 242-5 transféré le 2019-10-14 ; « par dérogation au I de l’article R. 242-5 » sans indice.                                                                          |
| 30  | `F-2026-0679` | ref-morte-texte / abrogé              | probablement réel     | Annexe d’un article R. 611-21 lui-même abrogé le 2018-01-01 : annexe orpheline citant son article parent.                                                              |

## Temps d'exécution

| Étape                                                                              | Durée (ms) |
| ---------------------------------------------------------------------------------- | ---------- |
| Chargement du contexte (71 884 versions, 27 581 liens de citation sortants)        | 3 004      |
| Détecteur `ref-morte-liens@1.0.0`                                                  | 145        |
| Détecteur `ref-morte-texte@1.0.0`                                                  | 288        |
| Détecteur `numerotation@1.0.0`                                                     | 94         |
| Détecteur `syntaxe@1.0.0`                                                          | 655        |
| Balayage complet (contexte, détecteurs, insertion ou reconnaissance des candidats) | 3 819      |
| `run.ts` en entier (écriture des fichiers comprise)                                | 5 108      |

Mémoire résidente de pointe de `run.ts` : 975 Mio (aarch64, 4 cœurs partagés, lancé sous `nice`) ;
la commande `sweep run --dry-run` seule, qui ne charge qu'un contexte, a été mesurée à environ 930 Mio le 25/11/2026. La première exécution, qui insère les
candidats, est plus longue que les suivantes, qui les reconnaissent par empreinte.

## Rejouer

```sh
bun replications/c0.2/run.ts                      # balayage idempotent, régénère ce rapport et les JSON
bun packages/sweep/src/cli.ts run --dry-run       # même calcul, sans écrire en base
bun packages/sweep/src/cli.ts list --type REF_MORTE --limit 20
bun packages/sweep/src/cli.ts replay F-2026-0001  # recalcule la preuve depuis la base et la compare
```

`replay` rejoue le détecteur sur la seule version citante, retrouve l'anomalie par son empreinte et compare le
SHA-256 de la preuve ; il dit aussi si la date de projection ou le lot DILA ont changé depuis le certificat.

## Limites connues

- **Un candidat n'est pas une erreur du législateur.** Un renvoi vers un article abrogé peut être voulu
  (disposition transitoire, citation d'un état antérieur) ; les indices ne couvrent que des formules usuelles.
- **Couverture partielle** : les cibles hors du CGI, du CSS et du CCH ne sont pas jugées (voir le tableau de couverture).
  Le stock ne contient pas tout l'historique : certains liens pointent vers des versions absentes de la base ;
  elles sont rattachées par leur numéro, ce qui suppose qu'un numéro n'a pas été réutilisé entre-temps.
- **Détection textuelle prudente** : plages (« L. 1 à L. 5 ») réduites à leurs bornes ; désignation lue sur la proposition
  seule ; numéros à lettres inhabituelles ou à plusieurs niveaux non reconnus ; un numéro cité mais absent de la base n'est pas jugé.
- Les articles d'**annexes** sont lus comme les autres pour les renvois, écartés pour la numérotation et la syntaxe.
- La date de projection de chaque code est celle de l'ingestion (`legi_state.as_of`) : une abrogation datée du lendemain
  n'est pas vue avant le lot suivant.
- NUMEROTATION : peu de candidats, précision limitée par les structures à titres imbriqués (I./A./1.) non reconnues.
- Rien dans ce rapport ne qualifie un candidat ; l'échantillon de triage ne remplace pas la revue humaine.
