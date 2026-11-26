# Lire et concevoir BugDeLoi

## Principes éditoriaux & graphiques (« Imprimerie civique × Observatoire »)

- Ouvrir par la question du lecteur, l’état réel en direct et l’impact concret des règles de calcul en euros.
- Alterner des surfaces éditoriales papier chaud (`--bg`) pour la lecture juridique et des bandes Observatoire sombres (`--obs-bg`) pour la course des chantiers, la carte des codes et la télémétrie.
- Donner à chaque entrée du journal, à chaque constat (y compris pré-qualification, explicitement étiqueté) et à chaque chiffre un lien direct vers ses faits, sa méthode et sa commande de rejeu.
- Définir le vocabulaire au premier emploi (`HoverCard` / glossaire) et garder les identifiants techniques (`LEGIARTI`, empreintes SHA-256) accessibles et copiables en un clic.
- Relier chaque compteur à son périmètre exact (« un compte, pas une probabilité ») sans jamais confondre un constat reproduit par machine avec une anomalie qualifiée par un humain.
- Construire tous les contrôles interactifs sur `@ui-sdk/svelte` (`vercel-labs/ui`) afin que le site soit à la fois **contrôlable par des agents** (WebMCP + serveur `/api/mcp`) et **illustré pour les humains** par des graphiques interactifs (`d3-hierarchy`, `d3-scale`, SVG sémantiques).
- Assurer la même information au clavier, en clair comme en sombre, sans attribut `style=` côté serveur (CSP stricte par empreintes). Doubler chaque couleur de niveau de preuve d’un motif (`PatternDefs`) et d’un texte.
- Ne jamais imiter un site de l’État (aucun DSFR, aucune Marianne).

Catalogue vivant des composants, jetons et pont WebMCP : `/design-system`.

Références : [P = NP?](https://pequalnp.com/), [vercel-labs/ui](https://github.com/vercel-labs/ui), [AGENTS.md](../AGENTS.md).
