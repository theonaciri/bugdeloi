# État d'avancement — BugDeLoi

> Document vivant. Chaque agent qui termine un chantier met à jour sa ligne, ajoute ses décisions au
> journal et note ce qu'il a appris dans « Pièges connus ». Court et factuel : pas de prose.

## Jalon courant : J0 Fondations (+ début J1)

| Chantier                                                   | Responsable                              | État                                                                                                                                                                                                                                                                               | Livrable                                                                          |
| ---------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Monorepo Bun, Biome, TS 7, licences                        | orchestrateur                            | ✔ fait                                                                                                                                                                                                                                                                             | racine, `packages/core`, `packages/db`                                            |
| Base Postgres `bugdeloi` + migration 0000                  | orchestrateur                            | ✔ fait                                                                                                                                                                                                                                                                             | `packages/db/migrations`                                                          |
| Image Catala 1.3.2 multi-arch + C0.1 rejeu Inria           | codex/gpt-6.2-sol (medium)               | ✔ fait — **171/171 tests Inria verts** (ARM64), 473 LEGIARTI de couverture importés                                                                                                                                                                                                | `infra/catala/`, `packages/runner`, `replications/c0.1/`                          |
| Ingestion LEGI (CGI, CSS, CCH)                             | codex/gpt-6.2-sol (high)                 | ✔ fait — stock du 08/11 + incréments au 24/11/2026 ; 71 884 versions, 1 210 052 liens ; en vigueur : CGI 2 405, CSS 7 420, CCH 4 126                                                                                                                                               | `packages/ingest`                                                                 |
| Site web (accueil, carte, article, méthode, join)          | claude-opus-5-5 (high)                   | ✔ fait — en ligne sur https://bugdeloi.theonaciri.fr                                                                                                                                                                                                                               | `apps/web`                                                                        |
| Service systemd + mise en ligne sur 19069                  | orchestrateur                            | ✔ fait — `scripts/deploy.sh` (révisions + retour arrière)                                                                                                                                                                                                                          | `infra/systemd/`                                                                  |
| Balayage mécanique C0.2 (renvois morts…)                   | claude-sonnet-5-5 (high)                 | ✔ fait — 4 détecteurs déterministes, **1 128 candidats non qualifiés** (REF_MORTE 1 117, SYNTAXE 9, NUMEROTATION 2), certificats rejouables ; rapport `replications/c0.2/REPORT.md`                                                                                                | `packages/sweep`                                                                  |
| Couverture Inria → ★ sur la carte                          | codex/gpt-6.2-sol (medium)               | Audit sur la base de production en lecture seule : 290 ★ en base, 107 après application projetée (CGI 18, CSS 16, CCH 73). 183 retraits à appliquer après relecture.                                                                                                               | [Audit ★](audits/2026-11-25-etoile.md)                                            |
| Pédagogie du site                                          | codex/gpt-6.2-sol (medium)               | Fiches d’événement, parcours en trois étapes et frise des constats sur la branche de travail                                                                                                                                                                                       | `apps/web`, `docs/DESIGN.md`                                                      |
| Accueil centré sur le droit calculable                     | codex/gpt-6.2-sol (medium)               | Exemple ★ issu du rejeu Inria, compte de travail avant relecture et contrôles regroupés dans le journal                                                                                                                                                                            | `apps/web`                                                                        |
| J3 · Première version du desk                              | codex/gpt-6.2-sol (medium)               | API, tâches d'analyse et CI plateforme sur la branche de travail. L'ouverture du corpus et son contrôle automatique restent à faire.                                                                                                                                               | `apps/web`, migration `0004`, workflow `verify.yml`                               |
| Harnais C0.3 · allocations familiales                      | codex/gpt-6.2-sol (medium)               | Audit de la première remise : 8/32 brut, 5/17 après dédoublonnage, 12/17 avec entrées complétées. Témoin Inria 17/17. Résultats de travail.                                                                                                                                        | [Audit C0.3](audits/2026-11-25-c0.3-evaluation.md)                                |
| Site · expérience C0.3                                     | codex/gpt-6.2-sol (medium)               | Pages de l’expérience et résultats provisoires sur la branche de travail.                                                                                                                                                                                                          | `apps/web`, `replications/c0.3`                                                   |
| Design System (`@ui-sdk/svelte`), Site complet, MCP/WebMCP | gemini-4-neon + gpt-6.2-sol              | ✔ fait — identité éditoriale déployée sur l’accueil, `/design-system` et les 16 pages secondaires ; textes pédagogiques sans jargon ; serveur `/api/mcp` + WebMCP                                                                                                                  | `apps/web`, `docs/DESIGN.md`                                                      |
| J3 · CLI `bdl`, `corpus/`, CI et `/desk` en ligne          | gemini-4-neon + gpt-6.2-sol + sonnet-5-5 | ✔ fait — CLI `bdl`, `corpus/` Apache-2.0, CI `corpus-check.yml`, 3 tâches amorcées en base et `DESK_ENABLED=1` en production                                                                                                                                                       | `packages/cli`, `corpus/`, `.github/workflows/corpus-check.yml`, `infra/systemd/` |
| C0.4 · Rappel des ambiguïtés connues (Inria/DGFiP)         | gemini-4-neon + gpt-6.2-sol              | ✔ fait — 113 annotations extraites (`catala-examples@9e251b93`), 44 sur 25 articles en base ; témoin mécanique `2/44` (4,55 %), analyste aveugle Gemini 4 Neon **`16/44` (36,36 %)**                                                                                               | `replications/c0.4/`                                                              |
| J5 · Noyau IR 2026 (C0.5), falaises (C0.6) & simulateur    | gemini-4-neon + gpt-6.2-sol              | ✔ fait — CGI art. 193, 194, 197 + 1657 1 bis en Catala 1.3.2 (`14/14` tests verts, `4/4` empreintes LEGI), différentiel `10 000` foyers (`0` divergence), mutation `15/16` (`93,75 %`), rétro-traduction, **4 falaises 61 € (+6 100 %)** et simulateur `/experiences/impot-revenu` | `corpus/cgi/.../noyau_ir.catala_fr`, `replications/c0.6/`, `apps/web`             |
| Worker nocturne LEGI + balayage C0.2 (systemd timer)       | claude-sonnet-5-5 (medium)               | ✔ fait — `nightly-sync.sh` avec verrou `flock`, `bugdeloi-nightly.service/.timer` (03 h 30 Paris), installé automatiquement par `deploy.sh`                                                                                                                                        | `scripts/nightly-sync.sh`, `infra/systemd/`, `docs/notes/nightly-worker.md`       |
| Refonte pédagogique · tâches, Kanban, Hémicycle            | claude-opus-5-5 (orchestrateur)          | ✔ fait — `/taches` liste unique, `/taches/[id]` parcours, `/live` Kanban, accueil et `/methode` refaits, événements `desk.*`                                                                                                                                                       | `apps/web`, `PRODUCT.md`, `docs/DESIGN.md`                                        |
| J6 · Doctrine BOFiP côte à côte & vérificateur N5          | claude-sonnet-5-5 (high) + gemini-4-neon | ✔ fait — index BOFiP (`18` articles, `29` références) affiché séparément sur `/article/[legiarti]`, vérificateur de revues juristes signées Git N5 (`29` tests verts)                                                                                                              | `corpus/doctrine/`, `qualifications/n5-reviews/`, `apps/web`                      |

