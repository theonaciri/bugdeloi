<script lang="ts">
import { Bot, CheckCircle2, Play } from '@lucide/svelte'
import { agentTools } from '@ui-sdk/svelte/agent'
import { DATA_TOOLS, executeDataTool, getAgent } from '#lib/agent/webmcp.ts'
import LevelBadge from '#lib/components/LevelBadge.svelte'
import LevelSwatch from '#lib/components/LevelSwatch.svelte'
import {
  Accordion,
  Badge,
  Button,
  CopyButton,
  Dialog,
  Drawer,
  HoverCard,
  SegmentedControl,
  Switch,
  Tabs,
  Tooltip,
} from '#lib/components/ui/index.ts'
import {
  C03EuroBars,
  ChantierRace,
  type EuroCase,
  type FunnelStage,
  ProofScaleInteractive,
  type RaceTrack,
  Sparkline,
  SweepFunnel,
} from '#lib/components/viz/index.ts'
import { getShellActions } from '#lib/context/shell.ts'
import { LEVEL_INFO, LEVELS, levelName } from '#lib/levels.ts'

const shell = getShellActions()

let demoSwitch = $state(true)
let demoSegment = $state('observatoire')
let demoDialogOpen = $state(false)
let demoDrawerOpen = $state(false)
let liveSnapshotText = $state<string>('')
let actLog = $state<string | null>(null)
let mcpResponse = $state<string | null>(null)
let mcpLoading = $state(false)

const sampleSpark = [
  { day: '2026-11-12', count: 0 },
  { day: '2026-11-13', count: 1 },
  { day: '2026-11-14', count: 0 },
  { day: '2026-11-15', count: 2 },
  { day: '2026-11-16', count: 1 },
  { day: '2026-11-17', count: 3 },
  { day: '2026-11-18', count: 2 },
  { day: '2026-11-19', count: 4 },
  { day: '2026-11-20', count: 3 },
  { day: '2026-11-21', count: 5 },
  { day: '2026-11-22', count: 4 },
  { day: '2026-11-23', count: 6 },
  { day: '2026-11-24', count: 8 },
  { day: '2026-11-25', count: 14 },
]

const sampleFunnel: FunnelStage[] = [
  {
    id: 'articles',
    label: 'Articles en vigueur balayés',
    count: 13950,
    sublabel: 'CGI (2 405) · CSS (7 419) · CCH (4 126)',
    detail:
      'Chaque version active à la date de projection DILA passe par 4 détecteurs déterministes sans LLM.',
    tone: 'neutral',
  },
  {
    id: 'links',
    label: 'Citations & liens analysés',
    count: 27578,
    sublabel: 'Liens LEGI sortants résolus contre l’historique complet des versions',
    detail: 'Un renvoi vers une version MODIFIE dont l’article reste en vigueur n’est pas compté comme mort.',
    tone: 'cobalt',
  },
  {
    id: 'reproduced',
    label: 'Constats reproduits par chaîne indépendante',
    count: 1119,
    sublabel: '1 110 renvois vers articles abrogés · 9 défauts typographiques (non qualifiés)',
    detail:
      'Reproduits depuis les XML DILA bruts et Tricoteuses. Accessibles aux agents et relecteurs avant verdict humain.',
    tone: 'amber',
  },
  {
    id: 'qualified',
    label: 'Anomalies qualifiées par un humain',
    count: 0,
    sublabel: 'Premier dossier prêt : 9 défauts typographiques',
    detail:
      'Seul un verdict humain commité dans Git fait passer un constat dans le compteur public des anomalies qualifiées.',
    tone: 'emerald',
  },
]

