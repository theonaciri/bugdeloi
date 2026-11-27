---

name: BugDeLoi
description: Le droit qui calcule, article par article — observatoire citoyen du droit calculable.
colors:
paper: "#f2f3f5"
surface: "#ffffff"
surface-2: "#e9ebef"
ink: "#14161b"
ink-muted: "#4a505c"
line: "#dcdfe5"
line-strong: "#b4bac5"
stamp-violet: "#4b2fb5"
stamp-violet-deep: "#3b2196"
stamp-violet-wash: "#eeebfb"
highlighter: "#fff07a"
night: "#17132b"
night-surface: "#201b39"
night-ink: "#f3f0fc"
night-muted: "#b9b1d8"
ok: "#17704d"
ko: "#b4233c"
notice: "#fdf3d6"
level-n0: "#d5d9e0"
level-n1: "#8fa3c7"
level-n2: "#e9b93a"
level-n3: "#4fa3d9"
level-n4: "#2f5fb3"
level-n5: "#17704d"
level-ref: "#b07d1a"
typography:
display:
fontFamily: "Archivo Variable, Archivo, Helvetica Neue, system-ui, sans-serif"
fontSize: "clamp(1.9rem, 3.4vw, 3.4rem)"
fontWeight: 800
lineHeight: 1.02
letterSpacing: "-0.025em"
fontVariation: "'wdth' 118"
headline:
fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
fontSize: "1.6rem"
fontWeight: 700
lineHeight: 1.08
letterSpacing: "-0.015em"
fontVariation: "'wdth' 112"
body:
fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
fontSize: "1rem"
fontWeight: 400
lineHeight: 1.6
law:
fontFamily: "Source Serif 4 Variable, Source Serif 4, Georgia, serif"
fontSize: "1.05rem"
fontWeight: 400
lineHeight: 1.7
mono:
fontFamily: "JetBrains Mono Variable, JetBrains Mono, ui-monospace, monospace"
fontSize: "0.8rem"
lineHeight: 1.6
label:
fontFamily: "Archivo Variable, Archivo, system-ui, sans-serif"
fontSize: "0.78rem"
fontWeight: 700
letterSpacing: "0.06em"
rounded:
sm: "0.25rem"
md: "0.375rem"
lg: "0.5rem"
xl: "0.75rem"
seat: "999px"
spacing:
gutter-mobile: "1.25rem"
gutter: "2rem"
section: "5rem"
components:
button-primary:
backgroundColor: "{colors.stamp-violet}"
textColor: "{colors.surface}"
rounded: "{rounded.md}"
height: "2.75rem"
padding: "0 1.15rem"
button-primary-hover:
backgroundColor: "{colors.stamp-violet-deep}"
button-secondary:
backgroundColor: "{colors.surface}"
textColor: "{colors.ink}"
rounded: "{rounded.md}"
height: "2.75rem"
task-card:
backgroundColor: "{colors.surface}"
textColor: "{colors.ink}"
rounded: "{rounded.md}"
padding: "0.5rem 0.65rem"
task-card-night:
backgroundColor: "{colors.night-surface}"
textColor: "{colors.night-ink}"
rounded: "{rounded.md}"
board-cell-night:
backgroundColor: "{colors.night}"
textColor: "{colors.night-ink}"
stamp:
textColor: "{colors.stamp-violet}"
rounded: "{rounded.sm}"
padding: "0.4rem 0.9rem"
---

# Design System: BugDeLoi

Source of truth for the tokens: `apps/web/src/tokens.css` (light and dark), exposed to Tailwind in
`apps/web/src/app.css`. Living catalogue: `/design-system`.

## Overview

**Creative North Star: "L'Hémicycle"**

The corpus is an assembly: every article in force is one seat, coloured by its proof level. A task
follows a procedure, step by step, the way a bill does. The site speaks to five audiences at once:
citizens, elected officials, lawyers, scientists and agent owners. It explains before it impresses.
Every number links to its method, and every term links to the single glossary.

What this system refuses: the civic-tech card dashboard; the cream-paper-and-serif broadsheet (the
previous identity); and anything that imitates a government website (no DSFR, no Marianne, no blue-white-red).

Editorial principles carried over from the previous design and still binding:

- Open with the reader's question and the real live state.
- Give every number its exact scope ("un compte, pas une probabilité") and a link to the method.
- Never mix up a finding reproduced by machine with an anomaly qualified by a human.
- Keep technical identifiers (`LEGIARTI`, SHA-256 digests, task ids) one click away and copyable.
- Deliver the same information by keyboard, in light and in dark mode, with no server-side `style=`
  attribute (strict hash-based CSP).

