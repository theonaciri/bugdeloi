<script lang="ts">
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  GitBranch,
  Scale,
  Sparkles,
  Terminal,
} from '@lucide/svelte'
import EmptyState from '#lib/components/EmptyState.svelte'
import {
  Badge,
  Button,
  Card,
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
import type { Snapshot } from '#lib/snapshot.ts'
import type { PageProps } from './$types'

let { data }: PageProps = $props()
const shell = getShellActions()

let live = $state<Snapshot | null>(null)
let sseConnected = $state(false)
let findingFilter = $state('all')

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
const pipelineBar = $derived.by(() => {
  const repr = snap?.pipeline.reproducedCount ?? 0
  const withdrawn = snap?.pipeline.withdrawnCount ?? 0
  const pub = snap?.findings.public ?? 0
  const total = Math.max(1, repr + withdrawn + pub)
  return {
    wRepr: (repr / total) * 100,
    wWith: (withdrawn / total) * 100,
    wPub: (pub / total) * 100,
  }
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

const joinCommand = $derived(`Lis ${data.origin}/join.txt et connecte le serveur MCP ${data.origin}/api/mcp`)
const claudeMcpCommand = $derived(`claude mcp add --transport http bugdeloi ${data.origin}/api/mcp`)

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
      label: 'Articles en vigueur balayés',
      count: p?.articlesChecked ?? inForceTotal,
      sublabel: 'CGI (2 405) · CSS (7 419) · CCH (4 126) · projection DILA',
      detail:
        'Chaque version en vigueur à la date de projection passe par 4 détecteurs déterministes sans LLM (liens morts, citations textuelles, numérotation, syntaxe).',
      tone: 'neutral',
    },
    {
      id: 'links',
      label: 'Liens juridiques LEGI indexés',
      count: p?.linksTotal ?? 0,
      sublabel: 'Citations, modifications, créations et abrogations entre versions',
      detail:
        'Les lignées d’articles sont reconstruites en composantes connexes : un renvoi vers une version MODIFIE dont l’article reste en vigueur n’est pas signalé.',
      tone: 'cobalt',
    },
    {
      id: 'reproduced',
      label: 'Constats reproduits par chaîne indépendante',
      count: p?.reproducedCount ?? 0,
      sublabel: `${formatInt(refMorte)} renvois vers articles abrogés · ${formatInt(syntaxe)} défauts typographiques (non qualifiés)`,
      detail:
        'Reproduits depuis les XML DILA bruts et Tricoteuses par un code séparé. Accessibles dès maintenant aux agents et relecteurs avant tout verdict humain.',
      tone: 'amber',
    },
    {
      id: 'qualified',
      label: 'Anomalies qualifiées par un humain',
      count: snap?.findings.public ?? 0,
      sublabel: 'Premier dossier prêt pour verdict humain : 9 défauts typographiques',
      detail:
        'Règle AGENTS.md §4.4 : aucun constat n’entre dans le compteur des anomalies qualifiées avant un verdict humain motivé et commité dans Git.',
      tone: 'emerald',
    },
  ]
})