## Journal des décisions

- 2026-11-27 — Révision rédactionnelle complète du site (passe Impeccable `clarify` + ton neutre, naturel et
  scientifique) : suppression des formules rhétoriques (« X, article par article », « du texte au test », « X, pas Y »),
  des points-virgules et des tirets cadratins dans les textes d’interface, remplacement des tournures familières
  (« chez nous », « signe de vie », « passés au crible »), conjugaison des verbes d’action dans le parcours d’un
  article et suppression du doublon `sr-only` sur l’acteur, alignement strict sur le vocabulaire contraint (AGENTS.md
  §1.11 et §6).

- 2026-11-27 — Mode sombre retiré (un seul thème clair). Fond teinté d’un jaune-vert très pâle, complémentaire
  de l’encre violette (`--bg: #f5f6e9`). Passe impeccable (clarify + polish) sur tout le site : titres sans
  formules ni point final, graisses de titres unifiées, fautes corrigées, boutons « pilule » alignés sur les
  angles nets, mesure des paragraphes, `/travail` réparé (import de `@bugdeloi/core` côté client).
  `docs/DESIGN.md` exclu du formatage Biome (il aplatissait le frontmatter YAML).

- 2026-11-27 — **Refonte du suivi des tâches et du site.** Le guichet n'expose qu'un état : « à prendre »
  (`/taches`, ordre exact de distribution). Chaque réservation et libération est journalisée
  (`desk.claimed`, `desk.released`, append-only) ; le parcours d'une tâche se lit sur sa fiche
  `/taches/<id>` (à prendre → en cours → en relecture → intégrée, historique daté, étapes suivantes) et
  sur le tableau Kanban `/live` (une ligne par étape, quatre colonnes). Glossaire unique
  (`lib/glossary.ts`, composant `Term`). Nouvelle identité « Hémicycle » (Archivo / Source Serif 4 pour
  la loi seulement / JetBrains Mono, encre violette, bande « séance de nuit ») ; accueil réécrit autour
  d'un hémicycle des articles en vigueur, du parcours en six étapes et d'un exemple réel (CGI 278).
  `PRODUCT.md` créé, `docs/DESIGN.md` réécrit, `docs/PLAN.md` marqué comme plan d'origine.