const sampleCases: EuroCase[] = [
  {
    id: 't1',
    name: 'Test1',
    status: 'failed',
    expected: 28524,
    actual: 28525,
    classification: 'ambiguïté',
    contextLabel: 'Placement d’arrondi (0,01 €)',
  },
  {
    id: 't2',
    name: 'Test2',
    status: 'passed',
    expected: 21646,
    actual: 21646,
    classification: null,
    contextLabel: 'Cas standard métropole',
  },
  {
    id: 't3',
    name: 'Test3',
    status: 'failed',
    expected: 2437,
    actual: 3966,
    classification: 'erreur_oracle',
    contextLabel: 'Guyane · enfant unique 13 ans (D755-5)',
  },
  {
    id: 't12',
    name: 'Test12',
    status: 'failed',
    expected: 31584,
    actual: 19245,
    classification: 'erreur_oracle',
    contextLabel: 'Mayotte · 4 enfants à charge (ord. 2002)',
  },
]

const sampleRace: RaceTrack[] = [
  {
    id: 'c01',
    title: 'Rejeu des tests Inria',
    subtitle: 'Catala 1.3.2 épinglé par digest',
    summary: '171/171 tests réussis · 8 suites actives',
    statusBadge: '100 % exécuté',
    statusTone: 'emerald',
    href: '/references',
    rungs: [
      {
        id: 'r1',
        label: 'Image Catala ARM64',
        state: 'done',
        detail: 'Image OCI construite et verrouillée par digest.',
      },
      {
        id: 'r2',
        label: '171 tests Inria',
        state: 'done',
        detail: 'Toutes les suites françaises passent sans erreur.',
      },
      {
        id: 'r3',
        label: 'Promotion ★',
        state: 'done',
        detail: 'Articles en vigueur reliés aux suites vertes.',
      },
    ],
  },
  {
    id: 'c02',
    title: 'C0.2 · Balayage mécanique',
    subtitle: '4 détecteurs sans LLM',
    summary: '1 119 constats reproduits · verdict attendu',
    statusBadge: 'Dossier prêt',
    statusTone: 'amber',
    href: '/anomalies',
    rungs: [
      { id: 'r1', label: 'Balayage #8', state: 'done', detail: '13 950 articles contrôlés.' },
      {
        id: 'r2',
        label: 'Reproduction XML DILA',
        state: 'done',
        detail: '1 110 REF_MORTE + 9 SYNTAXE confirmés.',
      },
      {
        id: 'r3',
        label: 'Verdict humain',
        state: 'blocked',
        detail: 'Premier lot de 9 défauts typographiques prêt à qualifier.',
      },
    ],
  },
]

const paletteTokens = [
  { name: 'Papier jaune-vert pâle', token: '--bg', cls: 'bg-bg border-line text-ink', hex: '#F5F6E9' },
  { name: 'Surface', token: '--surface', cls: 'bg-surface border-line text-ink', hex: '#FDFDF8' },
  { name: 'Papier appuyé', token: '--surface-2', cls: 'bg-surface-2 border-line text-ink', hex: '#EBEEDB' },
  { name: 'Encre', token: '--ink', cls: 'bg-ink border-ink text-bg', hex: '#16180F' },
  {
    name: 'Encre de tampon violette',
    token: '--brand',
    cls: 'bg-brand border-brand text-brand-ink',
    hex: '#4B2FB5',
  },
  { name: 'Surligneur', token: '--mark', cls: 'bg-mark border-line text-mark-ink', hex: '#FFF07A' },
  {
    name: 'Ambre vigilance',
    token: '--notice-bg',
    cls: 'bg-notice border-notice-line text-notice-ink',
    hex: '#FDF3D6',
  },
  {
    name: 'Séance de nuit',
    token: '--obs-bg',
    cls: 'bg-obs-bg border-obs-line-strong text-obs-ink',
    hex: '#17132B',
  },
]

function captureLiveSnapshot() {
  if (typeof window === 'undefined') return
  liveSnapshotText = JSON.stringify(getAgent().snapshot(), null, 2)
}

