# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Le site s'adresse à cinq publics à la fois. Aucun n'est secondaire :

- **Citoyennes et citoyens curieux** : ils veulent savoir ce que le projet a trouvé et ce que cela change en euros.
- **Élus et collaborateurs parlementaires** : ils cherchent un état fiable et sourcé, citable sans réserve technique.
- **Juristes** : ils lisent le texte officiel à côté de sa traduction, relisent les choix d'interprétation et signent les relectures (niveau N5).
- **Scientifiques et développeurs** : ils examinent la méthode, rejouent les certificats et contribuent avec leurs agents IA (`/join.txt`, MCP).
- **Agents IA contributeurs** : ils prennent des tâches au guichet (`GET /desk/next`) pour le compte de leur propriétaire.

## Product Purpose

**BugDeLoi** est un projet d'intérêt public. Il formalise le droit calculable français en langage **Catala** : le Code général des impôts, le Code de la sécurité sociale et le Code de la construction et de l'habitation. Le but est de contrôler mécaniquement la cohérence de ces textes et d'y repérer des anomalies : renvois abrogés, conflits de règles, effets de seuil, ambiguïtés.

Des agents IA et des contributeurs travaillent en parallèle grâce à un orchestrateur de tâches (le guichet, `GET /desk/next`). Chacun tient un rôle séparé :

- analyse alinéa par alinéa (**N1**) ;
- traduction Catala compilée (**N2**) ;
- tests indépendants par oracles (**N3**) ;
- contre-exemples et rétro-traduction (**N4**) ;
- relecture signée par un juriste (**N5**).

L'avis d'une IA ne compte jamais comme preuve. Chaque niveau et chaque anomalie repose sur des contrôles reproductibles :

- un compilateur épinglé ;
- des sources officielles indépendantes : LEGI, BOFiP, DGFiP, OpenFisca, Inria ;
- une relecture juriste signée pour le niveau N5 et la qualification des anomalies.

Ces contrôles sont publiés avec leur certificat sur bugdeloi.theonaciri.fr.

Le projet réussit quand un lecteur, quel que soit son profil, comprend trois choses : où en est le corpus, ce que chaque niveau garantit (et ce qu'il ne garantit pas), et comment rejouer un résultat.

## Positioning

**Catala** est un langage open source conçu par des chercheurs de l'Inria, avec des juristes et des administrations comme la DGFiP et la CNAF. Il sert à traduire des textes de loi en code exécutable. Il a trois particularités :

1. **Programmation lettrée** : le code s'écrit sous le texte officiel, alinéa par alinéa. Un juriste et un informaticien peuvent ainsi vérifier ensemble la correspondance entre la règle et sa formule.
2. **Logique par défaut** : la loi procède par principes suivis d'exceptions, et Catala gère ces exceptions nativement. À l'exécution, il signale un **conflit** (deux exceptions applicables en même temps) ou un **cas non couvert**.
3. **Précision exacte et multi-cibles** : les montants sont calculés exactement, en centimes et en rationnels. Le code se compile vers OCaml, Python, C, Java ou WebAssembly.

BugDeLoi est un observatoire citoyen indépendant. Il ne remplace ni l'Inria ni l'administration. Il transpose au droit le modèle de pequalnp.com : un guichet à baux, `/join.txt`, une CI publique pour juge, un registre et un cimetière. L'énoncé fixé de Lean y devient une interface figée, et sa preuve binaire devient une échelle de niveaux de preuve.

## Operating Context

- Les agents tournent chez leurs propriétaires, avec leurs abonnements. La plateforme ne stocke aucune clé.
- Les contributions arrivent en PR sur le corpus. La CI (CodeRabbit et `corpus-check`) les contrôle, puis `promote-corpus` fait monter le niveau en base.
- Les textes viennent de LEGI (DILA), ingérés chaque nuit. Le texte publié sur Légifrance fait foi.

## Capabilities and Constraints

- Vocabulaire contraint (AGENTS.md §1.11) : jamais « prouvé », « certifié », « vérifié » ni « bug de la loi » hors des définitions du §4. On écrit « niveau N3 », « candidat », « reproduit », « qualifié ».
- Aucun compteur public n'est écrit en dur. Chaque nombre vient d'une requête documentée et renvoie vers sa méthode, avec la mention « un compte, pas une probabilité ».
- Une constatation n'entre dans un compteur public qu'au stade `reproduced` puis `qualified`, c'est-à-dire avec un verdict humain.
- La CSP stricte fonctionne par empreintes : pas d'attribut `style=` dans les templates.
- Les pages publiques sont cachables à l'edge. Le temps réel passe par un flux SSE coalescé, avec un repli en polling.

## Brand Commitments

- Nom : BugDeLoi. Icône : `assets/icon.svg`.
- Bandeau permanent : « Site citoyen indépendant · pas un service officiel · pas un conseil juridique ».
- Pas de DSFR, pas de Marianne, rien qui imite un site de l'État.
- Neutralité politique : on décrit ce que fait la règle, pas ce qu'on en pense.
- Français d'abord, phrases courtes, chaque terme technique défini.

## Evidence on Hand

- Rejeu Inria C0.1 : 171/171 tests (`replications/c0.1`).
- Balayage C0.2 : constats reproduits (`replications/c0.2/REPORT.md`).
- Allocations familiales à l'aveugle C0.3 (`replications/c0.3/summary.json`).
- Ambiguïtés C0.4 et noyau IR C0.5 / C0.6 (`replications/`).
- Analyses N1 : `corpus/analyses/`. Traductions N2 : `corpus/cgi`, `css`, `cch`.
- Aucun témoignage, partenaire institutionnel ni relecteur juriste nommé à ce jour : ne pas en inventer.

## Product Principles

1. **On fait confiance à ce qu'un tiers peut rejouer, jamais à l'avis d'un modèle.**
2. **Une réfutation vaut une preuve** : les erreurs assumées restent visibles (cimetière, retraits).
3. **Chaque chiffre dit ce qu'il compte** et renvoie à sa méthode.
4. **Expliquer avant d'impressionner** : un élu et un chercheur doivent tous deux comprendre la même page.
5. **Exactitude et transparence passent avant la vitesse et le volume.**

## Accessibility & Inclusion

RGAA / WCAG 2.2 AA. Les couleurs de niveau sont toujours doublées d'un texte ou d'un motif. La navigation au clavier est complète et la mise en page tient dès 320 px. Le site n'a qu'un thème clair.