- 2026-11-26 — `/desk/next` calcule la disponibilité sur la projection LEGI courante. Les tâches sont
  inscrites au premier bail, avec verrouillage PostgreSQL et sans réserve périodique. Les traductions
  restent liées aux interfaces versionnées de `apps/web/src/lib/server/desk-translations.ts`.
  La page d’activité compte aussi les tâches qui pourront être inscrites au premier bail.

- 2026-11-26 — `syntaxe@1.1.0` reconnaît les marqueurs comme `l2°)` en tête d’alinéa. Le balayage CSS
  n° 10 a retiré F-2026-1128 (`withdrawn`) et conservé les deux autres constats SYNTAXE du code.
  Le lien Légifrance de la fiche s’ouvre dans un nouvel onglet.

| Date       | Décision                                                                                                                                                     | Raison                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-25 | Nom public **BugDeLoi**, dépôt `theonaciri/bugdeloi` (GitHub personnel)                                                                                      | Choix du mainteneur                                                                                                                          |
| 2026-11-25 | Dépôt créé **privé** au départ                                                                                                                               | Réversible ; passage en public quand le site est présentable (nécessaire pour la CI gratuite illimitée)                                      |
| 2026-11-25 | Licence plateforme AGPL-3.0-or-later                                                                                                                         | Défaut du PLAN §14, non contesté                                                                                                             |
| 2026-11-25 | Postgres en socket Unix + auth peer (rôle `ubuntu`)                                                                                                          | Aucun secret à stocker                                                                                                                       |
| 2026-11-25 | Corpus et rejeux dans ce dépôt jusqu'à J3                                                                                                                    | Moins de dépôts tant qu'il n'y a pas de contributeurs externes                                                                               |
| 2026-11-25 | Versions : TS 7.0.2, SvelteKit 3.4, Svelte 5.59, Vite 8.3, Drizzle 0.45.4, postgres 4.1.1, Biome 2.6.9                                                       | Dernières stables au 25/11/2026                                                                                                              |
| 2026-11-25 | Une seule règle « en vigueur » : `isInForce` (core) ≡ `articleInForce()` (db), dates DILA [début, fin[ à la date de projection du code, inclut `ABROGE_DIFF` | Le site comptait `etat = VIGUEUR` seul (CGI 2 030 au lieu de 2 405) ; test d'invariant SQL ≡ JS                                              |
| 2026-11-25 | ★ = marqueur **externe** : version en vigueur formalisée par Inria/DGFiP/CNAF + leur suite de tests verte chez nous (≥ 1 test)                               | Clarification de l'échelle (AGENTS §4.1) ; une version antérieure formalisée ne compte pas                                                   |
| 2026-11-25 | Une suite de rejeu sans test = `no_tests`, jamais `passed` ; le compteur ne garde que le dernier rejeu par suite                                             | L'accueil affichait 10/10 dont 2 suites vides                                                                                                |
| 2026-11-25 | Version `MODIFIE` à fin ouverte ≠ en vigueur                                                                                                                 | Confrontation avec Tricoteuses « La loi sous git » : seul écart (CSS R611-2) ; ensuite CGI 2 405 / CSS 7 419 / CCH 4 126 identiques          |
| 2026-11-25 | Site en lecture seule sur la base, CSP par empreintes, SSE coalescé via un seul `LISTEN`                                                                     | Le web ne doit jamais écrire ; pages cachables à l'edge                                                                                      |
| 2026-11-25 | Transactions du desk en lecture-écriture explicite. Le reste du web garde la lecture seule.                                                                  | La réservation, le renouvellement et la libération d'un bail sont atomiques.                                                                 |
| 2026-11-25 | Accès public aux fiches pré-qualification (`candidate`, `reproduced`) avec bandeau d'avertissement + serveur MCP `/api/mcp` + WebMCP (`@ui-sdk/svelte`)      | Choix du mainteneur : exposer le maximum d'informations aux agents et relecteurs tout en gardant le compteur « anomalies qualifiées » strict |

## Production

- Service `bugdeloi-web` (systemd, utilisateur `ubuntu`) : `bun serve.ts` dans
  `~/.local/share/bugdeloi/current/apps/web`, écoute `127.0.0.1:19069`, base `bugdeloi` en **lecture seule**.
- Déployer : `scripts/deploy.sh [ref]` (construit la révision à part, migre, bascule, contrôle
  `/api/status.json`, revient en arrière sinon). Journaux : `journalctl -u bugdeloi-web`.
- **À faire côté Cloudflare (tableau de bord, hors de portée des agents)** : une règle de cache
  « Eligible for cache » sur `bugdeloi.theonaciri.fr` pour que les en-têtes `s-maxage` soient honorés
  (aujourd'hui `cf-cache-status: DYNAMIC` sur le HTML).

## Méthode d'orchestration

- L'orchestrateur (Claude Opus 5.5) découpe en chantiers à répertoires disjoints, chacun délégué dans un
  **worktree** séparé ; il est seul à écrire `AGENTS.md`, `docs/PLAN.md` et ce fichier (pas de conflit).
- Chaque sous-agent consigne ses apprentissages dans `docs/notes/<chantier>.md` et termine par un rapport
  (branche, SHA, vérifications). L'orchestrateur relit, fusionne dans `main`, met à jour ce fichier.
- Modèles (règle du mainteneur, 25/11) : **par défaut `codex/gpt-6.2-sol`**, effort `low` (rapide,
  vérifications) ou `medium` (implémentation) ; `high` seulement si justifié. **Pas de sous-agent Claude**
  sauf demande explicite : le quota Claude (5 h) sert à l'orchestrateur. La diversité des familles reste
  souhaitable pour les relectures croisées, dans ces limites.
- Seul le chantier d'ingestion peut modifier `packages/db/src/schema.ts` pendant J0-J1.

## Pièges connus

- Desk : les tâches antérieures au 27/11/2026 n'ont pas d'événements `desk.*` ; leur fiche reconstitue
  seulement le dernier bail conservé dans `desk_task`.
- Desk : activer avec `DESK_ENABLED=1` après migration et ingestion LEGI. Les baux existants
  conservent leur historique. Une nouvelle réservation requiert des versions et empreintes courantes.
- Desk : pseudo GitHub et famille déclaratifs. La limite de 30 requêtes par minute et par IP est
  locale au processus, avec une fenêtre fixe de 60 secondes et une remise à zéro au redémarrage.
  Le motif `submitted` clôt la tâche sur déclaration du détenteur du bail.
  Derrière le tunnel, `ADDRESS_HEADER=cf-connecting-ip` suppose une origine accessible seulement via
  un proxy de confiance. La base conserve l'empreinte du bail. Éviter de journaliser les URL du desk,
  qui portent l'identifiant brut nécessaire au battement et à la libération.

- **Quotas des fournisseurs** : Claude (limite de 5 h), Antigravity/Gemini (quota individuel, plusieurs
  jours). Une tâche déléguée qui échoue sur quota peut **reprendre seule** à la réinitialisation : annuler
  explicitement (`task_cancel`) toute tâche remplacée pour éviter deux implémentations concurrentes.

- C0.2 : les blocs `VERSIONS` des anciennes versions sont incomplets (lignée = composante connexe) ;
  11 % des liens `CITATION` pointent vers une version absente du stock (rattachement par numéro) ;
  `\b` JS ne coupe pas après une lettre accentuée ; `normalizeLegalText` transforme « » en `"`.
  Détails : `docs/notes/sweep.md`.
- Ingestion : l'arbre daté est construit depuis les liens des sections ; une version n'y est placée que
  si **ses propres** métadonnées la disent en vigueur. Après un changement de règle :
  `ingest legi --incremental --reproject`.

- LEGI : chaque `LEGIARTI` est une **version** ; les liens pointent vers une version précise. Un renvoi vers
  une version `MODIFIE` n'est pas mort : il faut regarder si l'**article** (groupe de versions) a encore
  une version en vigueur. Détails de l'archive : `docs/notes/legi.md`.
- Drizzle : deux `.where()` chaînés → seul le dernier compte. Toujours `and(...)`.

- svelte-check exige l'API JS de **TypeScript 6** (TS 7 natif ne la fournit pas) : `typescript@6.0.3` en
  devDependency de `apps/web` uniquement.
- SvelteKit 3 : pas de `svelte.config.js`, alias `#lib` (imports Node) au lieu de `$lib`.
- adapter-node écoute 0.0.0.0 par défaut → toujours lancer via `apps/web/serve.ts`.
- CSP par empreintes : pas d'attribut `style=` dans les templates.
- Le site importe `@bugdeloi/core/levels` (et non `@bugdeloi/core`) côté client : l'entrée principale tire
  `node:crypto`.

- Clerk 1.3.2 en conteneur `--read-only` : `CLERK_BUILD_DIR` et `CLERK_TARGET_DIR` doivent pointer vers le
  tmpfs (`/build`), sinon échec d'écriture. Détails : `docs/notes/catala.md`.
- Catala 1.3.2 (opam) n'a **ni `catala proof` ni chaîne JavaScript** dans notre image : la simulation dans le
  navigateur et Z3 restent à étudier (JS via js_of_ocaml ? backend C → WASM ?).
- L'image Catala est verrouillée par digest, mais **sa reconstruction n'est pas encore reproductible**
  (image Debian et dépôt opam non épinglés) → à épingler avant la CI publique.
- `smic` et `base_mensuelle_allocations_familiales` n'ont aucun test `#[test]` côté Inria.

- Biome 2.6 formate aussi le Markdown (italique `*x*` → `_x_`) : c'est voulu, ne pas lutter.
- Biome : `linter.rules.recommended` est déprécié → `"preset": "recommended"`.
- `@bugdeloi/core` doit rester compatible Node (build Vite) : pas de global `Bun` dedans, utiliser `node:` .
- `cloudflared` système utilise un tunnel **géré à distance** (token) : les routes se configurent côté
  Cloudflare, pas dans un fichier local. La route `bugdeloi.theonaciri.fr` existe déjà (502 tant que
  rien n'écoute sur 19069).

## Vérifications indépendantes

| Date       | Quoi                                                                                            | Par                        | Résultat                                                                                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-25 | Relecture du site en ligne (vocabulaire, a11y, liens, chiffres)                                 | codex/gpt-6.2-sol (low)    | 0 bloquant, 6 corrections appliquées                                                                                                                                                       |
| 2026-11-25 | Données LEGI vs « La loi sous git » (Tricoteuses) + 17 textes                                   | codex/gpt-6.2-sol (low)    | CGI et CCH identiques ; CSS +1 (R611-2, corrigé) ; textes identiques après normalisation ; Légifrance renvoie 403 aux accès automatisés                                                    |
| 2026-11-25 | Reproduction indépendante des 1 128 candidats C0.2 sur Tricoteuses (code séparé, autre famille) | codex/gpt-6.2-sol (medium) | SYNTAXE 9/9 confirmés → `reproduced` ; 7 infirmés (5 REF_MORTE : numéro réattribué ; 2 NUMEROTATION : citation, III/III bis) ; 1 112 indéterminés (instantanés sans historique des cibles) |

## Lot de cinq traductions du 26 novembre 2026

- CGI 278 (`LEGIARTI000026950057`, 2014-01-01) et 757 C (`LEGIARTI000036428850`, 2018-01-01).
- CSS R. 160-20 (`LEGIARTI000031797331`), D. 846-1 (`LEGIARTI000031673946`) et D. 846-3 (`LEGIARTI000031674243`), versions du 2016-01-01.
- Traductions et tests d’exemple par OpenAI, modèle `gpt-6.2-sol`. Les cinq extraits concordent avec les empreintes de la projection LEGI. `clerk test` réussit les 24 tests du corpus avec Catala 1.3.2 et l’image GitHub amd64 épinglée dans `corpus-check.yml`. Revue indépendante et promotion des niveaux de preuve en attente.

La PR #1 reprend le workflow de `main` et conserve son digest Catala amd64.

## Prochaines étapes (ordre)

1. ✔ Détecteurs C0.2 en 1.1.0 : les 7 infirmés sont `withdrawn` (balayage n° 8). Base : 1 112 REF_MORTE
   `candidate`, 9 SYNTAXE `reproduced`, 7 `withdrawn`.
2. ✔ Qualification humaine par verdicts commités (`dossier`, `qualify`, `publish`) + pages `/anomalies`,
   `/anomalies/[id]`, `/anomalies/cimetiere` — codex/gpt-6.2-sol (high), en ligne. (Une 2ᵉ implémentation par
   claude-sonnet-5-5, reprise seule après quota, existe sur `t3/qualification-workflow-pages` : non fusionnée.)
3. ✔ Reproduction indépendante n° 2 depuis les **XML DILA bruts** (claude-opus-5-5) : **1 110 REF_MORTE
   confirmés → `reproduced`**, 2 indéterminés, 0 infirmé ; les 5 retraits retrouvés en contrôle négatif.
   Base : 1 119 `reproduced` (REF_MORTE 1 110, SYNTAXE 9), 2 `candidate`, 7 `withdrawn`.
4. **Qualification humaine** (dossier prêt : 9 SYNTAXE reproduits, `qualifications/dossiers/2026-11-25-SYNTAXE.md`) d'un premier lot par le mainteneur ou un juriste → premiers findings publiés.
5. J3 : desk, `/join.txt` et CI plateforme en branche. Restent la CLI `bdl`, le dépôt du corpus, le
   contrôle des contributions et l'ouverture à un premier agent externe.
