<script lang="ts">
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  Scale,
  Terminal,
} from '@lucide/svelte'
import EmptyState from '#lib/components/EmptyState.svelte'
import {
  Badge,
  Button,
  CopyButton,
  HoverCard,
  SegmentedControl,
  Tabs,
  Tooltip,
} from '#lib/components/ui/index.ts'
import {
  C03EuroBars,
  ChantierRace,
  type FunnelStage,
  HomeTreemap,
  ProofScaleInteractive,
  type RaceTrack,
  SinceLastVisit,
  Sparkline,
  SweepFunnel,
} from '#lib/components/viz/index.ts'
import { getShellActions } from '#lib/context/shell.ts'
import { explainEvent } from '#lib/events.ts'
import { formatDateTime, formatInt, formatLegiDate, plural } from '#lib/format.ts'
import { addCounts, emptyLevelCounts } from '#lib/levels.ts'
import type { PublicEvent, Snapshot } from '#lib/snapshot.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()
const shell = getShellActions()

let live = $state<Snapshot | null>(null)
let sseConnected = $state(false)
let findingFilter = $state('all')
let pipeBarWidth = $state(360)

const snap = $derived(live ?? data.snapshot)
const example = $derived(snap?.referenceExample ?? null)

const totals = $derived.by(() => {
  const counts = emptyLevelCounts()
  for (const code of snap?.codes ?? []) addCounts(counts, code.byLevel)
  return counts
})

const inForceTotal = $derived((snap?.codes ?? []).reduce((sum, code) => sum + code.inForce, 0))
const totalInriaTests = $derived((snap?.suites ?? []).reduce((sum, suite) => sum + suite.passed, 0))
const activeSuites = $derived((snap?.suites ?? []).filter((s) => s.tests > 0))
const latestEvent = $derived(snap?.events?.[0] ?? null)

const pipeW = $derived(Math.max(120, Math.round(pipeBarWidth)))
const pipelineBar = $derived.by(() => {
  const repr = snap?.pipeline.reproducedCount ?? 0
  const withdrawn = snap?.pipeline.withdrawnCount ?? 0
  const pub = snap?.findings.public ?? 0
  const total = Math.max(1, repr + withdrawn + pub)
  const wRepr = Math.round((repr / total) * pipeW)
  const wWith = Math.round((withdrawn / total) * pipeW)
  const wPub = Math.max(0, pipeW - wRepr - wWith)
  return { wRepr, wWith, wPub }
})

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const fmtEur = (cents: number) => euros.format(cents / 100)
const fmtDelta = (cents: number) => `${cents > 0 ? '+' : ''}${euros.format(cents / 100)}`

function relativeTime(iso: string): string {
  const diffSec = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000))
  if (diffSec < 60) return `il y a ${diffSec} s`
  const min = Math.round(diffSec / 60)
  if (min < 60) return `il y a ${min} min`
  const hrs = Math.round(min / 60)
  if (hrs < 24) return `il y a ${hrs} h`
  const days = Math.round(hrs / 24)
  return `il y a ${days} j`
}

/** Traduit un identifiant technique d’acteur en libellé lisible par le grand public. */
function humanActor(actor: string): string {
  if (actor === 'system:c0.1') return 'Rejeu des programmes Inria'
  if (actor === 'system:sweep') return 'Contrôle mécanique des codes'
  if (actor === 'system:ingest') return 'Import officiel DILA'
  if (actor.startsWith('claude/')) return 'Vérification indépendante · Anthropic'
  if (actor.startsWith('codex/')) return 'Vérification indépendante · OpenAI'
  if (actor.startsWith('google/')) return 'Vérification indépendante · Google'
  if (actor.startsWith('github:')) return `@${actor.slice(7)}`
  return actor
}

/** Résume la portée d’un événement sans exposer d’empreintes brutes dans le fil éditorial. */
function humanDetail(ev: PublicEvent): string {
  if (ev.summary) return ev.summary
  if (ev.type === 'reference.promoted')
    return 'Rapprochement des suites Inria réussies avec les versions en vigueur.'
  if (ev.type === 'reproduction.finished') {
    if (ev.subject?.startsWith('c0.2-dila-xml'))
      return 'Contrôle croisé depuis les archives XML brutes de la DILA.'
    if (ev.subject?.startsWith('c0.2-independent'))
      return 'Contrôle croisé sur la base indépendante « La loi sous git ».'
    return 'Vérification indépendante des constats mécaniques.'
  }
  if (ev.type === 'replication.finished') return 'Exécution complète des suites de tests Catala.'
  if (ev.type === 'ingest.finished') return 'Mise à jour incrémentale des textes officiels LEGI.'
  return explainEvent(ev.type).why
}

const claudeMcpCommand = $derived(`claude mcp add --transport http bugdeloi ${data.origin}/api/mcp`)
const joinCommand = $derived(`Lis ${data.origin}/join.txt et connecte le serveur MCP ${data.origin}/api/mcp`)

const filteredFindings = $derived.by(() => {
  const list = snap?.reproducedPreview ?? []
  if (findingFilter === 'SYNTAXE') return list.filter((f) => f.type === 'SYNTAXE')
  if (findingFilter === 'REF_MORTE') return list.filter((f) => f.type === 'REF_MORTE')
  return list
})

