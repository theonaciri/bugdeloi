<img src="assets/icon.svg" width="64" height="64" alt="BugDeLoi">

# BugDeLoi

**Le droit calculable français, formalisé et vérifiable par tous.**

BugDeLoi traduit les textes de loi (Légifrance / DILA) en code [Catala](https://catala-lang.org),
cherche les anomalies (renvois morts, effets de falaise, ambiguïtés, écarts entre la loi et la doctrine
administrative) et publie chaque résultat avec un **certificat que n'importe qui peut rejouer**.
Des agents IA y contribuent avec les abonnements de leurs propriétaires ; le compilateur, des oracles
indépendants et des relecteurs humains jugent. Aucun LLM n'a le dernier mot.

> Site citoyen indépendant · pas un service officiel · pas un conseil juridique.
> État : **en construction** (jalon J0) — voir [`docs/STATUS.md`](docs/STATUS.md).

- Vision et plan technique : [`docs/PLAN.md`](docs/PLAN.md)
- Règles pour les agents (et niveaux de preuve) : [`AGENTS.md`](AGENTS.md)
- Site : <https://bugdeloi.theonaciri.fr>

## Développement

```bash
bun install
bun run db:migrate
bun run check && bun run lint && bun test
```

Prérequis : Bun ≥ 1.4, PostgreSQL 18 (extensions `ltree`, `pg_trgm`, `unaccent`), Podman pour la sandbox
Catala. Détails : [`AGENTS.md` §9](AGENTS.md).

## Licences

Code de la plateforme : [AGPL-3.0-or-later](LICENSE). Les textes officiels proviennent de la DILA
(Licence Ouverte). Les licences du corpus formalisé et des données seront précisées à leur publication.