async function demoAgentAct() {
  if (typeof window === 'undefined') return
  const agent = getAgent()
  const res = await agent.act({
    steps: [{ ref: 'Mode agent actif', action: 'toggle' }],
  })
  actLog = res.ok
    ? `agent.act() réussi : valeur de l’interrupteur basculée à ${String(demoSwitch)} sans clic utilisateur.`
    : `Échec : ${res.error ?? 'inconnu'}`
  captureLiveSnapshot()
}

async function testMcpSnapshot() {
  mcpLoading = true
  try {
    const data = await executeDataTool('bugdeloi_mcp_call', {
      name: 'list_findings',
      arguments: { status: 'reproduced', limit: 3 },
    })
    mcpResponse = JSON.stringify(data, null, 2)
  } catch (e) {
    mcpResponse = e instanceof Error ? e.message : 'Erreur MCP'
  } finally {
    mcpLoading = false
  }
}

$effect(() => {
  captureLiveSnapshot()
})
</script>

<svelte:head>
  <title>Design System & WebMCP · BugDeLoi</title>
  <meta
    name="description"
    content="Système de design BugDeLoi : jetons, typographie, composants @ui-sdk/svelte pilotables par WebMCP, visualisations de données et serveur MCP."
  />
</svelte:head>

<section class="border-b border-line bg-surface">
  <div class="container-wide py-12 sm:py-16">
    <div class="flex flex-wrap items-end justify-between gap-6">
      <div class="max-w-3xl space-y-3">
        <h1 class="text-4xl sm:text-5xl">
          Système de design
        </h1>
        <p class="text-base leading-relaxed text-muted sm:text-lg">
          Catalogue des couleurs, des typographies et des composants du site. Les composants reposent sur <code class="text-ink">@ui-sdk/svelte</code> et Tailwind 4. Les agents peuvent les inspecter via WebMCP et <code class="text-ink">/api/mcp</code>. Documentation complète dans <code class="text-ink">docs/DESIGN.md</code>.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2.5">
        <Button variant="ink" size="sm" onclick={() => shell?.openAgent()}>
          <Bot class="size-4" aria-hidden="true" />
          Inspecteur MCP
        </Button>
      </div>
    </div>
  </div>
</section>