const funnelStages = $derived.by<FunnelStage[]>(() => {
  const p = snap?.pipeline
  const syntaxe = p?.reproducedByType.SYNTAXE ?? 0
  const refMorte = p?.reproducedByType.REF_MORTE ?? 0
  return [
    {
      id: 'articles',
      label: 'Articles en vigueur contrôlés',
      count: p?.articlesChecked ?? inForceTotal,
      sublabel: 'Code général des impôts, Sécurité sociale, Construction et habitation',
      detail:
        'Chaque article en vigueur à la date officielle de la DILA est examiné par 4 programmes déterministes sans intelligence artificielle.',
      tone: 'neutral',
    },
    {
      id: 'links',
      label: 'Liens entre textes analysés',
      count: p?.linksTotal ?? 0,
      sublabel: 'Citations, modifications, créations et abrogations suivies dans le temps',
      detail:
        'Un renvoi vers une ancienne version d’un article toujours en vigueur n’est pas signalé comme mort : nous reconstruisons la lignée complète de chaque article.',
      tone: 'cobalt',
    },
    {
      id: 'reproduced',
      label: 'Constats reproduits avant verdict humain',
      count: p?.reproducedCount ?? 0,
      sublabel: `${formatInt(refMorte)} renvois vers un article abrogé · ${formatInt(syntaxe)} défauts typographiques`,
      detail:
        'Confirmés par deux vérifications indépendantes (archives XML DILA brutes et Tricoteuses). Ouverts à la consultation pour les juristes, journalistes et agents.',
      tone: 'amber',
    },
    {
      id: 'qualified',
      label: 'Anomalies qualifiées par un humain',
      count: snap?.findings.public ?? 0,
      sublabel: 'Premier lot de 9 défauts typographiques prêt pour relecture signée',
      detail:
        'Règle du projet : aucun constat n’entre dans le compteur des anomalies qualifiées tant qu’un relecteur humain n’a pas publié un verdict motivé.',
      tone: 'emerald',
    },
  ]
})

const raceTracks = $derived.by<RaceTrack[]>(() => {
  const p = snap?.pipeline
  return [
    {
      id: 'c01',
      title: 'Rejeu des programmes de recherche',
      subtitle: 'Suites Catala d’Inria et de la DGFiP',
      summary: `${formatInt(totalInriaTests)} tests verts · ${activeSuites.length} suites`,
      statusBadge: '100 % reproduit',
      statusTone: 'emerald',
      href: '/references',
      rungs: [
        {
          id: 'img',
          label: 'Environnement Catala figé',
          state: 'done',
          detail:
            'Compilateur Catala 1.3.2 verrouillé par empreinte cryptographique pour rejouer à l’identique.',
        },
        {
          id: 'af',
          label: 'Allocations familiales (32 tests)',
          state: 'done',
          detail: '32 tests Inria rejoués avec succès.',
        },
        {
          id: 'apl',
          label: 'Aides au logement (68 tests)',
          state: 'done',
          detail: '68 tests Inria rejoués avec succès.',
        },
        {
          id: 'ir',
          label: 'Impôt sur le revenu (54 tests)',
          state: 'done',
          detail: '54 tests DGFiP / Inria rejoués avec succès.',
        },
        {
          id: 'other',
          label: 'Successions & aides (17 tests)',
          state: 'done',
          detail: 'Successions (8), ASP (7) et prestations familiales (2) rejoués.',
        },
        {
          id: 'ref',
          label: 'Report sur la carte ★',
          state: 'done',
          detail: `${formatInt(totals.REF)} articles en vigueur reliés sur la carte publique.`,
        },
      ],
    },
    {
      id: 'c02',
      title: 'Détection mécanique d’anomalies',
      subtitle: 'Renvois abrogés, numérotation et typographie',
      summary: `${formatInt(p?.reproducedCount ?? 0)} reproduits · ${formatInt(p?.withdrawnCount ?? 0)} écartés`,
      statusBadge: 'En attente de verdict',
      statusTone: 'amber',
      href: '/anomalies',
      rungs: [
        {
          id: 'ing',
          label: 'Chargement des 3 codes',
          state: 'done',
          detail: `${formatInt(inForceTotal)} articles en vigueur et ${formatInt(p?.linksTotal ?? 0)} liens officiels chargés.`,
        },
        {
          id: 'det',
          label: 'Balayage déterministe',
          state: 'done',
          detail: 'Quatre détecteurs sans IA exécutés sur l’ensemble des textes en vigueur.',
        },
        {
          id: 'ind1',
          label: 'Contre-vérification n° 1',
          state: 'done',
          detail: '9 défauts typographiques confirmés ; 7 faux positifs détectés et retirés.',
        },
        {
          id: 'ind2',
          label: 'Contre-vérification XML DILA',
          state: 'done',
          detail: '1 110 renvois vers articles abrogés confirmés sur les archives brutes DILA.',
        },
        {
          id: 'qual',
          label: 'Relecture humaine',
          state: 'blocked',
          detail: 'Premier dossier prêt pour qualification signée par un juriste ou le mainteneur.',
        },
        {
          id: 'pub',
          label: 'Publication au registre',
          state: 'todo',
          detail: 'Entrée au registre public des anomalies qualifiées.',
        },
      ],
    },
    {
      id: 'c03',
      title: 'Expérience · Allocations familiales',
      subtitle: 'Traduire la loi à l’aveugle sans voir Inria',
      summary: `${data.c03.scores.completed.passed} sur ${data.c03.scores.completed.total} cas · 2 écarts étudiés`,
      statusBadge: 'Contre-vérifié',
      statusTone: 'cobalt',
      href: '/experiences/allocations-familiales',
      rungs: [
        {
          id: 'pack',
          label: 'Paquet légal isolé',
          state: 'done',
          detail: 'Seuls les articles officiels LEGI et l’interface de calcul sont fournis.',
        },
        {
          id: 'sub',
          label: 'Traduction exécutable',
          state: 'done',
          detail: 'Programme Catala compilé sans erreur.',
        },
        {
          id: 'audit',
          label: 'Comparaison chiffrée (12/17)',
          state: 'done',
          detail: '10 montants exacts au centime, 3 écarts d’arrondi de 0,01 €, 2 désaccords substantiels.',
        },
        {
          id: 'xcheck',
          label: 'Double relecture croisée',
          state: 'done',
          detail: 'Deux familles indépendantes (Anthropic et Google) ont audité les cas Guyane et Mayotte.',
        },
        {
          id: 'hum',
          label: 'Arbitrage juriste',
          state: 'blocked',
          detail: 'Relecture juridique attendue sur les deux écarts contre le témoin Inria.',
        },
        {
          id: 'n4',
          label: 'Tests massifs (10 000 foyers)',
          state: 'todo',
          detail: 'Passage à l’étape différentielle complète.',
        },
      ],
    },
    {
      id: 'c04_06',
      title: 'Prochain chantier · Impôt sur le revenu',
      subtitle: 'Barème, quotient familial, décote et effets de seuil',
      summary: 'Ouverture aux contributions',
      statusBadge: 'À venir',
      statusTone: 'muted',
      href: '/join',
      rungs: [
        {
          id: 'desk',
          label: 'Guichet & serveur MCP',
          state: 'done',
          detail: 'Accès ouvert aux agents IA et distribution de tâches prêts.',
        },
        {
          id: 'c04',
          label: 'Ambiguïtés connues',
          state: 'todo',
          detail: 'Mesurer la capacité à retrouver les 21 questions juridiques déjà notées par Inria.',
        },
        {
          id: 'c05',
          label: 'Noyau IR (art. 193–197)',
          state: 'todo',
          detail: 'Formalisation vérifiée contre le BOFiP et OpenFisca.',
        },
        {
          id: 'c06',
          label: 'Détecteur d’effets de seuil',
          state: 'todo',
          detail: 'Mesure automatique des taux marginaux effectifs et effets de falaise.',
        },
      ],
    },
  ]
})

