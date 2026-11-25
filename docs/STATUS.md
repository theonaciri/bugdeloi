# État d'avancement — BugDeLoi

> Document vivant. Chaque agent qui termine un chantier met à jour sa ligne, ajoute ses décisions au
> journal et note ce qu'il a appris dans « Pièges connus ». Court et factuel : pas de prose.

## Jalon courant : J0 Fondations (+ début J1)

| Chantier                                          | Responsable                | État                                                                                                                                                                                | Livrable                                                 |
| ------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Monorepo Bun, Biome, TS 7, licences               | orchestrateur              | ✔ fait                                                                                                                                                                              | racine, `packages/core`, `packages/db`                   |
| Base Postgres `bugdeloi` + migration 0000         | orchestrateur              | ✔ fait                                                                                                                                                                              | `packages/db/migrations`                                 |
| Image Catala 1.3.2 multi-arch + C0.1 rejeu Inria  | codex/gpt-6.2-sol (medium) | ✔ fait — **171/171 tests Inria verts** (ARM64), 473 LEGIARTI de couverture importés                                                                                                 | `infra/catala/`, `packages/runner`, `replications/c0.1/` |
| Ingestion LEGI (CGI, CSS, CCH)                    | codex/gpt-6.2-sol (high)   | ✔ fait — stock du 08/11 + incréments au 24/11/2026 ; 71 884 versions, 1 210 052 liens ; en vigueur : CGI 2 405, CSS 7 420, CCH 4 126                                                | `packages/ingest`                                        |
| Site web (accueil, carte, article, méthode, join) | claude-opus-5-5 (high)     | ✔ fait — en ligne sur https://bugdeloi.theonaciri.fr                                                                                                                                | `apps/web`                                               |
| Service systemd + mise en ligne sur 19069         | orchestrateur              | ✔ fait — `scripts/deploy.sh` (révisions + retour arrière)                                                                                                                           | `infra/systemd/`                                         |
| Balayage mécanique C0.2 (renvois morts…)          | claude-sonnet-5-5 (high)   | ✔ fait — 4 détecteurs déterministes, **1 128 candidats non qualifiés** (REF_MORTE 1 117, SYNTAXE 9, NUMEROTATION 2), certificats rejouables ; rapport `replications/c0.2/REPORT.md` | `packages/sweep`                                         |
| Couverture Inria → ★ sur la carte                 | orchestrateur              | ✔ fait — **290 articles ★** (CGI 32, CSS 24, CCH 234) via `replications/c0.1/promote.ts`                                                                                            | `reference_coverage`                                     |

## Journal des décisions

| Date       | Décision                                                                                                                                                     | Raison                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-25 | Nom public **BugDeLoi**, dépôt `theonaciri/bugdeloi` (GitHub personnel)                                                                                      | Choix du mainteneur                                                                                                                 |
| 2026-11-25 | Dépôt créé **privé** au départ                                                                                                                               | Réversible ; passage en public quand le site est présentable (nécessaire pour la CI gratuite illimitée)                             |
| 2026-11-25 | Licence plateforme AGPL-3.0-or-later                                                                                                                         | Défaut du PLAN §14, non contesté                                                                                                    |
| 2026-11-25 | Postgres en socket Unix + auth peer (rôle `ubuntu`)                                                                                                          | Aucun secret à stocker                                                                                                              |
| 2026-11-25 | Corpus et rejeux dans ce dépôt jusqu'à J3                                                                                                                    | Moins de dépôts tant qu'il n'y a pas de contributeurs externes                                                                      |
| 2026-11-25 | Versions : TS 7.0.2, SvelteKit 3.4, Svelte 5.59, Vite 8.3, Drizzle 0.45.4, postgres 4.1.1, Biome 2.6.9                                                       | Dernières stables au 25/11/2026                                                                                                     |
| 2026-11-25 | Une seule règle « en vigueur » : `isInForce` (core) ≡ `articleInForce()` (db), dates DILA [début, fin[ à la date de projection du code, inclut `ABROGE_DIFF` | Le site comptait `etat = VIGUEUR` seul (CGI 2 030 au lieu de 2 405) ; test d'invariant SQL ≡ JS                                     |
| 2026-11-25 | ★ = marqueur **externe** : version en vigueur formalisée par Inria/DGFiP/CNAF + leur suite de tests verte chez nous (≥ 1 test)                               | Clarification de l'échelle (AGENTS §4.1) ; une version antérieure formalisée ne compte pas                                          |
| 2026-11-25 | Une suite de rejeu sans test = `no_tests`, jamais `passed` ; le compteur ne garde que le dernier rejeu par suite                                             | L'accueil affichait 10/10 dont 2 suites vides                                                                                       |
| 2026-11-25 | Version `MODIFIE` à fin ouverte ≠ en vigueur                                                                                                                 | Confrontation avec Tricoteuses « La loi sous git » : seul écart (CSS R611-2) ; ensuite CGI 2 405 / CSS 7 419 / CCH 4 126 identiques |
| 2026-11-25 | Site en lecture seule sur la base, CSP par empreintes, SSE coalescé via un seul `LISTEN`                                                                     | Le web ne doit jamais écrire ; pages cachables à l'edge                                                                             |

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
  (branche, SHA, vérifications). L'orchestrateur relit, fusionne dans `j0-fondations`, met à jour ce fichier.
- Modèles (règle du mainteneur, 25/11) : **par défaut `codex/gpt-6.2-sol`**, effort `low` (rapide,
  vérifications) ou `medium` (implémentation) ; `high` seulement si justifié. **Pas de sous-agent Claude**
  sauf demande explicite : le quota Claude (5 h) sert à l'orchestrateur. La diversité des familles reste
  souhaitable pour les relectures croisées, dans ces limites.
- Seul le chantier d'ingestion peut modifier `packages/db/src/schema.ts` pendant J0-J1.

## Pièges connus

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
5. J3 : desk + `join.txt` + CI de vérification.