## Colors

- **Cool printed paper** (`paper`, `surface`): the reading ground. Neutral, cold, never cream.
- **Ink** (`ink`, `ink-muted`): text and the 1.5–2 px structural rules (border-top on sections,
  tallies, journey stations).
- **Violet stamp ink** (`stamp-violet`): the one brand colour. Primary actions, links, the "current"
  state, and the tilted stamp on a task's journey. Use it rarely and on purpose.
- **Highlighter** (`highlighter`): only `<mark>` and the flash of a number that just changed.
- **"Séance de nuit" band** (`night*`): live work (the Kanban board, the work section on the home
  page, the Catala code plates). It is the only dark band.
- **Proof levels** (`level-*`): data semantics, never decoration. A level colour **always** comes with
  its text code (N0…N5, ★). Inks are set so contrast stays ≥ 4.5:1.
- **States**: `ok` (integrated), `notice` (in review, returned), `ko` (a gap in euros, a counter-example).

## Typography

Three voices, never mixed:

- **Archivo** (variable, `wdth` axis): our voice. Headings are set wide (`font-stretch` 112–118 %),
  heavy (700–800) and tight. Body text uses the normal width.
- **Source Serif 4**: **only when the law speaks** (official text quoted, article excerpts). Class
  `font-law` / `.legal-text`.
- **JetBrains Mono**: the machine (task ids, `LEGIARTI`, Catala code, commands). Never used as a costume.

Functional text is never below 11.5 px (`0.72rem`). Body text stays under 75 characters per line, and
`text-wrap: pretty` applies to `p`, `dd` and `li`.

## Layout

- `container-wide` (max 86 rem, gutter 1.25 rem on mobile, 2 rem from 640 px).
- Sections open with a thick ink rule (`border-top: 2px`) instead of cards. Equal-sized card grids
  are avoided.
- Breakpoints: 48 rem (two columns), 64 rem (Kanban board, six-station journey), 80 rem (the note on
  the hemicycle's foot).
- On mobile, the board turns each lane into a block of two columns × two rows, the journey becomes a
  vertical list with a dashed rail, and the hemicycle moves its central text below the arc.

## Elevation & Depth

Almost flat: structure comes from rules and borders. `shadow-xs` sits under task cards, and `shadow-lg`
under glossary pop-ups. No coloured halo.

## Shapes

Index-card corners (0.25–0.5 rem). Round shapes are reserved for seats (hemicycle points), station
discs and swatches. Stamps are rectangles, tilted −3° to −4°.

## Components

- **Hemicycle** (`lib/components/work/Hemicycle.svelte`): one point per article in force, drawn on a
  canvas (with an SVG of proportional sectors as fallback). Seats are ordered by angle: ★ and the
  highest levels sit at the left foot, N0 fills the rest. The heading and the CTAs sit at the speaker's
  position. It enters once, with an ease-out exponential sweep of about 1.4 s; reduced motion disables it.
- **LevelTally**: a ballot-style count, one button per level. A level with no articles stays visible
  in a hollow style ("aucun pour l'instant").
- **ArticleJourney**: six stations (Import → Read the sources). Each station shows who acts, what is
  done, the check, and the live count. On a task page it highlights the current station.
- **WorkBoard** (Kanban): one row per stage, four columns (À prendre, En cours, En relecture,
  Intégrée). A stage not yet open shows as a hatched area, with the number of articles waiting.
- **TaskCard**: role, article, holder, time since. It links to `/taches/<id>`.
- **Term**: dotted underline. On hover or focus it opens the definition from `lib/glossary.ts`; the
  link goes to `/methode#g-<id>`.
- **LiveNumber**: a counter that rolls and is briefly highlighted when an SSE update arrives.
- **StageGlyph**: line pictograms (1.6 px stroke) with a violet wash, one subject per stage.

## Do's and Don'ts

- **Do** put every new definition in `lib/glossary.ts`, then use `<Term id=…>`.
- **Do** write the public vocabulary of tasks as "à prendre", "en cours", "en relecture",
  "intégrée". **Don't** write "soumise", "terminée" or "délivrée".
- **Do** compute every number through a documented query (see `/methode#compteurs`). **Don't**
  write a number into the template by hand.
- **Don't** put text inside a fixed-width SVG: lay labels out in HTML/CSS (source of the old overflows).
- **Don't** use opacity to fade out text (it breaks contrast); use `ink-muted`.
- **Don't** write "prouvé", "vérifié" or "certifié" outside the definitions in AGENTS.md §4.