<div class="container-wide mt-14 space-y-20">
  <section aria-labelledby="ds-palette" class="space-y-6">
    <div class="flex items-baseline justify-between gap-4">
      <h2 id="ds-palette" class="text-3xl">Couleurs et surfaces</h2>
      <span class="mono text-xs text-muted">apps/web/src/tokens.css</span>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {#each paletteTokens as t (t.token)}
        <div class="flex min-h-24 flex-col justify-between rounded-[var(--radius)] border p-4 {t.cls}">
          <span class="font-semibold text-sm">{t.name}</span>
          <div class="flex items-baseline justify-between gap-2 pt-4">
            <span class="mono text-xs opacity-80">{t.token}</span>
            <span class="mono text-[0.7rem] opacity-70">{t.hex}</span>
          </div>
        </div>
      {/each}
    </div>

    <div class="space-y-4 border-t border-line pt-6">
      <p class="text-sm font-semibold text-ink">Niveaux de preuve N0–N5 et ★ (chaque couleur est doublée d’un motif SVG)</p>
      <div class="flex flex-wrap items-center gap-2.5">
        {#each LEVELS as lvl (lvl)}
          <div class="inline-flex items-center gap-2 rounded-[var(--radius)] bg-surface-2 px-3 py-1.5">
            <LevelSwatch level={lvl} size={18} />
            <span class="text-xs font-semibold text-ink">{levelName(lvl)}</span>
            <span class="mono text-[0.68rem] text-muted">{LEVEL_INFO[lvl].colorToken}</span>
          </div>
        {/each}
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <LevelBadge level="N0" />
        <LevelBadge level="N2" />
        <LevelBadge level="N4" />
        <LevelBadge level="N5" />
        <LevelBadge level="REF" />
        <LevelBadge level="N3" flags={['contested']} />
      </div>
    </div>
  </section>

  <section aria-labelledby="ds-typo" class="space-y-6 border-t border-line pt-14">
    <h2 id="ds-typo" class="text-3xl">Typographies</h2>
    <div class="grid gap-8 lg:grid-cols-3">
      <div class="space-y-2">
        <p class="font-law text-3xl font-semibold tracking-tight">Source Serif 4</p>
        <p class="text-xs text-muted">Réservée aux citations de textes officiels</p>
        <p class="pt-2 font-law text-base leading-relaxed text-ink">
          « Les allocations familiales sont dues à partir du deuxième enfant à charge. »
        </p>
      </div>
      <div class="space-y-2">
        <p class="font-display text-2xl font-extrabold tracking-tight [font-stretch:118%]">Archivo</p>
        <p class="text-xs text-muted">Titres élargis, interface et tableaux numériques</p>
        <p class="pt-2 text-sm leading-relaxed text-ink tabular">
          13 950 articles · 285,24 € · 171/171 tests
        </p>
      </div>
      <div class="space-y-2">
        <p class="font-mono text-xl font-semibold">JetBrains Mono</p>
        <p class="text-xs text-muted">Identifiants officiels, empreintes et code Catala</p>
        <p class="pt-2 font-mono text-xs leading-relaxed text-muted">
          LEGIARTI000006738575<br />
          POST /api/mcp → tools/call
        </p>
      </div>
    </div>
  </section>

  <section aria-labelledby="ds-primitives" class="space-y-8 border-t border-line pt-14">
    <h2 id="ds-primitives" class="text-3xl">Composants interactifs</h2>

    <div class="grid gap-10 lg:grid-cols-2">
      <div class="space-y-6">
        <div class="space-y-3">
          <h3 class="text-lg">Boutons et actions</h3>
          <div class="flex flex-wrap items-center gap-2.5">
            <Button variant="ink">Principal</Button>
            <Button variant="primary">Accent</Button>
            <Button variant="secondary">Secondaire</Button>
            <Button variant="soft">Doux</Button>
            <Button variant="ghost">Discret</Button>
            <Button variant="destructive" size="sm">Rejet</Button>
            <CopyButton text="https://bugdeloi.theonaciri.fr/api/mcp" label="Copier MCP" />
          </div>
        </div>

        <div class="space-y-3 border-t border-line pt-5">
          <h3 class="text-lg">Étiquettes d’état</h3>
          <div class="flex flex-wrap items-center gap-2">
            <Badge variant="brand" pulse>En direct</Badge>
            <Badge variant="amber">Avant verdict humain</Badge>
            <Badge variant="danger">Désaccord</Badge>
            <Badge variant="default">LEGIARTI</Badge>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-6 border-t border-line pt-5">
          <Switch
            bind:checked={demoSwitch}
            label="Mode agent actif"
            description="Pilotable par agent.act() en bas de page"
          />
          <SegmentedControl
            bind:value={demoSegment}
            ariaLabel="Style de présentation"
            size="sm"
            options={[
              { value: 'editorial', label: 'Éditorial' },
              { value: 'observatoire', label: 'Observatoire' },
              { value: 'compact', label: 'Compact' },
            ]}
          />
        </div>
      </div>

      <div class="space-y-6">
        <div class="space-y-3">
          <h3 class="text-lg">Panneaux, info-bulles et glossaire</h3>
          <div class="flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" onclick={() => (demoDialogOpen = true)}>
              Ouvrir un dialogue
            </Button>
            <Button variant="secondary" size="sm" onclick={() => (demoDrawerOpen = true)}>
              Ouvrir un panneau latéral
            </Button>
            <Tooltip text="Chaque constante d’un programme Catala doit citer l’alinéa LEGI qui la fixe.">
              <span class="rounded-[var(--radius)] bg-surface-2 px-3 py-1.5 text-xs font-medium cursor-help">
                Survoler (info-bulle)
              </span>
            </Tooltip>
          </div>
          <p class="pt-1 text-sm leading-relaxed text-muted">
            Définition contextuelle au survol : un constat
            <HoverCard>
              {#snippet trigger()}reproduit{/snippet}
              {#snippet content()}
                <p class="font-semibold text-ink">Constat reproduit</p>
                <p class="mt-1 text-xs leading-relaxed text-muted">
                  Confirmé par une chaîne indépendante, en attente d’un verdict humain signé.
                </p>
              {/snippet}
            </HoverCard>
            reste distinct d’une anomalie qualifiée.
          </p>
        </div>

        <div class="border-t border-line pt-5">
          <Tabs
            defaultValue="un"
            ariaLabel="Exemple d’onglets"
            items={[
              { value: 'un', label: 'Texte de loi' },
              { value: 'deux', label: 'Code Catala' },
              { value: 'trois', label: 'Impact €' },
            ]}
          >
            {#snippet panel(tab)}
              {#if tab === 'un'}
                <p class="font-display text-sm text-ink">Article D755-5, II, alinéa 2 : version en vigueur identifiée par son empreinte SHA-256.</p>
              {:else if tab === 'deux'}
                <pre class="mono rounded bg-obs-bg p-3 text-xs text-obs-ink"><code>champ d'application CalculAllocations:
  définition montant_mensuel égal à ...</code></pre>
              {:else}
                <p class="text-sm text-muted">Guyane (enfant unique 13 ans) : <strong class="text-ko">+15,29 € / mois</strong>.</p>
              {/if}
            {/snippet}
          </Tabs>
        </div>
      </div>
    </div>

    <Accordion
      defaultValue={['a1']}
      items={[
        {
          value: 'a1',
          title: 'Pourquoi @ui-sdk/svelte ?',
          meta: 'Apache-2.0',
          content:
            'Chaque composant rejoint automatiquement le registre WebMCP : un agent inspecte l’état de la page via snapshot() et active les contrôles via act() sans scraping DOM.',
        },
        {
          value: 'a2',
          title: 'Accessibilité et daltonisme',
          meta: 'WCAG 2.2 AA',
          content:
            'Chaque niveau de preuve associe couleur, motif géométrique SVG et texte. Tous les composants fonctionnent au clavier et respectent prefers-reduced-motion.',
        },
      ]}
    />
  </section>

  <section aria-labelledby="ds-viz" class="space-y-10 border-t border-line pt-14">
    <h2 id="ds-viz" class="text-3xl">Visualisations de données</h2>

    <div class="grid gap-12 lg:grid-cols-[24rem_1fr]">
      <div class="space-y-4">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-xl">Entonnoir de contrôle</h3>
          <Sparkline points={sampleSpark} label="14 j" />
        </div>
        <SweepFunnel stages={sampleFunnel} />
      </div>

      <div class="space-y-4">
        <h3 class="text-xl">Comparateur de montants en euros</h3>
        <C03EuroBars cases={sampleCases} />
      </div>
    </div>

    <div class="border-t border-line pt-10 space-y-4">
      <h3 class="text-xl">Échelle de preuve interactive</h3>
      <ProofScaleInteractive
        counts={{ N0: 13840, N1: 0, N2: 0, N3: 0, N4: 0, N5: 0, REF: 110 }}
      />
    </div>
  </section>
</div>

<section class="band-observatory mt-20 py-18" aria-labelledby="ds-obs">
  <div class="container-wide space-y-14">
    <div class="space-y-6">
      <h2 id="ds-obs" class="text-3xl text-obs-ink">
        Avancement des chantiers
      </h2>
      <ChantierRace tracks={sampleRace} />
    </div>

    <div class="space-y-6 border-t border-obs-line pt-12">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="space-y-1">
          <h2 class="text-3xl text-obs-ink">
            Tester MCP et WebMCP en direct
          </h2>
          <p class="text-sm text-obs-muted">
            Pilotez l’interrupteur ci-dessus par code agent ou appelez le serveur MCP en lecture seule.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button variant="observatory" size="sm" onclick={demoAgentAct}>
            <Play class="size-3.5" aria-hidden="true" />
            Basculer le Switch via agent.act()
          </Button>
          <Button variant="observatoryOutline" size="sm" onclick={captureLiveSnapshot}>
            Capturer snapshot()
          </Button>
          <Button variant="observatoryOutline" size="sm" onclick={testMcpSnapshot}>
            Appeler POST /api/mcp
          </Button>
        </div>
      </div>

      {#if actLog}
        <p class="flex items-center gap-2 rounded-[var(--radius)] bg-obs-surface px-4 py-3 text-xs text-obs-emerald">
          <CheckCircle2 class="size-4 shrink-0" aria-hidden="true" />
          <span>{actLog}</span>
        </p>
      {/if}

      <div class="grid gap-6 lg:grid-cols-2">
        <div class="card-obs p-5 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <span class="mono text-xs font-semibold text-obs-ink">
              WebMCP · agent.snapshot() ({agentTools.length} outils UI · {DATA_TOOLS.length} outils données)
            </span>
            <CopyButton text={liveSnapshotText} label="Copier" tone="observatory" size="xs" />
          </div>
          <pre class="max-h-72 overflow-auto rounded bg-black/40 p-3.5 text-[0.72rem] leading-relaxed text-obs-ink/90"><code>{liveSnapshotText || 'Chargement du registre @ui-sdk/svelte…'}</code></pre>
        </div>

        <div class="card-obs p-5 space-y-3">
          <div class="flex items-center justify-between gap-2">
            <span class="mono text-xs font-semibold text-obs-ink">
              Serveur MCP · POST /api/mcp (list_findings)
            </span>
            <a href="/api/mcp" class="mono text-xs text-obs-emerald no-underline hover:underline">GET /api/mcp →</a>
          </div>
          {#if mcpLoading}
            <p class="mono py-6 text-xs text-obs-emerald">Appel JSON-RPC 2.0 en cours…</p>
          {:else if mcpResponse}
            <pre class="max-h-72 overflow-auto rounded bg-black/40 p-3.5 text-[0.72rem] leading-relaxed text-obs-ink/90"><code>{mcpResponse}</code></pre>
          {:else}
            <p class="py-6 text-sm text-obs-muted">
              Cliquez sur <strong class="text-obs-ink">Appeler POST /api/mcp</strong> pour consulter les constats reproduits avant qualification humaine.
            </p>
          {/if}
        </div>
      </div>
    </div>
  </div>
</section>

<Dialog
  bind:open={demoDialogOpen}
  title="Dialogue du Design System"
  description="Construit sur @ui-sdk/svelte/dialog : piège de focus, touche Échap, zéro attribut style en SSR."
>
  <p class="text-sm text-muted">
    Ce dialogue est enregistré dans le pont agent WebMCP dès son montage. Un agent peut lire son titre, ses actions et le fermer proprement.
  </p>
  <div class="mt-5 flex justify-end gap-2">
    <Button variant="secondary" size="sm" onclick={() => (demoDialogOpen = false)}>Fermer</Button>
  </div>
</Dialog>

<Drawer
  bind:open={demoDrawerOpen}
  side="right"
  title="Panneau latéral (Drawer)"
  description="Idéal pour inspecter un article, un constat ou le flux WebMCP sans perdre son contexte."
>
  <p class="text-sm text-muted leading-relaxed">
    Ce panneau glisse depuis le bord droit, gère la restauration du focus et partage les mêmes jetons graphiques que le reste du site.
  </p>
</Drawer>