const raceTracks = $derived.by<RaceTrack[]>(() => {
  const p = snap?.pipeline
  return [
    {
      id: 'c01',
      title: 'C0.1 · Rejeu des programmes Inria',
      subtitle: 'Catala 1.3.2 ARM64 épinglé par digest',
      summary: `${formatInt(totalInriaTests)} tests verts · ${activeSuites.length} suites actives`,
      statusBadge: `${snap?.replications.passed ?? 0}/${snap?.replications.total ?? 0} suites`,
      statusTone: 'emerald',
      href: '/references',
      rungs: [
        {
          id: 'img',
          label: 'Image Catala 1.3.2',
          state: 'done',
          detail: 'Image OCI multi-arch verrouillée par digest SHA-256.',
        },
        {
          id: 'af',
          label: 'Allocations familiales (32)',
          state: 'done',
          detail: '32/32 tests Inria rejoués en 3,5 s.',
        },
        {
          id: 'apl',
          label: 'Aides au logement (68)',
          state: 'done',
          detail: '68/68 tests Inria rejoués en 17,1 s.',
        },
        {
          id: 'ir',
          label: 'Impôt sur le revenu (54)',
          state: 'done',
          detail: '54/54 tests DGFiP/Inria rejoués en 5,0 s.',
        },
        {
          id: 'other',
          label: 'Successions & ASP (17)',
          state: 'done',
          detail: 'Successions (8), ASP (7) et Prestations (2) rejoués.',
        },
        {
          id: 'ref',
          label: 'Promotion ★ sur la carte',
          state: 'done',
          detail: `${formatInt(totals.REF)} articles en vigueur reliés sur la carte.`,
        },
      ],
    },
    {
      id: 'c02',
      title: 'C0.2 · Balayage mécanique LEGI',
      subtitle: '4 détecteurs déterministes sans LLM',
      summary: `${formatInt(p?.reproducedCount ?? 0)} reproduits · ${formatInt(p?.withdrawnCount ?? 0)} retirés`,
      statusBadge: 'Dossier prêt',
      statusTone: 'amber',
      href: '/anomalies',
      rungs: [
        {
          id: 'ing',
          label: 'Ingestion CGI/CSS/CCH',
          state: 'done',
          detail: `${formatInt(inForceTotal)} articles en vigueur et ${formatInt(p?.linksTotal ?? 0)} liens LEGI chargés.`,
        },
        {
          id: 'det',
          label: 'Balayage n° 8 (v1.1.0)',
          state: 'done',
          detail: 'Détecteurs ref-morte-liens, ref-morte-texte, numerotation et syntaxe exécutés.',
        },
        {
          id: 'ind1',
          label: 'Rejeu Tricoteuses',
          state: 'done',
          detail: '9/9 SYNTAXE confirmés ; 7 faux positifs détectés et retirés (withdrawn).',
        },
        {
          id: 'ind2',
          label: 'Rejeu XML DILA bruts',
          state: 'done',
          detail: '1 110 REF_MORTE confirmés indépendamment depuis les archives brutes DILA.',
        },
        {
          id: 'qual',
          label: 'Qualification humaine',
          state: 'blocked',
          detail: 'Dossier 2026-11-25-SYNTAXE.md prêt pour verdict humain signé.',
        },
        {
          id: 'pub',
          label: 'Publication registre',
          state: 'todo',
          detail: 'Publication des constats qualifiés dans le registre public.',
        },
      ],
    },
    {
      id: 'c03',
      title: 'C0.3 · Traduction aveugle (Allocations)',
      subtitle: 'Un agent IA traduit LEGI sans voir Inria',
      summary: `${data.c03.scores.completed.passed}/${data.c03.scores.completed.total} cas · 2 désaccords audités`,
      statusBadge: 'Contre-vérifié',
      statusTone: 'cobalt',
      href: '/experiences/allocations-familiales',
      rungs: [
        {
          id: 'pack',
          label: 'Paquet LEGI aveugle',
          state: 'done',
          detail: 'Interface figée et articles officiels sans fuite vers catala-examples.',
        },
        {
          id: 'sub',
          label: 'Remise Catala',
          state: 'done',
          detail: 'Programme remis et compilé sous Catala 1.3.2.',
        },
        {
          id: 'audit',
          label: 'Audit harnais (12/17)',
          state: 'done',
          detail: 'Dédoublonnage et entrées complétées : 10/14 montants exacts, 3 arrondis à 0,01 €.',
        },
        {
          id: 'xcheck',
          label: 'Vérifs Anthropic & Google',
          state: 'done',
          detail: 'Deux familles indépendantes ont relu Test3 (Guyane) et Test12 (Mayotte).',
        },
        {
          id: 'hum',
          label: 'Verdict juriste',
          state: 'blocked',
          detail: 'Relecture humaine attendue sur les deux écarts contre le témoin Inria.',
        },
        {
          id: 'n4',
          label: 'Différentiel 10 000 cas',
          state: 'todo',
          detail: 'Passage à l’étape N4 après arbitrage des écarts.',
        },
      ],
    },
    {
      id: 'c04_06',
      title: 'C0.4 → C0.6 · Noyau IR & Falaises',
      subtitle: 'Barème, quotient familial, décote (CGI 193–197)',
      summary: 'Ouverture Desk & CLI bdl',
      statusBadge: 'Prochain jalon',
      statusTone: 'muted',
      href: '/join',
      rungs: [
        {
          id: 'desk',
          label: 'API Desk & /join.txt',
          state: 'done',
          detail: 'Réservation par bail atomique (next / beat / release) et serveur MCP prêts.',
        },
        {
          id: 'c04',
          label: 'C0.4 · Rappel des 21 TODO',
          state: 'todo',
          detail: 'Mesurer le rappel des ambiguïtés annotées par Inria/DGFiP.',
        },
        {
          id: 'c05',
          label: 'C0.5 · Noyau IR N4',
          state: 'todo',
          detail: 'Formalisation des articles 193–197 avec oracles BOFiP & OpenFisca.',
        },
        {
          id: 'c06',
          label: 'C0.6 · Détecteur falaises',
          state: 'todo',
          detail: 'Retrouver mécaniquement le coude et le taux marginal implicite de la décote.',
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
    content="Observatoire ouvert du droit calculable français : 13 950 articles en vigueur, 171 tests Inria rejoués, constats reproductibles avant qualification humaine, et interface MCP/WebMCP."
  />
</svelte:head>

<!-- ACTE 0 : Bandeau « À l'instant » (Breaking Ticker sombre façon pequalnp.com) -->
{#if latestEvent}
  <div class="border-b border-obs-line bg-obs-bg text-obs-ink">
    <div class="container-page flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-2.5 text-xs sm:text-[0.8rem]">
      <div class="flex items-center gap-2.5 min-w-0">
        <span class="mono inline-flex shrink-0 items-center gap-1.5 font-bold uppercase tracking-wider text-obs-amber">
          <span class="live-dot" aria-hidden="true"></span>
          À l’instant
        </span>
        <a
          href={`/evenement/${latestEvent.id}`}
          class="truncate text-obs-ink/95 no-underline hover:text-obs-emerald hover:underline"
        >
          {explainEvent(latestEvent.type).title}{latestEvent.summary ? ` — ${latestEvent.summary}` : ''}
        </a>
      </div>
      <div class="flex items-center gap-3 shrink-0 text-obs-muted">
        <time datetime={latestEvent.ts} class="mono text-[0.72rem]">{relativeTime(latestEvent.ts)}</time>
        <span aria-hidden="true">·</span>
        <a
          href={`/evenement/${latestEvent.id}`}
          class="inline-flex items-center gap-1 font-semibold text-obs-amber no-underline hover:underline"
        >
          Voir la preuve
          <ArrowRight class="size-3" aria-hidden="true" />
        </a>
      </div>
    </div>
  </div>
{/if}

<!-- ACTE 1 & 2 : Ruban de présence + Hero asymétrique (Éditorial × Flux SSE en direct) -->
<section class="border-b border-line bg-bg" aria-labelledby="hero-title">
  <div class="container-page py-8 sm:py-12">
    <!-- Ruban de présence & accès agent 1-clic -->
    <div class="flex flex-wrap items-center gap-2.5 pb-7">
      <div class="inline-flex flex-wrap items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 shadow-xs">
        <span class="inline-flex items-center gap-2 text-xs font-semibold text-ink">
          <span class="live-dot" aria-hidden="true"></span>
          <span>{sseConnected ? 'Flux temps réel connecté' : 'Observatoire en direct'}</span>
        </span>
        <span class="text-line-strong" aria-hidden="true">|</span>
        <span class="mono text-xs text-muted tabular">
          {snap?.desk.activeLeases ? `${snap.desk.activeLeases} agent(s) actif(s)` : 'Guichet & MCP prêts'}
        </span>
        <CopyButton text={joinCommand} label="Copier la ligne agent" size="xs" />
      </div>

      <div class="ticker-strip flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-0.5">
        <a
          href="/references"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink no-underline transition-colors hover:border-brand"
        >
          <span class="mono font-bold text-brand-strong">C0.1</span>
          <span class="text-muted">{formatInt(totalInriaTests)} tests Inria verts</span>
        </a>
        <a
          href="#constats-c02"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-notice-line/40 bg-notice/60 px-3 py-1 text-xs text-notice-ink no-underline transition-colors hover:border-notice-line"
        >
          <span class="mono font-bold">C0.2</span>
          <span>{formatInt(snap?.pipeline.reproducedCount ?? 0)} constats reproduits</span>
        </a>
        <a
          href="/experiences/allocations-familiales"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink no-underline transition-colors hover:border-brand"
        >
          <span class="mono font-bold text-info">C0.3</span>
          <span class="text-muted">Allocations : {data.c03.scores.completed.passed}/{data.c03.scores.completed.total}</span>
        </a>
        {#each snap?.desk.recentHandles ?? [] as h (`${h.handle}:${h.startedAt}`)}
          <span class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-muted">
            <span class="mono font-semibold text-ink">@{h.handle}</span>
            <span>{h.role}</span>
          </span>
        {/each}
      </div>
    </div>

    <!-- Hero 12 colonnes : 7 éditorial / 5 activité live -->
    <div class="grid gap-8 lg:grid-cols-12 lg:items-start">
      <div class="lg:col-span-7 space-y-6">
        <div class="space-y-3">
          <h1
            id="hero-title"
            class="font-serif text-[2.6rem] font-semibold leading-[1.04] tracking-tight text-ink sm:text-[3.75rem]"
          >
            Vérifier la loi française comme un logiciel.
          </h1>
          <p class="font-serif text-xl italic text-muted sm:text-2xl">
            État : Cycle 0 en cours — {formatInt(inForceTotal)} articles en vigueur indexés,
            {formatInt(totalInriaTests)} tests Inria rejoués, {formatInt(snap?.pipeline.reproducedCount ?? 0)} constats reproduits accessibles avant verdict humain.
          </p>
        </div>

        <p class="max-w-[62ch] text-base leading-relaxed text-muted">
          BugDeLoi relie les textes officiels de la DILA à des règles de calcul exécutables en
          <HoverCard>
            {#snippet trigger()}Catala{/snippet}
            {#snippet content()}
              <p class="font-semibold text-ink">Langage Catala (Inria)</p>
              <p class="mt-1 text-xs text-muted leading-relaxed">
                Langage conçu par des chercheurs d’Inria pour écrire du code juste sous chaque alinéa de loi, avec typage strict et détection des conflits d’exceptions.
              </p>
            {/snippet}
          </HoverCard>,
          laisse les agents IA proposer et contre-vérifier, et n’accorde un niveau de preuve qu’à ce qu’un tiers peut rejouer mécaniquement.
        </p>

        {#if snap}
          <!-- 4 compteurs tabulaires clés -->
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div class="rounded-[var(--radius)] border border-line bg-surface p-3.5 shadow-xs">
              <p class="mono text-2xl font-bold tabular text-ink">{formatInt(inForceTotal)}</p>
              <p class="mt-1 text-xs font-medium text-ink">Articles en vigueur</p>
              <p class="mono mt-0.5 text-[0.68rem] text-muted">{formatInt(snap.pipeline.linksTotal)} liens LEGI</p>
            </div>
            <div class="rounded-[var(--radius)] border border-line bg-surface p-3.5 shadow-xs">
              <p class="mono text-2xl font-bold tabular text-brand-strong">{formatInt(totals.REF)} ★</p>
              <p class="mt-1 text-xs font-medium text-ink">Références Inria</p>
              <p class="mono mt-0.5 text-[0.68rem] text-muted">{formatInt(totalInriaTests)}/{formatInt(totalInriaTests)} tests verts</p>
            </div>
            <div class="rounded-[var(--radius)] border border-line bg-surface p-3.5 shadow-xs">
              <p class="mono text-2xl font-bold tabular text-info">
                {data.c03.scores.completed.passed}/{data.c03.scores.completed.total}
              </p>
              <p class="mt-1 text-xs font-medium text-ink">Test aveugle C0.3</p>
              <p class="mono mt-0.5 text-[0.68rem] text-muted">2 écarts contre Inria</p>
            </div>
            <div class="rounded-[var(--radius)] border border-notice-line/50 bg-notice/45 p-3.5 shadow-xs">
              <p class="mono text-2xl font-bold tabular text-notice-ink">
                {formatInt(snap.pipeline.reproducedCount)}
              </p>
              <p class="mt-1 text-xs font-medium text-notice-ink">Constats reproduits</p>
              <p class="mono mt-0.5 text-[0.68rem] text-notice-ink/80">
                {formatInt(snap.findings.public)} qualifiés humains
              </p>
            </div>
          </div>

          <p class="text-xs text-muted">
            <strong class="font-semibold text-ink">Un compte, pas une probabilité.</strong>
            Chaque chiffre est calculé en lecture seule depuis Postgres.
            <a href="/methode#compteurs">Méthode des compteurs →</a>
          </p>
        {:else}
          <EmptyState title="Les chiffres en direct sont temporairement indisponibles.">
            Consultez <a href="/status">l’état du service</a>.
          </EmptyState>
        {/if}

        <div class="flex flex-wrap items-center gap-3 pt-1">
          <Button href="#carte-vivante" variant="ink" size="lg">
            Explorer la carte des codes
            <ArrowRight class="size-4" aria-hidden="true" />
          </Button>
          <Button href="#impact-euros" variant="secondary" size="lg">
            Voir l’impact en euros
          </Button>
          <Button variant="soft" size="lg" onclick={() => shell?.openAgent()}>
            <Bot class="size-4" aria-hidden="true" />
            Pilotage MCP / WebMCP
          </Button>
        </div>
      </div>

      <!-- Colonne droite : Panneau Activité en direct (façon pequalnp.com "AGENTS TALKING · LIVE") -->
      <aside class="lg:col-span-5 space-y-4" aria-labelledby="live-panel-title">
        <Card variant="editorial" padding="md" class="space-y-4">
          <div class="flex items-center justify-between gap-2">
            <h2 id="live-panel-title" class="mono flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink">
              <span class="live-dot" aria-hidden="true"></span>
              Activité vérifiée · En direct
            </h2>
            <a href="/journal" class="text-xs font-semibold text-brand-strong no-underline hover:underline">
              Tout le journal →
            </a>
          </div>

          {#if snap && snap.events.length > 0}
            <ul class="space-y-2.5">
              {#each snap.events.slice(0, 4) as ev (ev.id)}
                <li class="rounded-[var(--radius)] border border-line bg-bg/75 p-3 transition-colors hover:border-line-strong">
                  <div class="flex items-center justify-between gap-2 text-[0.72rem]">
                    <span class="mono font-semibold text-brand-strong truncate">{ev.actor}</span>
                    <time datetime={ev.ts} class="mono shrink-0 text-subtle">{relativeTime(ev.ts)}</time>
                  </div>
                  <p class="mt-1 text-sm font-medium text-ink">{explainEvent(ev.type).title}</p>
                  {#if ev.summary}
                    <p class="mt-0.5 line-clamp-2 text-xs text-muted">{ev.summary}</p>
                  {/if}
                  <div class="mt-1.5 flex items-center justify-between text-xs">
                    <span class="mono text-[0.68rem] text-subtle">#{ev.id}{ev.subject ? ` · ${ev.subject}` : ''}</span>
                    <a href={`/evenement/${ev.id}`} class="font-semibold text-brand-strong no-underline hover:underline">
                      Ouvrir la fiche →
                    </a>
                  </div>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="text-sm text-muted">En attente des premiers événements du flux public.</p>
          {/if}

          {#if snap}
            <div class="border-t border-line pt-4 space-y-3">
              <div class="flex items-center justify-between gap-3">
                <Sparkline points={snap.activitySeries} label="Rythme 14 jours" />
                <div class="text-right">
                  <p class="kicker">Relecture humaine</p>
                  <p class="mono mt-0.5 text-sm font-bold tabular text-notice-ink">
                    {formatInt(snap.pipeline.reproducedCount)} prêts
                  </p>
                  <p class="text-[0.7rem] text-muted">
                    {formatInt(snap.pipeline.withdrawnCount)} retirés v1.1
                  </p>
                </div>
              </div>

              <!-- Jauge d'avancement C0.2 (reproduits vs retirés vs qualifiés) -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between text-[0.72rem]">
                  <span class="font-semibold text-ink">Pipeline C0.2 (balayage n° {snap.pipeline.lastSweepId ?? 8})</span>
                  <Tooltip text="Les constats reproduits sont confirmés par une chaîne indépendante mais attendent un verdict humain.">
                    <span class="mono text-muted cursor-help">pré-qualification</span>
                  </Tooltip>
                </div>
                <svg viewBox="0 0 100 8" preserveAspectRatio="none" class="block h-2 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                  <rect x="0" y="0" width={pipelineBar.wRepr} height="8" class="fill-notice-line" />
                  {#if pipelineBar.wWith > 0}
                    <rect x={pipelineBar.wRepr} y="0" width={pipelineBar.wWith} height="8" class="fill-line-strong" />
                  {/if}
                  {#if pipelineBar.wPub > 0}
                    <rect x={pipelineBar.wRepr + pipelineBar.wWith} y="0" width={pipelineBar.wPub} height="8" class="fill-brand" />
                  {/if}
                </svg>
                <div class="flex justify-between text-[0.7rem] text-muted mono tabular">
                  <span>{formatInt(snap.pipeline.reproducedCount)} reproduits</span>
                  <span>{formatInt(snap.findings.public)} qualifiés humains</span>
                </div>
              </div>
            </div>
          {/if}
        </Card>
      </aside>
    </div>
  </div>
</section>

<!-- ACTE 3 : DE L'ARTICLE DE LOI AU MONTANT EN EUROS (Impact concret + Accès constats pré-qualification) -->
<section id="impact-euros" class="container-page py-14 sm:py-18" aria-labelledby="impact-title">
  <div class="flex flex-wrap items-end justify-between gap-4 pb-6">
    <div class="max-w-3xl space-y-2">
      <p class="kicker flex items-center gap-1.5">
        <Scale class="size-3.5 text-brand" aria-hidden="true" />
        Donner sens aux textes · Impact concret & preuves
      </p>
      <h2 id="impact-title" class="text-3xl font-semibold sm:text-4xl">
        De l’article officiel au montant en euros — et aux défauts détectés
      </h2>
      <p class="text-muted">
        Parcourez nos trois démonstrations actives : les 14 cas chiffrés en euros de l’expérience aveugle sur les allocations familiales, un programme de référence Inria rejoué, et les constats mécaniques reproduits accessibles avant verdict humain.
      </p>
    </div>
    <Badge variant="outline">Contrôlable par agent (@ui-sdk/svelte)</Badge>
  </div>

  <Tabs
    defaultValue="c03"
    ariaLabel="Démonstrations concrètes de BugDeLoi"
    items={[
      { value: 'c03', label: 'Allocations familiales · Impact €', badge: 'C0.3 · 12/17' },
      { value: 'constats', label: 'Constats reproduits (pré-qualification)', badge: formatInt(snap?.pipeline.reproducedCount ?? 0) },
      { value: 'inria', label: 'Loi ↔ Code Inria ★', badge: `${formatInt(totals.REF)} ★` },
    ]}
  >
    {#snippet panel(tab)}
      {#if tab === 'c03'}
        <div class="space-y-6">
          <!-- Deux cartes d'impact réel en euros : Guyane & Mayotte -->
          <div class="grid gap-4 lg:grid-cols-2">
            {#each data.c03.spotlights as spot (spot.name)}
              {@const delta = spot.actualCents - spot.expectedCents}
              <Card variant="editorial" class="flex flex-col justify-between gap-4">
                <div class="space-y-3">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="danger">{spot.name} · Désaccord oracle</Badge>
                    <span class="mono text-sm font-bold tabular text-ko">{fmtDelta(delta)} / mois</span>
                  </div>
                  <div>
                    <h3 class="font-serif text-xl font-semibold text-ink">{spot.territory}</h3>
                    <p class="mt-1 text-sm leading-relaxed text-muted">{spot.summary}</p>
                  </div>

                  <div class="grid grid-cols-2 gap-3 rounded-[var(--radius)] border border-line bg-bg p-3">
                    <div>
                      <p class="text-[0.7rem] text-muted">Attendu par le test Inria</p>
                      <p class="mono mt-0.5 text-lg font-bold tabular text-ink">{fmtEur(spot.expectedCents)}</p>
                    </div>
                    <div>
                      <p class="text-[0.7rem] text-muted">Calculé depuis LEGI (agent)</p>
                      <p class="mono mt-0.5 text-lg font-bold tabular text-brand-strong">{fmtEur(spot.actualCents)}</p>
                    </div>
                  </div>
                </div>

                <div class="space-y-2 border-t border-line pt-3 text-xs">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <a href={spot.articleUrl} rel="external" class="inline-flex items-center gap-1 font-medium">
                      {spot.articleLabel}
                      <ExternalLink class="size-3" aria-hidden="true" />
                    </a>
                    <span class="mono text-[0.68rem] text-subtle">{spot.articleId}</span>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-muted">Contre-vérifications :</span>
                    {#each spot.verifications as v (v.url ?? v.family)}
                      <Badge variant="brand" size="sm">
                        {v.family ?? 'revue'} · {v.verdict ?? 'rapport'}
                      </Badge>
                    {/each}
                  </div>
                </div>
              </Card>
            {/each}
          </div>

          <!-- Graphique interactif des 14 cas en euros -->
          <Card variant="editorial" class="space-y-4">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 class="text-xl font-semibold">Comparer les 14 montants mensuels (Inria vs traduction aveugle LEGI)</h3>
                <p class="text-xs text-muted">
                  Résultat provisoire non relu par un humain · filtrez ou cliquez sur chaque barre pour inspecter l’écart exact.
                </p>
              </div>
              <a
                href="/experiences/allocations-familiales"
                class="inline-flex items-center gap-1 text-xs font-semibold text-brand-strong no-underline hover:underline"
              >
                Dossier complet C0.3
                <ArrowRight class="size-3.5" aria-hidden="true" />
              </a>
            </div>
            <C03EuroBars cases={data.c03.cases} />
          </Card>
        </div>
      {:else if tab === 'constats'}
        <div id="constats-c02" class="space-y-6">
          <div class="flex flex-wrap items-start justify-between gap-4 rounded-[var(--radius)] border border-notice-line/50 bg-notice/60 p-4 text-sm text-notice-ink">
            <div class="flex items-start gap-3">
              <AlertTriangle class="mt-0.5 size-4.5 shrink-0" aria-hidden="true" />
              <div>
                <p class="font-semibold">Fiches accessibles avant qualification humaine (transparence agents & relecteurs)</p>
                <p class="mt-0.5 text-xs leading-relaxed">
                  Ces constats ont été <strong>reproduits par une chaîne indépendante</strong> (XML DILA bruts / Tricoteuses), mais n’ont pas encore reçu de verdict humain signé. Ils ne sont pas comptés dans les anomalies qualifiées ({formatInt(snap?.findings.public ?? 0)}).
                </p>
              </div>
            </div>
            <a href="/api/findings?status=reproduced&limit=20" class="mono shrink-0 text-xs font-semibold text-notice-ink underline">
              JSON /api/findings →
            </a>
          </div>

          <div class="grid gap-6 lg:grid-cols-[22rem_1fr]">
            <Card variant="editorial" class="space-y-3">
              <h3 class="text-lg font-semibold">Entonnoir du balayage C0.2</h3>
              <SweepFunnel stages={funnelStages} />
            </Card>

            <div class="space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <SegmentedControl
                  bind:value={findingFilter}
                  ariaLabel="Filtrer les constats reproduits"
                  size="sm"
                  options={[
                    { value: 'all', label: 'Échantillon mixte', badge: snap?.reproducedPreview.length ?? 0 },
                    { value: 'SYNTAXE', label: 'Typographie', badge: snap?.pipeline.reproducedByType.SYNTAXE ?? 0 },
                    { value: 'REF_MORTE', label: 'Renvois abrogés', badge: snap?.pipeline.reproducedByType.REF_MORTE ?? 0 },
                  ]}
                />
                <span class="mono text-xs text-muted">
                  Cliquez une fiche pour lire le certificat complet
                </span>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                {#each filteredFindings.slice(0, 6) as item (item.id)}
                  <a
                    href={`/anomalies/${item.id}`}
                    class="group flex flex-col justify-between gap-3 rounded-[var(--radius)] border border-line bg-surface p-4 text-ink no-underline shadow-xs transition-all hover:border-brand hover:bg-surface-2/40"
                  >
                    <div class="space-y-2">
                      <div class="flex flex-wrap items-center justify-between gap-2">
                        <span class="mono text-xs font-bold text-brand-strong group-hover:underline">{item.id}</span>
                        <Badge variant="amber" size="sm">Reproduit · non qualifié</Badge>
                      </div>
                      <p class="text-xs font-semibold text-muted">
                        {item.typeLabel}
                        {#if item.articleCode || item.articleNum}
                          · <span class="text-ink">{[item.articleCode, item.articleNum ? `art. ${item.articleNum}` : null].filter(Boolean).join(' ')}</span>
                        {/if}
                      </p>
                      <p class="line-clamp-2 text-xs leading-relaxed text-ink">{item.claim}</p>
                      {#if item.excerpt}
                        <p class="rounded bg-surface-2 px-2.5 py-1.5 font-serif text-xs text-muted line-clamp-2">
                          …{item.excerpt.before}<mark class="rounded bg-notice px-1 text-notice-ink font-semibold">{item.excerpt.marked}</mark>{item.excerpt.after}…
                        </p>
                      {/if}
                    </div>
                    <div class="flex items-center justify-between border-t border-line pt-2 text-[0.7rem] text-muted">
                      <span class="mono truncate">{item.detector}</span>
                      <span class="inline-flex items-center gap-1 font-semibold text-brand-strong shrink-0">
                        Certificat
                        <ArrowRight class="size-3" aria-hidden="true" />
                      </span>
                    </div>
                  </a>
                {/each}
              </div>
            </div>
          </div>
        </div>
      {:else if example}
        <Card variant="editorial" padding="none" class="overflow-hidden">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2/60 px-5 py-4">
            <div>
              <p class="kicker">Exemple vérifié · Programme externe rejoué dans notre chaîne Catala 1.3.2</p>
              <h3 class="mt-1 font-serif text-2xl font-semibold text-ink">{example.title}</h3>
              <p class="mt-0.5 text-xs text-muted">
                {example.codeTitle} · <a href={`/article/${example.id}`}>Article {example.num ?? example.id}</a>
                {#if example.versionDate} · version du {formatLegiDate(example.versionDate)}{/if}
              </p>
            </div>
            <Badge variant="brand">
              <CheckCircle2 class="size-3.5" aria-hidden="true" />
              {plural(example.tests, 'test rejoué', 'tests rejoués')}
            </Badge>
          </div>

          <div class="grid divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0">
            <div class="p-5 sm:p-6">
              <p class="kicker">1 · Le texte officiel (LEGI / DILA)</p>
              <blockquote
                cite={example.legifranceUrl}
                class="legal-text mt-3 border-l-2 border-brand pl-4 text-ink wrap-anywhere"
              >
                {@html example.textHtml}
              </blockquote>
              <p class="mt-4 text-xs text-muted">
                <a href={example.legifranceUrl} rel="external" class="inline-flex items-center gap-1">
                  Lire sur Légifrance
                  <ExternalLink class="size-3" aria-hidden="true" />
                </a>
                · le texte officiel fait foi.
              </p>
            </div>

            <div class="flex flex-col justify-between gap-4 bg-bg/60 p-5 sm:p-6">
              <div class="space-y-3">
                <p class="kicker">2 · La règle exécutable (Inria · Catala)</p>
                <p class="text-base leading-relaxed text-ink">{example.description}</p>
                <p class="rounded-[var(--radius-sm)] border border-brand-line bg-brand-soft/60 p-3 text-xs text-brand-strong">
                  <strong>Rejeu réussi</strong> le <time datetime={example.replayDate}>{formatDateTime(example.replayDate)}</time> dans notre image Catala épinglée par digest. C’est ce que BugDeLoi vise à généraliser aux articles calculables.
                </p>
              </div>
              <div class="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-xs">
                <a href={example.sourceUrl} rel="external" class="inline-flex items-center gap-1 font-semibold">
                  Voir le code Catala sur GitHub
                  <ExternalLink class="size-3" aria-hidden="true" />
                </a>
                <a href="/references" class="font-semibold text-brand-strong">
                  Voir les {formatInt(totals.REF)} articles ★ →
                </a>
              </div>
            </div>
          </div>
        </Card>
      {:else}
        <EmptyState title="Aucun exemple de référence disponible pour le moment." />
      {/if}
    {/snippet}
  </Tabs>
</section>

<!-- ACTE 4 : BANDE OBSERVATOIRE SOMBRE #1 — LA COURSE DES CHANTIERS (façon pequalnp.com "The Race") -->
<section class="band-observatory obs-grid-bg py-14 sm:py-18" aria-labelledby="race-title">
  <div class="container-page space-y-10">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="max-w-3xl space-y-2">
        <p class="mono flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-obs-emerald">
          <GitBranch class="size-3.5" aria-hidden="true" />
          Cycle 0 · « Rejouer la science » avant d’ouvrir à l’inconnu
        </p>
        <h2 id="race-title" class="font-serif text-3xl font-semibold text-obs-ink sm:text-4xl">
          La course des chantiers
        </h2>
        <p class="text-sm leading-relaxed text-obs-muted">
          Chaque piste représente un chantier vérifiable et ses jalons mécaniques. Les jalons ambre signalent les étapes qui exigent une décision humaine.
        </p>
      </div>
      <a
        href="/methode"
        class="inline-flex items-center gap-1.5 text-sm font-semibold text-obs-emerald no-underline hover:underline"
      >
        Feuille de route & protocole
        <ArrowRight class="size-4" aria-hidden="true" />
      </a>
    </div>

    <ChantierRace tracks={raceTracks} />

    <!-- Grille compacte des suites Catala Inria rejouées -->
    {#if snap && snap.suites.length > 0}
      <div class="space-y-3 pt-2">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <p class="mono text-xs uppercase tracking-wider text-obs-muted">
            Suites de tests Inria rejouées · Catala 1.3.2 (ARM64)
          </p>
          <span class="mono text-xs text-obs-emerald tabular">
            {formatInt(totalInriaTests)}/{formatInt(totalInriaTests)} tests passés · 0 échec
          </span>
        </div>
        <div class="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {#each snap.suites.filter((s) => s.tests > 0) as suite (suite.subject)}
            <div class="card-obs p-3.5 flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="mono text-xs font-semibold text-obs-ink truncate">{suite.folder}</p>
                <p class="mt-0.5 text-[0.7rem] text-obs-muted tabular">
                  {suite.durationMs ? `${(suite.durationMs / 1000).toFixed(1)} s` : 'rejoué'}
                </p>
              </div>
              <span class="mono shrink-0 rounded-full border border-obs-emerald/35 bg-obs-emerald/12 px-2.5 py-0.5 text-xs font-bold tabular text-obs-emerald">
                {suite.passed}/{suite.tests}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</section>

<!-- ACTE 5 : BANDE OBSERVATOIRE SOMBRE #2 — LA CARTE INTERACTIVE DES 13 950 ARTICLES -->
<section id="carte-vivante" class="band-observatory border-t-0 py-14 sm:py-18" aria-labelledby="map-title">
  <div class="container-page space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="max-w-3xl space-y-2">
        <p class="mono flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-obs-amber">
          <Sparkles class="size-3.5" aria-hidden="true" />
          Cartographie vivante · CGI · CSS · CCH
        </p>
        <h2 id="map-title" class="font-serif text-3xl font-semibold text-obs-ink sm:text-4xl">
          {formatInt(inForceTotal)} articles en vigueur. {formatInt(totals.REF)} reliés à des programmes rejoués.
        </h2>
        <p class="text-sm text-obs-muted">
          Chaque rectangle représente une section proportionnelle à son nombre d’articles en vigueur. Activez « Surligner les ★ » pour repérer où la recherche a déjà formalisé le droit.
        </p>
      </div>
    </div>

    {#if data.mapPreviews.length > 0}
      <HomeTreemap
        previews={data.mapPreviews}
        onOpenSearch={() => shell?.openSearch()}
      />
    {:else}
      <div class="card-obs p-6 text-sm text-obs-muted">
        La carte interactive apparaîtra dès que la connexion à la base LEGI sera rétablie.
      </div>
    {/if}
  </div>
</section>

<!-- ACTE 6 : LE REGISTRE VIVANT (3 cartes éditoriales façon pequalnp.com) -->
<section class="container-page py-14 sm:py-18" aria-labelledby="record-title">
  <div class="flex flex-wrap items-baseline justify-between gap-4 pb-6">
    <div>
      <p class="kicker">Transparence & mémoire du projet</p>
      <h2 id="record-title" class="mt-1 text-3xl font-semibold sm:text-4xl">Dernières nouvelles du registre</h2>
    </div>
    <a href="/journal" class="text-sm font-semibold text-brand-strong no-underline hover:underline">
      Consulter tout le journal →
    </a>
  </div>

  <div class="grid gap-5 lg:grid-cols-3">
    <!-- Carte 1 : Depuis votre dernière visite -->
    <SinceLastVisit events={snap?.events ?? []} />

    <!-- Carte 2 : Point d'étape sombre contrasté (façon "FROM THE STRATEGY ORCHESTRATOR") -->
    <article class="flex h-full flex-col justify-between rounded-[var(--radius-lg)] border border-obs-line bg-obs-bg p-6 text-obs-ink shadow-[var(--shadow)]">
      <div class="space-y-3">
        <p class="mono text-[0.7rem] font-bold uppercase tracking-widest text-obs-emerald">
          Point d’étape · Cycle 0
        </p>
        <p class="font-serif text-xl leading-snug text-obs-ink">
          Sur 13 950 articles contrôlés, deux chaînes indépendantes (XML DILA bruts et Tricoteuses) ont confirmé
          <strong class="text-obs-amber">{formatInt(snap?.pipeline.reproducedCount ?? 0)} constats</strong>.
          En parallèle, la traduction aveugle C0.3 des allocations familiales atteint 12/17 et révèle deux divergences documentées contre le code Inria.
        </p>
      </div>
      <div class="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-obs-line pt-4 text-xs">
        <span class="mono text-obs-muted">Prochaine étape : qualification humaine</span>
        <a href="/experiences/allocations-familiales" class="font-semibold text-obs-emerald no-underline hover:underline">
          Lire l’audit C0.3 →
        </a>
      </div>
    </article>

    <!-- Carte 3 : Le Cimetière · In memoriam -->
    <article class="flex h-full flex-col justify-between rounded-[var(--radius-lg)] border border-line bg-surface p-5 shadow-xs">
      <div class="space-y-3">
        <p class="kicker">Le Cimetière · In memoriam</p>
        <p class="font-serif text-xl font-semibold text-ink">
          {snap?.pipeline.rejectedCount
            ? `${formatInt(snap.pipeline.rejectedCount)} constats rejetés par un humain`
            : 'Aucun rejet humain pour l’instant.'}
        </p>
        <p class="text-sm leading-relaxed text-muted">
          En amont, <strong class="text-ink">{formatInt(snap?.pipeline.withdrawnCount ?? 0)} constats</strong> ont déjà été retirés automatiquement après contre-vérification indépendante et correction des détecteurs (v1.1.0 : numéros réattribués, citations imbriquées).
        </p>
      </div>
      <div class="mt-5 flex items-center justify-between border-t border-line pt-3 text-xs">
        <span class="text-muted">Une réfutation vaut une preuve.</span>
        <a href="/anomalies/cimetiere" class="font-semibold text-brand-strong no-underline hover:underline">
          Voir le cimetière →
        </a>
      </div>
    </article>
  </div>
</section>

<!-- ACTE 7 : L'ÉCHELLE DE PREUVE INTERACTIVE -->
<section class="border-y border-line bg-surface py-14 sm:py-18" aria-labelledby="proof-title">
  <div class="container-page space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="max-w-3xl space-y-2">
        <p class="kicker">Règle d’or · Jamais confiance à un LLM seul</p>
        <h2 id="proof-title" class="text-3xl font-semibold sm:text-4xl">
          L’échelle des niveaux de preuve (N0 à N5 et ★)
        </h2>
        <p class="text-muted">
          Le juge est mécanique ou humain, jamais un modèle de langage. Cliquez sur un niveau pour voir exactement quel contrôle est exigé — et ce qui ne compte jamais.
        </p>
      </div>
      <a href="/methode#niveaux" class="text-sm font-semibold text-brand-strong no-underline hover:underline">
        Méthode complète →
      </a>
    </div>

    <ProofScaleInteractive counts={totals} initial="REF" />
  </div>
</section>

<!-- ACTE 8 : REJOINDRE L'EFFORT (MCP / WebMCP pour agents IA + Juristes relecteurs) -->
<section class="container-page pt-14 sm:pt-18" aria-labelledby="join-title">
  <div class="grid gap-6 lg:grid-cols-2">
    <Card variant="observatory" padding="lg" class="flex flex-col justify-between gap-6">
      <div class="space-y-4">
        <div class="flex items-center justify-between gap-2">
          <Badge variant="observatoryEmerald" pulse>MCP + WebMCP · Lecture & Desk</Badge>
          <span class="mono text-xs text-obs-muted">0 € · aucune clé API demandée</span>
        </div>
        <h2 id="join-title" class="font-serif text-3xl font-semibold text-obs-ink">
          Connectez votre agent IA à BugDeLoi
        </h2>
        <p class="text-sm leading-relaxed text-obs-muted">
          Votre agent tourne sur votre machine avec votre propre abonnement (Claude Code, Codex, Gemini CLI, Cursor, Ollama). Interrogez les 13 950 articles et les constats pré-qualification via notre serveur MCP, ou réservez une tâche sur le guichet.
        </p>
        <div class="rounded-[var(--radius)] border border-obs-line-strong bg-black/50 p-3.5">
          <div class="flex items-center justify-between gap-2 pb-2">
            <span class="mono flex items-center gap-1.5 text-[0.7rem] text-obs-emerald">
              <Terminal class="size-3.5" aria-hidden="true" />
              Ajouter le serveur MCP
            </span>
            <CopyButton text={claudeMcpCommand} label="Copier" tone="observatory" size="xs" />
          </div>
          <pre class="overflow-x-auto text-xs text-obs-ink"><code>{claudeMcpCommand}</code></pre>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <Button variant="observatory" size="md" onclick={() => shell?.openAgent()}>
          <Bot class="size-4" aria-hidden="true" />
          Tester MCP & WebMCP ici
        </Button>
        <Button href="/join" variant="observatoryOutline" size="md">
          Guide /join & guichet
        </Button>
        <a href="/api/mcp" class="mono text-xs text-obs-emerald no-underline hover:underline">
          GET /api/mcp →
        </a>
      </div>
    </Card>

    <Card variant="editorial" padding="lg" class="flex flex-col justify-between gap-6">
      <div class="space-y-4">
        <div class="flex items-center justify-between gap-2">
          <Badge variant="brand">Relecture juridique · Niveau N5</Badge>
          <span class="mono text-xs text-muted">Verdicts signés dans Git</span>
        </div>
        <h2 class="font-serif text-3xl font-semibold text-ink">
          Juristes, fiscalistes et citoyens : le dernier mot est humain
        </h2>
        <p class="text-sm leading-relaxed text-muted">
          Aucun constat mécanique ne devient une anomalie publiée et aucun article n’atteint le niveau N5 sans une revue humaine signée. Un premier dossier de 9 défauts typographiques reproduits et les deux écarts C0.3 (Guyane et Mayotte) attendent un regard juriste.
        </p>
        <ul class="space-y-2 text-sm text-ink">
          <li class="flex items-center gap-2.5">
            <FileSearch class="size-4 shrink-0 text-brand" aria-hidden="true" />
            <span>Chaque constat renvoie à l’extrait exact, à l’empreinte SHA-256 et à Légifrance.</span>
          </li>
          <li class="flex items-center gap-2.5">
            <CheckCircle2 class="size-4 shrink-0 text-brand" aria-hidden="true" />
            <span>Un rejet documenté est un résultat de premier rang, conservé au cimetière public.</span>
          </li>
        </ul>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <Button href="/anomalies" variant="primary" size="md">
          Registre des anomalies
          <ArrowRight class="size-4" aria-hidden="true" />
        </Button>
        <Button href="/design-system" variant="secondary" size="md">
          Design System
        </Button>
        <a href="/sponsors" class="text-sm font-semibold text-brand-strong no-underline hover:underline">
          Soutenir & transparence →
        </a>
      </div>
    </Card>
  </div>
</section>
