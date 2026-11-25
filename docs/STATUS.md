# État d'avancement — BugDeLoi

> Document vivant. Chaque agent qui termine un chantier met à jour sa ligne, ajoute ses décisions au
> journal et note ce qu'il a appris dans « Pièges connus ». Court et factuel : pas de prose.

## Jalon courant : J0 Fondations (+ début J1)

| Chantier                                          | Responsable                | État                                                    | Livrable                                                 |
| ------------------------------------------------- | -------------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| Monorepo Bun, Biome, TS 7, licences               | orchestrateur              | ✔ fait                                                  | racine, `packages/core`, `packages/db`                   |
| Base Postgres `bugdeloi` + migration 0000         | orchestrateur              | ✔ fait                                                  | `packages/db/migrations`                                 |
| Image Catala 1.3.2 multi-arch + C0.1 rejeu Inria  | codex/gpt-6.2-sol (medium) | en cours                                                | `infra/catala/`, `packages/runner`, `replications/c0.1/` |
| Ingestion LEGI (CGI, CSS, CCH)                    | codex/gpt-6.2-sol (high)   | en cours                                                | `packages/ingest`                                        |
| Site web (accueil, carte, article, méthode, join) | claude-opus-5-5 (high)     | en cours                                                | `apps/web`                                               |
| Service systemd + mise en ligne sur 19069         | orchestrateur              | unité + script prêts, mise en ligne après fusion du web | `infra/systemd/`                                         |
| Balayage mécanique C0.2 (renvois morts…)          | —                          | à faire (après ingestion)                               | `packages/sweep`                                         |
| Couverture Inria (LEGIARTI cités) → carte         | —                          | à faire (après ingestion + C0.1)                        | `reference_coverage`                                     |

## Journal des décisions

| Date       | Décision                                                                                               | Raison                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| 2026-11-25 | Nom public **BugDeLoi**, dépôt `theonaciri/bugdeloi` (GitHub personnel)                                | Choix du mainteneur                                                                                     |
| 2026-11-25 | Dépôt créé **privé** au départ                                                                         | Réversible ; passage en public quand le site est présentable (nécessaire pour la CI gratuite illimitée) |
| 2026-11-25 | Licence plateforme AGPL-3.0-or-later                                                                   | Défaut du PLAN §14, non contesté                                                                        |
| 2026-11-25 | Postgres en socket Unix + auth peer (rôle `ubuntu`)                                                    | Aucun secret à stocker                                                                                  |
| 2026-11-25 | Corpus et rejeux dans ce dépôt jusqu'à J3                                                              | Moins de dépôts tant qu'il n'y a pas de contributeurs externes                                          |
| 2026-11-25 | Versions : TS 7.0.2, SvelteKit 3.4, Svelte 5.59, Vite 8.3, Drizzle 0.45.4, postgres 4.1.1, Biome 2.6.9 | Dernières stables au 25/11/2026                                                                         |

## Méthode d'orchestration

- L'orchestrateur (Claude Opus 5.5) découpe en chantiers à répertoires disjoints, chacun délégué dans un
  **worktree** séparé ; il est seul à écrire `AGENTS.md`, `docs/PLAN.md` et ce fichier (pas de conflit).
- Chaque sous-agent consigne ses apprentissages dans `docs/notes/<chantier>.md` et termine par un rapport
  (branche, SHA, vérifications). L'orchestrateur relit, fusionne dans `j0-fondations`, met à jour ce fichier.
- Modèles : tâches rapides et vérifications → `codex/gpt-6.2-sol` effort bas ; chantiers difficiles →
  effort élevé ou Claude Opus/Sonnet 5.5. La diversité des familles de modèles sert aussi de relecture croisée.
- Seul le chantier d'ingestion peut modifier `packages/db/src/schema.ts` pendant J0-J1.

## Pièges connus

- Biome 2.6 formate aussi le Markdown (italique `*x*` → `_x_`) : c'est voulu, ne pas lutter.
- Biome : `linter.rules.recommended` est déprécié → `"preset": "recommended"`.
- `@bugdeloi/core` doit rester compatible Node (build Vite) : pas de global `Bun` dedans, utiliser `node:` .
- `cloudflared` système utilise un tunnel **géré à distance** (token) : les routes se configurent côté
  Cloudflare, pas dans un fichier local. La route `bugdeloi.theonaciri.fr` existe déjà (502 tant que
  rien n'écoute sur 19069).

## Prochaines étapes (ordre)

1. Fusionner les trois chantiers J0 ; mettre en ligne le site sur 19069 (systemd).
2. C0.2 balayage mécanique du CGI → premier rapport (candidats, pas encore qualifiés).
3. Couverture Inria sur la carte (★ seulement pour les sous-arbres dont la suite de tests est verte en C0.1).
4. J3 : desk + `join.txt` + CI de vérification.
