# Notes — site web (`apps/web`)

Apprentissages du chantier « site public J0 » (25/11/2026). Court et factuel.

## Lancer

```bash
cd apps/web
bun run seed:dev                       # données FICTIVES dans bugdeloi_webdev (refuse toute autre base)
DATABASE_URL='postgres://ubuntu@localhost:5432/bugdeloi_webdev?host=/var/run/postgresql' bun run dev   # 127.0.0.1:19070
bun run build
PORT=19070 DATABASE_URL=… bun serve.ts # production locale ; sans PORT : 127.0.0.1:19069
```

En production (systemd) : `bun serve.ts` avec `ORIGIN=https://bugdeloi.theonaciri.fr` (sert à
`url.origin` dans `/feed.atom` et `/join.txt`) et éventuellement `DATABASE_URL`. `serve.ts` force
`HOST=127.0.0.1` par défaut et refuse `0.0.0.0` / `::`.

## Organisation

- `src/lib/server/queries.ts` : **toutes** les requêtes publiques, chacune documentée ; la page
  `/methode#compteurs` en reprend les définitions en français. Ajouter un compteur = ajouter une
  requête ici + sa définition là-bas.
- `src/lib/server/db.ts` : connexion **en lecture seule** (`default_transaction_read_only`) ; le
  `LISTEN` reste autorisé. Le site ne peut pas écrire en base, même par erreur.
- `src/lib/server/stream.ts` : un seul `LISTEN bugdeloi_event` par process, instantané calculé une
  fois puis diffusé à tous les clients SSE ; coalescence ≤ 1/s (`lib/coalesce.ts`, testée).
- `src/lib/map-tree.ts` : fenêtre de carte sur 3 niveaux sous la section visée (requête ltree
  `subpath(path, 0, nlevel(focus)+3)` groupée par niveau) → charge proportionnelle à l'affichage.
- `src/lib/sanitize.ts` : assainisseur HTML maison par liste blanche (aucune dépendance), testé.
- `src/tokens.css` : jetons du design system (couleurs, polices, niveaux `--level-n0…--level-ref`).
- `scripts/seed-dev.ts` : données fictives ; `ingest_run.source = 'FICTIF-DEV'` déclenche un
  bandeau « Données fictives » sur tout le site.

## Pièges SvelteKit 3 / Svelte 5

- **Plus de `svelte.config.js`** : toute la config (adapter, csp, compilerOptions) va dans
  `sveltekit({...})` dans `vite.config.ts`.
- **`$lib` → `#lib`** (imports de sous-chemin déclarés dans `package.json` `imports`), extensions
  obligatoires : `import x from '#lib/format.ts'`.
- `tsconfig.json` étend `"$app/tsconfig"` (fichier généré par `svelte-kit sync` dans
  `node_modules/$app/`) ; types `"$app/types"`.
- `$app/stores` n'existe plus : `import { page } from '$app/state'` (sans `$`). `$app/environment`
  → `$app/env`.
- Types des hooks dans `@sveltejs/kit/hooks`. `handleError` reçoit `{ kind, error, event }`
  (`kind` : `app` | `framework` | `unknown` | `validation`) et renvoie des champs optionnels de
  `App.Error` (qui contient toujours `status`).
- `json()` est déprécié : `Response.json(...)`.
- **svelte-check exige TypeScript 6** (API JS) ; le dépôt est en TS 7 (natif, sans API). D'où
  `typescript@6.0.3` en devDependency d'`apps/web` uniquement (Kit 3 déclare aussi `typescript ^6`
  en pair). `svelte-check --tsgo` existe mais demande les deux versions installées.
- **adapter-node écoute sur `0.0.0.0` par défaut** → `serve.ts`.
- adapter-node laisse les `dependencies` en import à l'exécution (`drizzle-orm`, `postgres`,
  `d3-hierarchy` : `build/` doit tourner depuis `apps/web/` avec son `node_modules`). Les paquets
  `@bugdeloi/*` (liens de workspace, sources TS hors `node_modules`) sont, eux, **embarqués** dans
  le build : vérifié avec `grep` sur `build/**/*.js`.
- `@bugdeloi/core` (index) importe `node:crypto` : un composant client qui l'importe le tire dans
  le bundle navigateur (avertissement « externalized for browser compatibility »). Importer
  `@bugdeloi/core/levels` ou `/findings` (sous-chemins ajoutés à core), et `#lib/ids.ts` pour le
  motif LEGIARTI.

## CSP

- Mode `hash` (pas `nonce`) : les pages sont en cache à l'edge, un nonce servi depuis le cache
  serait identique pour tous les visiteurs.
- `style-src 'self'` bloque l'attribut `style` en ligne de l'annonceur de navigation de Kit
  (`#svelte-announcer`). On autorise **ce seul attribut** : `'unsafe-hashes'` + son sha256,
  calculé dans `vite.config.ts` depuis la source de Kit (échoue si Kit change sa structure).
- Conséquence : **aucun `style="…"` dans nos gabarits**, et pas de `fill="var(--x)"` en attribut
  SVG : on passe par des classes (`lvl-fill-n3`, `bdl-track`…). Les styles posés par JS via CSSOM
  (`el.style.x = …`) restent permis. Pas non plus de `style=` dans `app.html`.
- Les motifs SVG des niveaux sont définis une seule fois par page (`PatternDefs.svelte`) et
  référencés par `url(#bdl-pat-…)` depuis les autres SVG.

## Tailwind 4

- `@import 'tailwindcss'` dans `app.css`, jetons branchés par `@theme inline { --color-ink: var(--ink) }`
  pour que les utilitaires (`bg-surface`, `text-muted`…) suivent le mode sombre (`prefers-color-scheme`).
- Biome doit connaître les directives Tailwind : `"css": { "parser": { "tailwindDirectives": true } }`.

## Biome et Svelte

- Biome formate les `<script>` Svelte **sans indentation** : c'est voulu, ne pas lutter.
- Biome ne voit pas l'usage des variables dans le gabarit → faux positifs `noUnusedImports` /
  `noUnusedVariables`. Désactivés pour `**/*.svelte` (override dans `biome.json`) et compensés par
  `noUnusedLocals` / `noUnusedParameters` dans `apps/web/tsconfig.json` (svelte-check comprend les
  gabarits).

## SSE derrière Cloudflare

- En-têtes : `content-type: text/event-stream`, `cache-control: no-cache, no-transform` (sans
  `no-transform`, la compression peut mettre le flux en tampon), `x-accel-buffering: no`.
- Cloudflare coupe une connexion inactive au bout de ~100 s : battement (commentaire `: ping`)
  toutes les 15 s. `retry: 5000` pour la reconnexion du navigateur.
- Le premier instantané est envoyé à l'ouverture ; ensuite uniquement sur événement (coalescé).
  Après une reconnexion du `LISTEN` (coupure Postgres), on rediffuse un instantané.
- Repli client : `EventSource` en erreur → polling de `/api/snapshot.json` toutes les 30 s
  (cache edge `s-maxage=5`), arrêté dès qu'un message SSE arrive.
- Vérifié : 30 `INSERT` en rafale → 2 messages espacés de 1 s ; un `INSERT` isolé → message
  immédiat ; client retiré du hub à la déconnexion.

## Vérification navigateur

Playwright est disponible sur l'hôte (`/home/ubuntu/.local/playwright`, Chromium en cache). Un
script hors dépôt a contrôlé : aucune erreur console ni violation CSP, mise à jour en direct de
l'accueil (< 100 ms), navigation clavier de l'arbre (`role=tree`, une seule tabulation), clic sur
une tuile, pas de défilement horizontal à 390 px.