// Abonnement temps réel (SSE) avec repli en polling toutes les 30 s.
$effect(() => {
  let es: EventSource | null = null
  let poll: ReturnType<typeof setInterval> | null = null
  const refresh = async () => {
    try {
      const r = await fetch('/api/snapshot.json', { headers: { accept: 'application/json' } })
      if (r.ok) live = (await r.json()) as Snapshot
    } catch {
      // réseau indisponible : nouvel essai au prochain cycle
    }
  }
  const startPolling = () => {
    sseConnected = false
    poll ??= setInterval(refresh, 30_000)
  }
  const stopPolling = () => {
    if (poll) clearInterval(poll)
    poll = null
  }
  if (typeof EventSource === 'undefined') {
    startPolling()
  } else {
    es = new EventSource('/api/stream')
    es.addEventListener('open', () => {
      sseConnected = true
    })
    es.addEventListener('snapshot', (e) => {
      try {
        live = JSON.parse((e as MessageEvent<string>).data) as Snapshot
        sseConnected = true
        stopPolling()
      } catch {
        // message illisible : ignoré
      }
    })
    es.onerror = () => startPolling()
  }
  return () => {
    es?.close()
    stopPolling()
  }
})
</script>

<svelte:head>
  <title>BugDeLoi — observer et vérifier le droit calculable français en direct</title>
  <meta
    name="description"
    content="Observatoire ouvert du droit calculable français : 13 950 articles en vigueur, 171 tests Inria rejoués, impact en euros et constats reproductibles avant qualification humaine."
  />
</svelte:head>

<!-- BANDE 0 : Fil d'actualité « À l'instant » (plein bord, façon presse / pequalnp.com) -->
{#if latestEvent}
  <div class="bg-obs-bg text-obs-ink">
    <div class="container-wide flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 py-3 text-xs sm:text-[0.82rem]">
      <div class="flex min-w-0 items-center gap-3">
        <span class="inline-flex shrink-0 items-center gap-2 font-semibold uppercase tracking-wider text-obs-amber">
          <span class="live-dot" aria-hidden="true"></span>
          Dernière avancée
        </span>
        <a
          href={`/evenement/${latestEvent.id}`}
          class="truncate text-obs-ink/95 no-underline hover:text-obs-emerald hover:underline"
        >
          {explainEvent(latestEvent.type).title} — {humanDetail(latestEvent)}
        </a>
      </div>
      <div class="flex shrink-0 items-center gap-3 text-obs-muted">
        <time datetime={latestEvent.ts}>{relativeTime(latestEvent.ts)}</time>
        <span aria-hidden="true">·</span>
        <a
          href={`/evenement/${latestEvent.id}`}
          class="inline-flex items-center gap-1 font-semibold text-obs-amber no-underline hover:underline"
        >
          Voir le détail
          <ArrowRight class="size-3.5" aria-hidden="true" />
        </a>
      </div>
    </div>
  </div>
{/if}

<!-- BANDE 1 : HERO ÉDITORIAL OUVERT (plein espace, zéro boîte autour des chiffres) -->
<section class="bg-bg" aria-labelledby="hero-title">
  <div class="container-wide py-12 sm:py-16 lg:py-20">
    <!-- Ligne d'état en direct discrète -->
    <div class="flex flex-wrap items-center justify-between gap-4 pb-10 border-b border-line/70">
      <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <span class="inline-flex items-center gap-2 font-semibold text-ink">
          <span class="live-dot" aria-hidden="true"></span>
          {sseConnected ? 'Suivi en direct actif' : 'Observatoire ouvert'}
        </span>
        <span>·</span>
        <a href="/references" class="text-ink no-underline hover:underline">
          <strong>{formatInt(totalInriaTests)}</strong> tests Inria rejoués
        </a>
        <span>·</span>
        <a href="#constats-c02" class="text-ink no-underline hover:underline">
          <strong>{formatInt(snap?.pipeline.reproducedCount ?? 0)}</strong> constats reproduits
        </a>
        <span>·</span>
        <a href="/experiences/allocations-familiales" class="text-ink no-underline hover:underline">
          Allocations familiales : <strong>{data.c03.scores.completed.passed}/{data.c03.scores.completed.total}</strong>
        </a>
      </div>
      <div class="flex items-center gap-2">
        <CopyButton text={joinCommand} label="Copier la ligne agent" size="xs" />
      </div>
    </div>

    <!-- Grille éditoriale ouverte : 7 colonnes lecture / 5 colonnes fil en direct -->
    <div class="mt-10 grid gap-12 lg:grid-cols-12 lg:items-start lg:gap-14">
      <div class="lg:col-span-7 space-y-8">
        <div class="space-y-4">
          <h1
            id="hero-title"
            class="font-serif text-[2.75rem] font-semibold leading-[1.03] tracking-tight text-ink sm:text-[3.85rem] lg:text-[4.4rem]"
          >
            Vérifier la loi française comme un logiciel.
          </h1>
          <p class="font-serif text-xl italic leading-relaxed text-muted sm:text-[1.45rem]">
            Nous transformons les règles de calcul des codes officiels en programmes ouverts, pour mesurer leur impact concret en euros et repérer leurs incohérences.
          </p>
        </div>

        <p class="max-w-[60ch] text-base leading-relaxed text-muted">
          Chaque article provient de la base officielle de la DILA et est relié à une formalisation en
          <HoverCard>
            {#snippet trigger()}Catala{/snippet}
            {#snippet content()}
              <p class="font-semibold text-ink">Langage Catala (Inria)</p>
              <p class="mt-1 text-xs leading-relaxed text-muted">
                Un langage créé par des chercheurs d’Inria pour écrire le programme juste sous chaque alinéa de la loi, afin que juristes et informaticiens puissent le relire ensemble.
              </p>
            {/snippet}
          </HoverCard>.
          Les intelligences artificielles proposent et contre-vérifient, mais seuls les tests reproductibles et la relecture humaine font foi.
        </p>

        <!-- Compteurs typographiques ouverts — zéro boîte carrée -->
        {#if snap}
          <dl class="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-line py-7 sm:grid-cols-4">
            <div>
              <dt class="text-xs font-medium text-muted">Articles en vigueur</dt>
              <dd class="font-serif mt-1 text-3xl font-semibold tabular text-ink sm:text-4xl">
                {formatInt(inForceTotal)}
              </dd>
              <dd class="mt-1 text-xs text-subtle">{formatInt(snap.pipeline.linksTotal)} liens suivis</dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-muted">Références Inria</dt>
              <dd class="font-serif mt-1 text-3xl font-semibold tabular text-brand-strong sm:text-4xl">
                {formatInt(totals.REF)} ★
              </dd>
              <dd class="mt-1 text-xs text-subtle">{formatInt(totalInriaTests)} tests verts</dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-muted">Test aveugle</dt>
              <dd class="font-serif mt-1 text-3xl font-semibold tabular text-ink sm:text-4xl">
                {data.c03.scores.completed.passed}/{data.c03.scores.completed.total}
              </dd>
              <dd class="mt-1 text-xs text-subtle">2 écarts contre Inria</dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-muted">Constats reproduits</dt>
              <dd class="font-serif mt-1 text-3xl font-semibold tabular text-notice-ink sm:text-4xl">
                {formatInt(snap.pipeline.reproducedCount)}
              </dd>
              <dd class="mt-1 text-xs text-subtle">{formatInt(snap.findings.public)} qualifiés humains</dd>
            </div>
          </dl>

          <p class="text-xs text-muted">
            <strong class="font-semibold text-ink">Un compte, pas une probabilité.</strong>
            Tous les chiffres sont calculés directement sur nos données publiques.
            <a href="/methode#compteurs">Voir comment ils sont calculés →</a>
          </p>
        {:else}
          <EmptyState title="Les chiffres en direct sont temporairement indisponibles.">
            Consultez <a href="/status">l’état du service</a>.
          </EmptyState>
        {/if}

        <div class="flex flex-wrap items-center gap-3 pt-1">
          <Button href="#impact-euros" variant="ink" size="lg">
            Voir l’impact concret en euros
            <ArrowRight class="size-4" aria-hidden="true" />
          </Button>
          <Button href="#carte-vivante" variant="secondary" size="lg">
            Explorer la carte des codes
          </Button>
        </div>
      </div>

      <!-- Colonne droite : Fil éditorial en direct, sans boîtes imbriquées ni débordement -->
      <aside
        class="lg:col-span-5 lg:border-l lg:border-line lg:pl-10 space-y-6 min-w-0"
        aria-labelledby="live-panel-title"
      >
        <div class="flex items-baseline justify-between gap-3">
          <h2 id="live-panel-title" class="kicker flex items-center gap-2 text-ink">
            <span class="live-dot" aria-hidden="true"></span>
            Activité récente · En direct
          </h2>
          <a href="/journal" class="text-xs font-semibold text-brand-strong no-underline hover:underline">
            Tout le journal →
          </a>
        </div>

        {#if snap && snap.events.length > 0}
          <ul class="divide-y divide-line border-t border-line">
            {#each snap.events.slice(0, 4) as ev (ev.id)}
              <li class="py-4 min-w-0">
                <div class="flex items-baseline justify-between gap-3 text-xs">
                  <span class="font-semibold text-brand-strong truncate min-w-0">{humanActor(ev.actor)}</span>
                  <time datetime={ev.ts} class="shrink-0 text-subtle tabular">{relativeTime(ev.ts)}</time>
                </div>
                <p class="mt-1 font-serif text-[1.08rem] font-medium leading-snug text-ink">
                  {explainEvent(ev.type).title}
                </p>
                <p class="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
                  {humanDetail(ev)}
                </p>
                <div class="mt-2">
                  <a
                    href={`/evenement/${ev.id}`}
                    class="inline-flex items-center gap-1 text-xs font-semibold text-ink no-underline hover:text-brand-strong hover:underline"
                  >
                    Consulter la fiche
                    <ArrowRight class="size-3" aria-hidden="true" />
                  </a>
                </div>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="text-sm text-muted">En attente des premières opérations publiques.</p>
        {/if}

        {#if snap}
          <div class="space-y-4 border-t border-line pt-5">
            <div class="flex flex-wrap items-end justify-between gap-4">
              <Sparkline points={snap.activitySeries} label="Rythme des 14 derniers jours" />
              <div class="text-left sm:text-right">
                <p class="text-xs text-muted">En file de relecture humaine</p>
                <p class="font-serif text-xl font-semibold tabular text-ink">
                  {formatInt(snap.pipeline.reproducedCount)} constats
                </p>
              </div>
            </div>

            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <span class="font-medium text-ink">Avancement du contrôle des textes</span>
                <Tooltip text="Constats reproduits par machine : ouverts à la lecture, mais comptés séparément des anomalies qualifiées par un humain.">
                  <span class="text-muted cursor-help">Avant verdict humain</span>
                </Tooltip>
              </div>
              <div bind:clientWidth={pipeBarWidth}>
                <svg viewBox="0 0 {pipeW} 6" width={pipeW} height="6" class="block h-[6px] w-full" aria-hidden="true">
                  <rect x="0" y="0" width={pipeW} height="6" rx="3" fill="var(--surface-2)" />
                  <rect x="0" y="0" width={pipelineBar.wRepr} height="6" rx="3" fill="var(--notice-line)" />
                  {#if pipelineBar.wWith > 0}
                    <rect x={pipelineBar.wRepr} y="0" width={pipelineBar.wWith} height="6" fill="var(--line-strong)" />
                  {/if}
                  {#if pipelineBar.wPub > 0}
                    <rect x={pipelineBar.wRepr + pipelineBar.wWith} y="0" width={pipelineBar.wPub} height="6" fill="var(--brand)" />
                  {/if}
                </svg>
              </div>
              <div class="flex justify-between text-xs text-muted tabular">
                <span>{formatInt(snap.pipeline.reproducedCount)} reproduits · {formatInt(snap.pipeline.withdrawnCount)} écartés</span>
                <span>{formatInt(snap.findings.public)} qualifiés</span>
              </div>
            </div>
          </div>
        {/if}
      </aside>
    </div>
  </div>
</section>

<!-- BANDE 2 : IMPACT CONCRET EN EUROS & FICHES PRÉ-QUALIFICATION (plein fond blanc aéré) -->
<section id="impact-euros" class="border-t border-line bg-surface py-16 sm:py-24" aria-labelledby="impact-title">
  <div class="container-wide space-y-10">
    <div class="max-w-3xl space-y-3">
      <p class="kicker flex items-center gap-2 text-brand-strong">
        <Scale class="size-3.5" aria-hidden="true" />
        Ce que change concrètement la loi
      </p>
      <h2 id="impact-title" class="font-serif text-3xl font-semibold text-ink sm:text-5xl">
        De l’article officiel au montant en euros — et aux défauts repérés
      </h2>
      <p class="text-base leading-relaxed text-muted sm:text-lg">
        Explorez des situations concrètes chiffrées, consultez les constats reproduits avant même le verdict humain, ou comparez un article officiel à son programme de référence.
      </p>
    </div>

    <Tabs
      defaultValue="c03"
      ariaLabel="Explorations concrètes de BugDeLoi"
      items={[
        { value: 'c03', label: 'Allocations familiales · impact en €', badge: '14 cas' },
        { value: 'constats', label: 'Constats reproduits avant verdict', badge: formatInt(snap?.pipeline.reproducedCount ?? 0) },
        { value: 'inria', label: 'Loi et programme Inria ★', badge: `${formatInt(totals.REF)} ★` },
      ]}
    >
      {#snippet panel(tab)}
        {#if tab === 'c03'}
          <div class="space-y-12 pt-3">
            <!-- Deux grandes vignettes éditoriales sans bordures dures : Guyane & Mayotte -->
            <div class="grid gap-6 lg:grid-cols-2">
              {#each data.c03.spotlights as spot (spot.name)}
                {@const delta = spot.actualCents - spot.expectedCents}
                <article class="flex flex-col justify-between gap-6 rounded-[var(--radius-xl)] bg-bg p-7 sm:p-8">
                  <div class="space-y-4">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="danger">{spot.name} · Écart en cours d’arbitrage</Badge>
                      <span class="font-serif text-2xl font-semibold tabular text-ko">
                        {fmtDelta(delta)} <span class="text-sm font-normal text-muted">/ mois</span>
                      </span>
                    </div>
                    <div>
                      <h3 class="font-serif text-2xl font-semibold text-ink">{spot.territory}</h3>
                      <p class="mt-2 text-sm leading-relaxed text-muted">{spot.summary}</p>
                    </div>

                    <dl class="grid grid-cols-2 gap-6 border-t border-line pt-4">
                      <div>
                        <dt class="text-xs text-muted">Attendu par le témoin Inria</dt>
                        <dd class="font-serif mt-1 text-2xl font-semibold tabular text-ink">
                          {fmtEur(spot.expectedCents)}
                        </dd>
                      </div>
                      <div>
                        <dt class="text-xs text-muted">Calculé depuis le texte LEGI</dt>
                        <dd class="font-serif mt-1 text-2xl font-semibold tabular text-brand-strong">
                          {fmtEur(spot.actualCents)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div class="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs">
                    <a href={spot.articleUrl} rel="external" class="inline-flex items-center gap-1 font-medium">
                      {spot.articleLabel}
                      <ExternalLink class="size-3" aria-hidden="true" />
                    </a>
                    <div class="flex flex-wrap items-center gap-1.5">
                      {#each spot.verifications as v (v.url ?? v.family)}
                        <Badge variant="brand" size="sm">
                          Revue {v.family ?? 'indépendante'} · {v.verdict ?? 'rapport'}
                        </Badge>
                      {/each}
                    </div>
                  </div>
                </article>
              {/each}
            </div>

            <!-- Comparateur des 14 montants mensuels directement sur la page (sans boîte englobante) -->
            <div class="space-y-5">
              <div class="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <h3 class="font-serif text-2xl font-semibold text-ink">
                    Tous les montants mensuels comparés (témoin Inria vs traduction aveugle)
                  </h3>
                  <p class="mt-1 text-sm text-muted">
                    Résultat provisoire non relu par un humain · cliquez sur une ligne pour comprendre l’écart.
                  </p>
                </div>
                <a
                  href="/experiences/allocations-familiales"
                  class="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-strong no-underline hover:underline"
                >
                  Ouvrir l’étude complète
                  <ArrowRight class="size-4" aria-hidden="true" />
                </a>
              </div>
              <C03EuroBars cases={data.c03.cases} />
            </div>
          </div>
        {:else if tab === 'constats'}
          <div id="constats-c02" class="space-y-8 pt-3">
            <div class="flex flex-wrap items-start justify-between gap-4 rounded-[var(--radius-lg)] bg-notice/75 p-5 text-sm text-notice-ink">
              <div class="flex items-start gap-3 max-w-4xl">
                <AlertTriangle class="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                <div>
                  <p class="font-semibold">Constats ouverts avant qualification humaine</p>
                  <p class="mt-1 text-xs leading-relaxed">
                    Ces fiches ont été <strong>reproduites indépendamment</strong> sur les données officielles de la DILA et sont consultables dès maintenant par les juristes, journalistes et agents IA. Elles restent distinctes du compteur des anomalies qualifiées ({formatInt(snap?.findings.public ?? 0)}).
                  </p>
                </div>
              </div>
              <a href="/api/findings?status=reproduced&limit=20" class="shrink-0 text-xs font-semibold text-notice-ink underline">
                Accès JSON complet →
              </a>
            </div>

            <div class="grid gap-10 lg:grid-cols-[24rem_1fr] lg:items-start">
              <div class="space-y-3">
                <h3 class="font-serif text-xl font-semibold text-ink">De 13 950 articles aux fiches reproduites</h3>
                <SweepFunnel stages={funnelStages} />
              </div>

              <div class="space-y-5">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <SegmentedControl
                    bind:value={findingFilter}
                    ariaLabel="Filtrer les constats reproduits"
                    size="sm"
                    options={[
                      { value: 'all', label: 'Échantillon', badge: snap?.reproducedPreview.length ?? 0 },
                      { value: 'SYNTAXE', label: 'Typographie', badge: snap?.pipeline.reproducedByType.SYNTAXE ?? 0 },
                      { value: 'REF_MORTE', label: 'Renvois abrogés', badge: snap?.pipeline.reproducedByType.REF_MORTE ?? 0 },
                    ]}
                  />
                  <span class="text-xs text-muted">Cliquez sur un constat pour ouvrir son certificat</span>
                </div>

                <!-- Liste éditoriale ouverte (filets fins, zéro grille de boîtes lourdes) -->
                <div class="divide-y divide-line border-y border-line">
                  {#each filteredFindings.slice(0, 6) as item (item.id)}
                    <a
                      href={`/anomalies/${item.id}`}
                      class="group block py-4 px-2 text-ink no-underline transition-colors hover:bg-bg/80"
                    >
                      <div class="flex flex-wrap items-baseline justify-between gap-2">
                        <div class="flex flex-wrap items-center gap-2.5">
                          <span class="font-semibold text-sm text-brand-strong group-hover:underline">
                            {item.typeLabel}
                          </span>
                          {#if item.articleCode || item.articleNum}
                            <span class="text-xs text-muted">
                              {[item.articleCode, item.articleNum ? `art. ${item.articleNum}` : null].filter(Boolean).join(' · ')}
                            </span>
                          {/if}
                          <span class="mono text-xs text-subtle">{item.id}</span>
                        </div>
                        <Badge variant="amber" size="sm">En attente de verdict humain</Badge>
                      </div>
                      <p class="mt-1.5 text-sm leading-relaxed text-ink">{item.claim}</p>
                      {#if item.excerpt}
                        <p class="mt-2 border-l-2 border-notice-line pl-3 font-serif text-sm text-muted line-clamp-2">
                          …{item.excerpt.before}<mark class="rounded bg-notice px-1 text-notice-ink font-semibold">{item.excerpt.marked}</mark>{item.excerpt.after}…
                        </p>
                      {/if}
                    </a>
                  {/each}
                </div>
              </div>
            </div>
          </div>
        {:else if example}
          <div class="pt-3 space-y-8">
            <div class="flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-5">
              <div>
                <p class="kicker text-brand-strong">Programme de recherche rejoué chez nous</p>
                <h3 class="font-serif mt-1 text-3xl font-semibold text-ink">{example.title}</h3>
                <p class="mt-1 text-sm text-muted">
                  {example.codeTitle} · <a href={`/article/${example.id}`}>Article {example.num ?? example.id}</a>
                  {#if example.versionDate} · version du {formatLegiDate(example.versionDate)}{/if}
                </p>
              </div>
              <Badge variant="brand">
                <CheckCircle2 class="size-3.5" aria-hidden="true" />
                {plural(example.tests, 'test rejoué', 'tests rejoués')}
              </Badge>
            </div>

            <div class="grid gap-10 md:grid-cols-2 md:items-start">
              <div class="space-y-4">
                <p class="kicker">1 · Le texte officiel de la loi</p>
                <blockquote
                  cite={example.legifranceUrl}
                  class="legal-text border-l-2 border-brand pl-5 text-ink wrap-anywhere"
                >
                  {@html example.textHtml}
                </blockquote>
                <p class="text-xs text-muted">
                  <a href={example.legifranceUrl} rel="external" class="inline-flex items-center gap-1">
                    Lire sur Légifrance
                    <ExternalLink class="size-3" aria-hidden="true" />
                  </a>
                  · seul le texte officiel publié fait foi.
                </p>
              </div>

              <div class="rounded-[var(--radius-xl)] bg-bg p-7 space-y-5">
                <p class="kicker">2 · La règle calculée par le programme Inria</p>
                <p class="font-serif text-xl leading-relaxed text-ink">{example.description}</p>
                <p class="text-sm leading-relaxed text-muted">
                  Rejeu réussi le <time datetime={example.replayDate}>{formatDateTime(example.replayDate)}</time> avec la version épinglée du compilateur Catala. BugDeLoi étend cette approche à l’ensemble des articles calculables.
                </p>
                <div class="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm">
                  <a href={example.sourceUrl} rel="external" class="inline-flex items-center gap-1 font-semibold">
                    Lire le code source sur GitHub
                    <ExternalLink class="size-3.5" aria-hidden="true" />
                  </a>
                  <a href="/references" class="font-semibold text-brand-strong">
                    Voir les {formatInt(totals.REF)} articles ★ →
                  </a>
                </div>
              </div>
            </div>
          </div>
        {:else}
          <EmptyState title="Aucun exemple de référence disponible pour le moment." />
        {/if}
      {/snippet}
    </Tabs>
  </div>
</section>

<!-- BANDE 3 : BANDE SOMBRE ÉDITORIALE — L'AVANCEMENT DES CHANTIERS (plein bord) -->
<section class="band-observatory py-18 sm:py-24" aria-labelledby="race-title">
  <div class="container-wide space-y-12">
    <div class="flex flex-wrap items-end justify-between gap-6">
      <div class="max-w-3xl space-y-3">
        <p class="text-xs font-bold uppercase tracking-widest text-obs-amber">
          Cycle 0 · Étalonnage scientifique avant passage à l’échelle
        </p>
        <h2 id="race-title" class="font-serif text-3xl font-semibold text-obs-ink sm:text-5xl">
          L’avancement des chantiers
        </h2>
        <p class="text-base leading-relaxed text-obs-muted">
          Avant de publier des constats inédits, le projet vérifie sa méthode en rejouant ce que la recherche publique a déjà établi.
        </p>
      </div>
      <a
        href="/methode"
        class="inline-flex items-center gap-1.5 text-sm font-semibold text-obs-emerald no-underline hover:underline"
      >
        Lire le protocole complet
        <ArrowRight class="size-4" aria-hidden="true" />
      </a>
    </div>

    <ChantierRace tracks={raceTracks} />

    {#if snap && activeSuites.length > 0}
      <div class="space-y-4 border-t border-obs-line/80 pt-10">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <p class="text-xs font-semibold uppercase tracking-wider text-obs-muted">
            Programmes de recherche rejoués automatiquement (Inria / DGFiP)
          </p>
          <span class="text-sm font-semibold tabular text-obs-emerald">
            {formatInt(totalInriaTests)} tests réussis sur {formatInt(totalInriaTests)}
          </span>
        </div>
        <div class="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          {#each activeSuites as suite (suite.subject)}
            <div class="flex items-baseline justify-between gap-3 border-b border-obs-line/70 py-2.5">
              <span class="text-sm text-obs-ink truncate">{suite.folder.replaceAll('_', ' ')}</span>
              <span class="mono shrink-0 text-xs font-semibold tabular text-obs-emerald">
                {suite.passed}/{suite.tests}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</section>

<!-- BANDE 4 : CARTE INTERACTIVE PLEINE LARGEUR DES 13 950 ARTICLES -->
<section id="carte-vivante" class="band-observatory border-t border-obs-line/60 py-18 sm:py-24" aria-labelledby="map-title">
  <div class="container-wide space-y-8">
    <div class="max-w-3xl space-y-3">
      <p class="text-xs font-bold uppercase tracking-widest text-obs-emerald">
        Cartographie des textes en vigueur
      </p>
      <h2 id="map-title" class="font-serif text-3xl font-semibold text-obs-ink sm:text-5xl">
        {formatInt(inForceTotal)} articles cartographiés. {formatInt(totals.REF)} déjà reliés à des tests.
      </h2>
      <p class="text-base leading-relaxed text-obs-muted">
        Chaque surface est proportionnelle au nombre d’articles d’une section. Activez « Mettre en avant les ★ » pour voir instantanément où portent les programmes existants.
      </p>
    </div>

    {#if data.mapPreviews.length > 0}
      <HomeTreemap previews={data.mapPreviews} onOpenSearch={() => shell?.openSearch()} />
    {:else}
      <p class="text-sm text-obs-muted">
        La carte interactive apparaîtra dès que la connexion à la base des textes sera rétablie.
      </p>
    {/if}
  </div>
</section>

<!-- BANDE 5 : DANS LE REGISTRE (3 panneaux éditoriaux respirants façon pequalnp.com) -->
<section class="bg-bg py-18 sm:py-24" aria-labelledby="record-title">
  <div class="container-wide space-y-10">
    <div class="flex flex-wrap items-baseline justify-between gap-4">
      <div>
        <p class="kicker">Mémoire publique</p>
        <h2 id="record-title" class="font-serif mt-1 text-3xl font-semibold text-ink sm:text-4xl">
          Ce qui a changé récemment
        </h2>
      </div>
      <a href="/journal" class="text-sm font-semibold text-brand-strong no-underline hover:underline">
        Consulter le journal complet →
      </a>
    </div>

    <div class="grid gap-6 lg:grid-cols-3">
      <SinceLastVisit events={snap?.events ?? []} />

      <article class="flex h-full flex-col justify-between rounded-[var(--radius-xl)] bg-obs-bg p-7 sm:p-8 text-obs-ink">
        <div class="space-y-4">
          <p class="text-xs font-bold uppercase tracking-widest text-obs-emerald">
            Note de synthèse
          </p>
          <p class="font-serif text-xl leading-relaxed text-obs-ink">
            Sur 13 950 articles contrôlés, deux vérifications indépendantes ont confirmé
            <strong class="text-obs-amber">{formatInt(snap?.pipeline.reproducedCount ?? 0)} constats</strong>.
            Sur les allocations familiales, la traduction aveugle retrouve 12 cas sur 17 et met au jour deux écarts concrets en Guyane et à Mayotte.
          </p>
        </div>
        <div class="mt-6 flex items-center justify-between border-t border-obs-line pt-4 text-xs">
          <span class="text-obs-muted">Prochaine étape : verdict humain</span>
          <a href="/experiences/allocations-familiales" class="font-semibold text-obs-emerald no-underline hover:underline">
            Lire l’audit →
          </a>
        </div>
      </article>

      <article class="flex h-full flex-col justify-between rounded-[var(--radius-xl)] bg-surface p-7 sm:p-8">
        <div class="space-y-4">
          <p class="kicker">Le Cimetière · In memoriam</p>
          <p class="font-serif text-xl font-semibold leading-snug text-ink">
            {snap?.pipeline.rejectedCount
              ? `${formatInt(snap.pipeline.rejectedCount)} constats écartés par relecture humaine`
              : 'Aucun constat encore écarté par un juriste.'}
          </p>
          <p class="text-sm leading-relaxed text-muted">
            En amont, <strong class="text-ink">{formatInt(snap?.pipeline.withdrawnCount ?? 0)} signalements</strong> ont déjà été retirés automatiquement après contre-vérification indépendante : montrer nos erreurs corrigées fait partie de la preuve.
          </p>
        </div>
        <div class="mt-6 flex items-center justify-between border-t border-line pt-4 text-xs">
          <span class="text-muted">Une réfutation vaut une preuve.</span>
          <a href="/anomalies/cimetiere" class="font-semibold text-brand-strong no-underline hover:underline">
            Visiter le cimetière →
          </a>
        </div>
      </article>
    </div>
  </div>
</section>

<!-- BANDE 6 : ÉCHELLE DE PREUVE (plein fond blanc, présentation horizontale ouverte) -->
<section class="border-t border-line bg-surface py-18 sm:py-24" aria-labelledby="proof-title">
  <div class="container-wide space-y-10">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="max-w-3xl space-y-3">
        <p class="kicker">Garanties de méthode</p>
        <h2 id="proof-title" class="font-serif text-3xl font-semibold text-ink sm:text-4xl">
          Comment un article gagne son niveau de preuve
        </h2>
        <p class="text-base text-muted">
          Nous n’écrivons jamais qu’une loi est « prouvée ». Chaque niveau indique exactement quel contrôle mécanique ou humain a réussi.
        </p>
      </div>
      <a href="/methode#niveaux" class="text-sm font-semibold text-brand-strong no-underline hover:underline">
        Méthode complète →
      </a>
    </div>

    <ProofScaleInteractive counts={totals} initial="REF" />
  </div>
</section>

<!-- BANDE 7 : PARTICIPER — JURISTES & CITOYENS D'ABORD, AGENTS IA & MCP EN SUITE -->
<section class="border-t border-line bg-bg py-18 sm:py-24" aria-labelledby="join-title">
  <div class="container-wide grid gap-8 lg:grid-cols-2">
    <div class="flex flex-col justify-between gap-8 rounded-[var(--radius-xl)] bg-surface p-8 sm:p-10">
      <div class="space-y-4">
        <p class="kicker text-brand-strong">Juristes, journalistes & citoyens</p>
        <h2 id="join-title" class="font-serif text-3xl font-semibold text-ink sm:text-4xl">
          Le dernier mot reste humain
        </h2>
        <p class="text-base leading-relaxed text-muted">
          Les machines accélèrent l’analyse de milliers d’articles, mais seul un relecteur humain peut qualifier une anomalie ou signer le niveau N5. Un premier lot de 9 défauts typographiques et deux écarts d’allocations familiales attendent un regard expert.
        </p>
        <ul class="space-y-2.5 pt-2 text-sm text-ink">
          <li class="flex items-start gap-2.5">
            <FileSearch class="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
            <span>Chaque fiche cite l’extrait exact, sa date de version et le lien direct Légifrance.</span>
          </li>
          <li class="flex items-start gap-2.5">
            <CheckCircle2 class="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
            <span>Chaque décision est signée, transparente et reproductible par n’importe quel tiers.</span>
          </li>
        </ul>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <Button href="/anomalies" variant="ink" size="md">
          Consulter le registre
          <ArrowRight class="size-4" aria-hidden="true" />
        </Button>
        <Button href="/sponsors" variant="secondary" size="md">
          Soutenir & transparence
        </Button>
      </div>
    </div>

    <div class="flex flex-col justify-between gap-8 rounded-[var(--radius-xl)] bg-obs-bg p-8 sm:p-10 text-obs-ink">
      <div class="space-y-4">
        <p class="text-xs font-bold uppercase tracking-widest text-obs-emerald">
          Pour les agents IA · MCP & WebMCP
        </p>
        <h2 class="font-serif text-3xl font-semibold text-obs-ink sm:text-4xl">
          Brancher un agent sur nos données ouvertes
        </h2>
        <p class="text-base leading-relaxed text-obs-muted">
          Tout le site est lisible et pilotable par des LLMs sans clé API : serveur MCP en lecture seule (<code class="text-obs-ink">/api/mcp</code>), pont WebMCP intégré aux composants et guichet de tâches (<code class="text-obs-ink">/join.txt</code>).
        </p>
        <div class="rounded-[var(--radius)] bg-obs-surface p-4">
          <div class="flex items-center justify-between gap-2 pb-2">
            <span class="mono inline-flex items-center gap-1.5 text-xs text-obs-emerald">
              <Terminal class="size-3.5" aria-hidden="true" />
              Connexion MCP
            </span>
            <CopyButton text={claudeMcpCommand} label="Copier" tone="observatory" size="xs" />
          </div>
          <pre class="overflow-x-auto text-xs text-obs-ink/90"><code>{claudeMcpCommand}</code></pre>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <Button variant="observatory" size="md" onclick={() => shell?.openAgent()}>
          <Bot class="size-4" aria-hidden="true" />
          Tester MCP & WebMCP
        </Button>
        <Button href="/join" variant="observatoryOutline" size="md">
          Guide contributeurs
        </Button>
        <a href="/design-system" class="text-sm font-semibold text-obs-emerald no-underline hover:underline">
          Design System →
        </a>
      </div>
    </div>
  </div>
</section>
