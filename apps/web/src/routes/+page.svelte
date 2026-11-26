<script lang="ts">
import { AlertTriangle, ArrowRight, Bot, CheckCircle2, ExternalLink, Terminal } from '@lucide/svelte'
import EmptyState from '#lib/components/EmptyState.svelte'
import { Button, CopyButton, HoverCard, SegmentedControl, Tabs } from '#lib/components/ui/index.ts'
import {
  C03EuroBars,
  ChantierRace,
  type FunnelStage,
  HomeTreemap,
  ProofScaleInteractive,
  type RaceTrack,
  SinceLastVisit,
  SweepFunnel,
} from '#lib/components/viz/index.ts'
import ProjectPipelineIllustration from '#lib/components/viz/ProjectPipelineIllustration.svelte'
import { getShellActions } from '#lib/context/shell.ts'
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

function humanActor(actor: string): string {
  if (actor === 'system:c0.1') return 'Audit des programmes Inria'
  if (actor === 'system:sweep') return 'Contrôle des trois codes'
  if (actor === 'system:ingest') return 'Import Légifrance'
  if (actor.startsWith('claude/')) return 'Vérification croisée · Anthropic'
  if (actor.startsWith('codex/')) return 'Vérification croisée · OpenAI'
  if (actor.startsWith('google/')) return 'Vérification croisée · Google'
  if (actor.startsWith('github:')) return `@${actor.slice(7)}`
  return actor
}

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
      label: 'Articles en vigueur contrôlés',
      count: p?.articlesChecked ?? inForceTotal,
      sublabel: 'Impôts, Sécurité sociale, Construction et habitation',
      detail:
        'Chaque article en vigueur à la date officielle est vérifié par quatre programmes déterministes, sans intelligence artificielle.',
      tone: 'neutral',
    },
    {
      id: 'links',
      label: 'Liens entre textes analysés',
      count: p?.linksTotal ?? 0,
      sublabel: 'Citations, modifications et abrogations suivies dans le temps',
      detail:
        'Un renvoi vers une ancienne version d’un article toujours en vigueur n’est pas signalé comme mort.',
      tone: 'cobalt',
    },
    {
      id: 'reproduced',
      label: 'Constats reproduits',
      count: p?.reproducedCount ?? 0,
      sublabel: `${formatInt(refMorte)} renvois vers un article abrogé · ${formatInt(syntaxe)} défauts typographiques`,
      detail:
        'Confirmés par une seconde vérification indépendante (archives officielles XML et « La loi sous git »). Consultables avant tout verdict humain.',
      tone: 'amber',
    },
    {
      id: 'qualified',
      label: 'Anomalies qualifiées',
      count: snap?.findings.public ?? 0,
      sublabel: 'Verdict humain signé dans Git',
      detail:
        'Aucun constat n’entre dans ce compteur avant relecture et verdict motivé d’un humain. Un premier lot de 9 défauts typographiques est prêt.',
      tone: 'emerald',
    },
  ]
})

const raceTracks = $derived.by<RaceTrack[]>(() => {
  const p = snap?.pipeline
  return [
    {
      id: 'c01',
      title: 'Vérification des programmes Inria',
      subtitle: 'Allocations, APL, impôt sur le revenu, successions',
      summary: `${formatInt(totalInriaTests)} tests verts · ${activeSuites.length} suites`,
      statusBadge: '100 % exécuté',
      statusTone: 'emerald',
      href: '/references',
      rungs: [
        {
          id: 'img',
          label: 'Compilateur Catala 1.3.2 figé',
          state: 'done',
          detail:
            'Environnement verrouillé par empreinte cryptographique pour obtenir exactement les mêmes résultats.',
        },
        {
          id: 'af',
          label: 'Allocations familiales (32 tests)',
          state: 'done',
          detail: '32 tests Inria réussis.',
        },
        {
          id: 'apl',
          label: 'Aides au logement (68 tests)',
          state: 'done',
          detail: '68 tests Inria réussis.',
        },
        {
          id: 'ir',
          label: 'Impôt sur le revenu (54 tests)',
          state: 'done',
          detail: '54 tests DGFiP / Inria réussis.',
        },
        {
          id: 'other',
          label: 'Successions et aides (17 tests)',
          state: 'done',
          detail: 'Successions (8), ASP (7) et prestations familiales (2) réussis.',
        },
        {
          id: 'ref',
          label: 'Report sur la carte ★',
          state: 'done',
          detail: `${formatInt(totals.REF)} articles en vigueur reliés sur la carte.`,
        },
      ],
    },
    {
      id: 'c02',
      title: 'Détection mécanique d’anomalies',
      subtitle: 'Renvois abrogés, numérotation et typographie',
      summary: `${formatInt(p?.reproducedCount ?? 0)} reproduits · ${formatInt(p?.withdrawnCount ?? 0)} écartés`,
      statusBadge: 'Relecture attendue',
      statusTone: 'amber',
      href: '/anomalies',
      rungs: [
        {
          id: 'ing',
          label: 'Chargement des trois codes',
          state: 'done',
          detail: `${formatInt(inForceTotal)} articles en vigueur et ${formatInt(p?.linksTotal ?? 0)} liens officiels chargés.`,
        },
        {
          id: 'det',
          label: 'Balayage déterministe',
          state: 'done',
          detail: 'Quatre détecteurs sans IA exécutés sur les textes en vigueur.',
        },
        {
          id: 'ind1',
          label: 'Vérification croisée n° 1',
          state: 'done',
          detail: '9 défauts typographiques confirmés ; 7 faux signalements détectés et retirés.',
        },
        {
          id: 'ind2',
          label: 'Vérification XML Légifrance',
          state: 'done',
          detail: '1 110 renvois vers articles abrogés confirmés sur les archives brutes.',
        },
        {
          id: 'qual',
          label: 'Verdict humain',
          state: 'blocked',
          detail: 'Dossier des 9 défauts typographiques prêt pour qualification signée.',
        },
        {
          id: 'pub',
          label: 'Publication au registre',
          state: 'todo',
          detail: 'Inscription au registre public des anomalies qualifiées.',
        },
      ],
    },
    {
      id: 'c03',
      title: 'Allocations familiales à l’aveugle',
      subtitle: 'Traduire la loi sans voir le code Inria',
      summary: `${data.c03.scores.completed.passed}/${data.c03.scores.completed.total} cas · 2 écarts contre Inria`,
      statusBadge: 'Contre-vérifié',
      statusTone: 'cobalt',
      href: '/experiences/allocations-familiales',
      rungs: [
        {
          id: 'pack',
          label: 'Textes officiels isolés',
          state: 'done',
          detail: 'Seuls les articles en vigueur et les données d’entrée sont fournis.',
        },
        {
          id: 'sub',
          label: 'Traduction exécutable',
          state: 'done',
          detail: 'Programme compilé sans erreur sous Catala 1.3.2.',
        },
        {
          id: 'audit',
          label: 'Comparaison chiffrée',
          state: 'done',
          detail: '9 montants identiques au centime, 3 écarts d’arrondi de 0,01 €, 2 désaccords.',
        },
        {
          id: 'xcheck',
          label: 'Double revue indépendante',
          state: 'done',
          detail: 'Anthropic et Google ont audité séparément Guyane et Mayotte.',
        },
        {
          id: 'hum',
          label: 'Arbitrage juriste',
          state: 'blocked',
          detail: 'Décision juridique attendue sur les deux écarts contre Inria.',
        },
        {
          id: 'n4',
          label: 'Tests sur 10 000 foyers',
          state: 'todo',
          detail: 'Passage au niveau N4 après arbitrage.',
        },
      ],
    },
    {
      id: 'c04_06',
      title: 'Impôt sur le revenu et effets de seuil',
      subtitle: 'Barème, quotient familial et décote (CGI 193–197)',
      summary: 'Guichet et MCP prêts',
      statusBadge: 'Prochain chantier',
      statusTone: 'muted',
      href: '/join',
      rungs: [
        {
          id: 'desk',
          label: 'Guichet et serveur MCP',
          state: 'done',
          detail: 'Accès ouvert aux agents IA et distribution de tâches prêts.',
        },
        {
          id: 'c04',
          label: 'Ambiguïtés connues',
          state: 'todo',
          detail: 'Retrouver les 21 questions juridiques déjà annotées par Inria.',
        },
        {
          id: 'c05',
          label: 'Noyau IR (art. 193–197)',
          state: 'todo',
          detail: 'Formalisation vérifiée contre le BOFiP et OpenFisca.',
        },
        {
          id: 'c06',
          label: 'Détecteur de falaises',
          state: 'todo',
          detail: 'Repérer les zones où un euro gagné réduit le revenu disponible.',
        },
      ],
    },
  ]
})

$effect(() => {
  let es: EventSource | null = null
  let poll: ReturnType<typeof setInterval> | null = null
  const refresh = async () => {
    try {
      const r = await fetch('/api/snapshot.json', { headers: { accept: 'application/json' } })
      if (r.ok) live = (await r.json()) as Snapshot
    } catch {
      // réseau indisponible
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
        // message illisible
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
  <title>BugDeLoi · vérifier la loi française comme un logiciel</title>
  <meta
    name="description"
    content="La loi française fixe des milliers de calculs (impôts, allocations familiales, aides au logement). BugDeLoi les traduit en formules vérifiables pour mesurer leur effet en euros et repérer les erreurs dans les textes officiels."
  />
</svelte:head>

<!-- BANDE 0 : Dernière nouvelle concrète (plein bord) -->
{#if latestEvent}
  <div class="bg-obs-bg text-obs-ink">
    <div class="container-wide flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 py-2.5 text-xs sm:text-[0.82rem]">
      <div class="flex min-w-0 items-center gap-3">
        <span class="inline-flex shrink-0 items-center gap-2 font-semibold text-obs-amber">
          <span class="live-dot" aria-hidden="true"></span>
          À l’instant
        </span>
        <a
          href={`/evenement/${latestEvent.id}`}
          class="truncate text-obs-ink/95 no-underline hover:text-obs-emerald hover:underline"
        >
          {latestEvent.headline}
        </a>
      </div>
      <div class="flex shrink-0 items-center gap-3 text-obs-muted">
        <time datetime={latestEvent.ts}>{relativeTime(latestEvent.ts)}</time>
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

<!-- BANDE 1 : HERO CLAIR POUR TOUS & JOURNAL EN DIRECT CONCRET -->
<section class="bg-bg" aria-labelledby="hero-title">
  <div class="container-wide py-14 sm:py-20 lg:py-24">
    <div class="grid gap-14 lg:grid-cols-12 lg:items-start">
      <div class="lg:col-span-7 space-y-7">
        <div class="space-y-5">
          <h1
            id="hero-title"
            class="font-serif text-[2.85rem] font-semibold leading-[1.03] tracking-tight text-ink sm:text-[4rem] lg:text-[4.65rem]"
          >
            Vérifier la loi française comme un logiciel.
          </h1>
          <p class="max-w-[58ch] font-serif text-xl leading-relaxed text-ink/90 sm:text-[1.42rem]">
            La loi fixe des milliers de calculs (impôts, allocations familiales, aides au logement), mais personne ne les teste comme un programme informatique. BugDeLoi traduit chaque article en formule vérifiable pour calculer son effet réel en euros et repérer les erreurs dans les textes officiels.
          </p>
          <p class="max-w-[58ch] text-base leading-relaxed text-muted">
            Des intelligences artificielles aident à lire et traduire les articles ; des tests automatiques et des juristes vérifient chaque résultat.
          </p>
        </div>

        {#if snap}
          <div class="space-y-3 border-y border-line py-6">
            <p class="flex flex-wrap items-baseline gap-x-3 gap-y-2 text-base text-ink sm:text-lg tabular">
              <span><strong class="font-serif text-2xl font-semibold sm:text-3xl">{formatInt(inForceTotal)}</strong> articles en vigueur</span>
              <span class="text-line-strong" aria-hidden="true">·</span>
              <span><strong class="font-serif text-2xl font-semibold text-brand-strong sm:text-3xl">{formatInt(totals.REF)} ★</strong> couverts par les tests Inria</span>
              <span class="text-line-strong" aria-hidden="true">·</span>
              <span><strong class="font-serif text-2xl font-semibold text-notice-ink sm:text-3xl">{formatInt(snap.pipeline.reproducedCount)}</strong> constats reproduits</span>
            </p>
            <p class="text-xs text-muted">
              {formatInt(totalInriaTests)} tests de recherche réussis · {formatInt(snap.findings.public)} anomalie qualifiée par un humain à ce jour ·
              <strong class="font-medium text-ink">Un compte, pas une probabilité.</strong>
              <a href="/methode#compteurs">Méthode →</a>
            </p>
          </div>
        {:else}
          <EmptyState title="Les chiffres en direct sont temporairement indisponibles.">
            Consultez <a href="/status">l’état du service</a>.
          </EmptyState>
        {/if}

        <div class="flex flex-wrap items-center gap-3.5 pt-1">
          <Button href="/experiences/revenu-disponible" variant="ink" size="lg">
            Simuler le revenu disponible
            <ArrowRight class="size-4" aria-hidden="true" />
          </Button>
          <Button href="/experiences/openfisca" variant="secondary" size="lg">
            Comparaison OpenFisca
          </Button>
          <Button href="/experiences/parlement" variant="ghost" size="lg">
            Veille parlementaire
          </Button>
        </div>
      </div>

      <!-- Journal en direct : titres factuels et chiffrés -->
      <aside
        class="min-w-0 lg:col-span-5 lg:border-l lg:border-line lg:pl-12 space-y-5"
        aria-labelledby="live-panel-title"
      >
        <div class="flex items-baseline justify-between gap-3">
          <h2 id="live-panel-title" class="flex items-center gap-2 text-sm font-semibold text-ink">
            <span class="live-dot" aria-hidden="true"></span>
            {sseConnected ? 'Journal en direct' : 'Dernières vérifications'}
          </h2>
          <a href="/journal" class="text-xs font-semibold text-brand-strong no-underline hover:underline">
            Tout le journal →
          </a>
        </div>

        {#if snap && snap.events.length > 0}
          <ul class="divide-y divide-line border-t border-line">
            {#each snap.events.slice(0, 4) as ev (ev.id)}
              <li class="min-w-0 py-4">
                <div class="flex items-baseline justify-between gap-3 text-xs">
                  <span class="min-w-0 truncate font-medium text-brand-strong">{humanActor(ev.actor)}</span>
                  <time datetime={ev.ts} class="shrink-0 text-subtle tabular">{relativeTime(ev.ts)}</time>
                </div>
                <a
                  href={`/evenement/${ev.id}`}
                  class="mt-1 block font-serif text-[1.12rem] font-medium leading-snug text-ink no-underline hover:text-brand-strong hover:underline"
                >
                  {ev.headline}
                </a>
                <p class="mt-1 text-xs leading-relaxed text-muted">
                  {ev.detail}
                </p>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="text-sm text-muted">En attente des premières opérations publiques.</p>
        {/if}
      </aside>
    </div>
  </div>
</section>

<!-- BANDE 1.2 : OUTILS ET DONNÉES OUVERTES (3 GRANDS WIDGETS) -->
<section id="outils-directs" class="border-t border-line bg-surface py-14 sm:py-16" aria-labelledby="outils-title">
  <div class="container-wide space-y-8">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="max-w-3xl space-y-2">
        <h2 id="outils-title" class="font-serif text-3xl font-semibold text-ink sm:text-4xl">
          Explorer nos simulateurs et données ouvertes
        </h2>
        <p class="text-base leading-relaxed text-muted">
          Trois portes d’entrée concrètes pour tester la loi en euros, vérifier nos calculs face à un moteur
          indépendant et mesurer l’effet d’un amendement parlementaire.
        </p>
      </div>
      <a href="/experiences" class="text-sm font-semibold text-brand-strong no-underline hover:underline">
        Toutes les expériences →
      </a>
    </div>

    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Widget 1 : Simulateur multi-lois -->
      <article class="flex flex-col justify-between rounded-2xl border border-line bg-bg p-6 sm:p-7">
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-2">
            <span class="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-strong">
              Simulateur multi-lois · C0.7
            </span>
            <span class="text-xs font-medium text-muted">100 % navigateur</span>
          </div>
          <h3 class="font-serif text-2xl font-semibold text-ink">
            Revenu disponible réel et effets de seuil
          </h3>
          <p class="text-sm leading-relaxed text-muted">
            Croisez en direct l’impôt sur le revenu 2026 (garde alternée, demi-parts art. 195), les allocations
            familiales, l’APL, le RSA et la Prime d’activité pour observer l’effet du dernier euro gagné.
          </p>
          <div class="rounded-xl border border-line bg-surface p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-muted">Chute candidate détectée (sortie RSA)</p>
            <p class="mt-1 font-serif text-2xl font-semibold text-ko tabular">−1 055,96 € / an</p>
            <p class="mt-0.5 text-xs text-muted">à 12 192 € de revenu · couple 2 enfants, loyer 750 €</p>
          </div>
        </div>
        <div class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <a
            href="/experiences/revenu-disponible"
            class="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-brand-strong"
          >
            Ouvrir le simulateur
            <ArrowRight class="size-4" aria-hidden="true" />
          </a>
          <a
            href="https://github.com/theonaciri/bugdeloi/blob/main/replications/c0.7/summary.json"
            rel="external"
            class="text-xs font-semibold text-muted no-underline hover:text-ink hover:underline"
          >
            Données JSON →
          </a>
        </div>
      </article>

      <!-- Widget 2 : Oracle OpenFisca-France -->
      <article class="flex flex-col justify-between rounded-2xl border border-line bg-bg p-6 sm:p-7">
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-2">
            <span class="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-strong">
              Oracle indépendant · C0.8
            </span>
            <span class="text-xs font-medium text-muted">OpenFisca 177.1.4</span>
          </div>
          <h3 class="font-serif text-2xl font-semibold text-ink">
            Comparaison croisée avec OpenFisca-France
          </h3>
          <p class="text-sm leading-relaxed text-muted">
            Confrontation automatique de nos moteurs sur 328 foyers : 100 % d’accord exact sur les allocations
            familiales dans le périmètre et identification d’un candidat d’arrondi sur l’impôt sur le revenu.
          </p>
          <div class="rounded-xl border border-line bg-surface p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-muted">Candidat ARRONDI à 17 593 €</p>
            <p class="mt-1 font-serif text-2xl font-semibold text-notice-ink tabular">61 € vs 0 €</p>
            <p class="mt-0.5 text-xs text-muted">24 écarts tous expliqués par l’ordre d’arrondi avant décote</p>
          </div>
        </div>
        <div class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <a
            href="/experiences/openfisca"
            class="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-brand-strong"
          >
            Voir la comparaison
            <ArrowRight class="size-4" aria-hidden="true" />
          </a>
          <a
            href="https://github.com/theonaciri/bugdeloi/blob/main/replications/c0.8-openfisca/REPORT.md"
            rel="external"
            class="text-xs font-semibold text-muted no-underline hover:text-ink hover:underline"
          >
            Rapport complet →
          </a>
        </div>
      </article>

      <!-- Widget 3 : Amendements (Tricoteuses) -->
      <article class="flex flex-col justify-between rounded-2xl border border-line bg-bg p-6 sm:p-7">
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-2">
            <span class="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-strong">
              Veille parlementaire · Tricoteuses
            </span>
            <span class="text-xs font-medium text-muted">42 tests verts</span>
          </div>
          <h3 class="font-serif text-2xl font-semibold text-ink">
            Impact d’un amendement en euros
          </h3>
          <p class="text-sm leading-relaxed text-muted">
            Lecture stricte du dispositif d’amendements ciblant nos 7 articles formalisés. Toute clause non reconnue
            bascule en <code>non_calculable</code> ; pour les autres, l’écart annuel est chiffré sur 4 foyers types.
          </p>
          <div class="rounded-xl border border-line bg-surface p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-muted">Couverture actuelle</p>
            <p class="mt-1 font-serif text-2xl font-semibold text-ink tabular">7 articles suivis</p>
            <p class="mt-0.5 text-xs text-muted">Code général des impôts &amp; Code de la sécurité sociale</p>
          </div>
        </div>
        <div class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <a
            href="/experiences/parlement"
            class="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-brand-strong"
          >
            Voir les exemples
            <ArrowRight class="size-4" aria-hidden="true" />
          </a>
          <a
            href="https://github.com/theonaciri/bugdeloi/tree/main/packages/parlement"
            rel="external"
            class="text-xs font-semibold text-muted no-underline hover:text-ink hover:underline"
          >
            Code source →
          </a>
        </div>
      </article>
    </div>
  </div>
</section>

<!-- BANDE 1.5 : COMMENT FONCTIONNE BUGDELOI & ÉTAT DU PROJET -->
<section id="fonctionnement" class="border-t border-line bg-bg py-16 sm:py-20" aria-labelledby="pipeline-title">
  <div class="container-wide space-y-8">
    <div class="max-w-3xl space-y-2.5">
      <h2 id="pipeline-title" class="font-serif text-3xl font-semibold text-ink sm:text-4xl">
        Comment fonctionne BugDeLoi et où en est le projet
      </h2>
      <p class="text-base leading-relaxed text-muted sm:text-lg">
        De l’import automatique des lois chaque nuit jusqu’aux simulateurs gratuits dans votre navigateur : chaque
        étape est publique, reproductible et mesurée en direct.
      </p>
    </div>
    <ProjectPipelineIllustration
      inForceArticles={inForceTotal}
      refArticles={totals.REF}
      reproducedSignals={snap?.pipeline.reproducedCount ?? 0}
      openDeskTasks={snap?.desk.open ?? 0}
    />
  </div>
</section>

<!-- BANDE 2 : DE LA LOI AU MONTANT EN EUROS & CONSTATS REPRODUITS -->
<section id="impact-euros" class="border-t border-line bg-surface py-18 sm:py-24" aria-labelledby="impact-title">
  <div class="container-wide space-y-10">
    <div class="max-w-3xl space-y-3">
      <h2 id="impact-title" class="font-serif text-3xl font-semibold text-ink sm:text-5xl">
        De l’article de loi au montant en euros
      </h2>
      <p class="text-base leading-relaxed text-muted sm:text-lg">
        Consultez nos premiers résultats vérifiables : des écarts chiffrés sur les allocations familiales, les constats mécaniques ouverts avant verdict humain, et un exemple d’article traduit par la recherche publique.
      </p>
    </div>

    <Tabs
      defaultValue="c03"
      ariaLabel="Résultats vérifiables de BugDeLoi"
      items={[
        { value: 'c03', label: 'Allocations familiales (impact €)', badge: `${data.c03.scores.completed.passed}/${data.c03.scores.completed.total}` },
        { value: 'constats', label: 'Constats reproduits avant verdict', badge: formatInt(snap?.pipeline.reproducedCount ?? 0) },
        { value: 'inria', label: 'Texte officiel et code Inria ★', badge: `${formatInt(totals.REF)} ★` },
      ]}
    >
      {#snippet panel(tab)}
        {#if tab === 'c03'}
          <div class="space-y-12 pt-4">
            <p class="max-w-[75ch] text-sm leading-relaxed text-muted">
              Pour tester notre méthode, nous avons fait programmer les allocations familiales à partir du texte de loi seul, puis comparé chaque montant à celui du programme de référence écrit par les chercheurs d’<HoverCard>
                {#snippet trigger()}Inria{/snippet}
                {#snippet content()}
                  <p class="font-semibold text-ink">Inria (Institut national de recherche en sciences du numérique)</p>
                  <p class="mt-1 text-xs leading-relaxed text-muted">
                    Les chercheurs d’Inria ont créé le langage Catala et codé plusieurs prestations françaises publiques (allocations familiales, APL, impôt sur le revenu). Leurs programmes nous servent de base de comparaison.
                  </p>
                {/snippet}
              </HoverCard>.
              Sur 14 situations chiffrées, <strong class="text-ink">9 tombent juste au centime</strong>, 3 diffèrent d’un centime d’arrondi, et <strong class="text-ink">2 révèlent un désaccord sur ce que prévoit réellement la loi en vigueur</strong> :
            </p>

            <!-- Deux cas phares : Guyane & Mayotte, explicites sur qui donne quel montant -->
            <div class="grid gap-8 lg:grid-cols-2">
              {#each data.c03.spotlights as spot (spot.name)}
                {@const delta = spot.actualCents - spot.expectedCents}
                <article class="flex flex-col justify-between gap-6 rounded-[var(--radius-xl)] bg-bg p-7 sm:p-9">
                  <div class="space-y-5">
                    <div class="flex flex-wrap items-baseline justify-between gap-3">
                      <h3 class="font-serif text-2xl font-semibold text-ink">{spot.territory}</h3>
                      <span class="font-serif text-2xl font-semibold tabular text-ko">
                        {fmtDelta(delta)} <span class="text-sm font-normal text-muted">/ mois</span>
                      </span>
                    </div>

                    <dl class="grid gap-6 border-y border-line py-5 sm:grid-cols-2">
                      <div>
                        <dt class="text-xs font-semibold text-muted">Montant du programme Inria</dt>
                        <dd class="font-serif mt-1 text-3xl font-semibold tabular text-ink">
                          {fmtEur(spot.expectedCents)}
                        </dd>
                        <dd class="mt-1.5 text-xs leading-relaxed text-muted">{spot.inriaWhy}</dd>
                      </div>
                      <div>
                        <dt class="text-xs font-semibold text-brand-strong">Ce que donne la loi en vigueur</dt>
                        <dd class="font-serif mt-1 text-3xl font-semibold tabular text-brand-strong">
                          {fmtEur(spot.actualCents)}
                        </dd>
                        <dd class="mt-1.5 text-xs leading-relaxed text-muted">{spot.lawWhy}</dd>
                      </div>
                    </dl>

                    <p class="text-sm leading-relaxed text-ink">{spot.summary}</p>
                  </div>

                  <div class="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-muted">
                    <a href={spot.articleUrl} rel="external" class="inline-flex items-center gap-1 font-medium">
                      {spot.articleLabel}
                      <ExternalLink class="size-3" aria-hidden="true" />
                    </a>
                    <span>
                      Relectures :
                      {spot.verifications.map((v) => `${v.family ?? 'indépendante'} (${v.verdict ?? 'rapport'})`).join(' · ')}
                    </span>
                  </div>
                </article>
              {/each}
            </div>

            <div class="space-y-5">
              <div class="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <h3 class="font-serif text-2xl font-semibold text-ink">
                    Les 14 montants mensuels comparés
                  </h3>
                  <p class="mt-1 text-sm text-muted">
                    Résultat provisoire en attente de validation par un juriste · cliquez sur une ligne pour lire l’explication.
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
          <div id="constats-c02" class="space-y-8 pt-4">
            <div class="flex flex-wrap items-start justify-between gap-4 rounded-[var(--radius-lg)] bg-notice/70 p-5 text-sm text-notice-ink">
              <div class="flex items-start gap-3 max-w-4xl">
                <AlertTriangle class="mt-0.5 size-4.5 shrink-0" aria-hidden="true" />
                <p class="leading-relaxed">
                  <strong>En attente de verdict humain :</strong> ces constats ont été confirmés par une vérification indépendante sur les fichiers officiels de Légifrance et sont ouverts à tous (juristes, journalistes, agents). Ils ne comptent pas encore parmi les anomalies qualifiées ({formatInt(snap?.findings.public ?? 0)}).
                </p>
              </div>
              <a href="/api/findings?status=reproduced&limit=20" class="shrink-0 text-xs font-semibold text-notice-ink underline">
                Export JSON →
              </a>
            </div>

            <div class="grid gap-12 lg:grid-cols-[23rem_1fr] lg:items-start">
              <div class="space-y-4">
                <h3 class="font-serif text-xl font-semibold text-ink">Entonnoir du contrôle mécanique</h3>
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
                  <span class="text-xs text-muted">Ouvrir un constat affiche son certificat reproductible</span>
                </div>

                <div class="divide-y divide-line border-y border-line">
                  {#each filteredFindings.slice(0, 6) as item (item.id)}
                    <a
                      href={`/anomalies/${item.id}`}
                      class="group block px-2 py-4 text-ink no-underline transition-colors hover:bg-bg/80"
                    >
                      <div class="flex flex-wrap items-baseline justify-between gap-2">
                        <span class="font-semibold text-sm text-brand-strong group-hover:underline">
                          {item.typeLabel}
                          {#if item.articleCode || item.articleNum}
                            <span class="font-normal text-muted">
                              · {[item.articleCode, item.articleNum ? `art. ${item.articleNum}` : null].filter(Boolean).join(' ')}
                            </span>
                          {/if}
                        </span>
                        <span class="mono text-xs text-subtle">{item.id}</span>
                      </div>
                      <p class="mt-1.5 text-sm leading-relaxed text-ink">{item.claim}</p>
                      {#if item.excerpt}
                        <p class="mt-2 font-serif text-sm text-muted line-clamp-2">
                          « …{item.excerpt.before}<mark class="rounded bg-notice px-1 text-notice-ink font-semibold">{item.excerpt.marked}</mark>{item.excerpt.after}… »
                        </p>
                      {/if}
                    </a>
                  {/each}
                </div>
              </div>
            </div>
          </div>
        {:else if example}
          <div class="space-y-8 pt-4">
            <div class="flex flex-wrap items-baseline justify-between gap-4 border-b border-line pb-5">
              <div>
                <h3 class="font-serif text-3xl font-semibold text-ink">{example.title}</h3>
                <p class="mt-1 text-sm text-muted">
                  {example.codeTitle} · <a href={`/article/${example.id}`}>Article {example.num ?? example.id}</a>
                  {#if example.versionDate} · version du {formatLegiDate(example.versionDate)}{/if}
                </p>
              </div>
              <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-strong">
                <CheckCircle2 class="size-4" aria-hidden="true" />
                {plural(example.tests, 'test Inria exécuté', 'tests Inria exécutés')}
              </span>
            </div>

            <div class="grid gap-10 md:grid-cols-2 md:items-start">
              <div class="space-y-4">
                <h4 class="text-sm font-semibold text-ink">Texte officiel (Légifrance)</h4>
                <blockquote cite={example.legifranceUrl} class="legal-text text-ink wrap-anywhere">
                  {@html example.textHtml}
                </blockquote>
                <p class="text-xs text-muted">
                  <a href={example.legifranceUrl} rel="external" class="inline-flex items-center gap-1">
                    Lire sur Légifrance
                    <ExternalLink class="size-3" aria-hidden="true" />
                  </a>
                  · seul le texte publié fait foi.
                </p>
              </div>

              <div class="rounded-[var(--radius-xl)] bg-bg p-7 sm:p-8 space-y-5">
                <h4 class="text-sm font-semibold text-ink">Règle calculée par le programme Inria</h4>
                <p class="font-serif text-xl leading-relaxed text-ink">{example.description}</p>
                <p class="text-sm leading-relaxed text-muted">
                  Tests exécutés avec succès le <time datetime={example.replayDate}>{formatDateTime(example.replayDate)}</time> sous Catala 1.3.2.
                </p>
                <div class="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm">
                  <a href={example.sourceUrl} rel="external" class="inline-flex items-center gap-1 font-semibold">
                    Code Catala sur GitHub
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

<!-- BANDE 3 : AVANCEMENT DES CHANTIERS (bande charbon plein bord) -->
<section class="band-observatory py-18 sm:py-24" aria-labelledby="race-title">
  <div class="container-wide space-y-12">
    <div class="flex flex-wrap items-end justify-between gap-6">
      <div class="max-w-3xl space-y-3">
        <h2 id="race-title" class="font-serif text-3xl font-semibold text-obs-ink sm:text-5xl">
          Où en sont les chantiers
        </h2>
        <p class="text-base leading-relaxed text-obs-muted">
          Avant de publier des constats inédits, nous vérifions notre méthode en exécutant les programmes et tests que la recherche publique a déjà établis.
        </p>
      </div>
      <a
        href="/methode"
        class="inline-flex items-center gap-1.5 text-sm font-semibold text-obs-emerald no-underline hover:underline"
      >
        Lire le protocole
        <ArrowRight class="size-4" aria-hidden="true" />
      </a>
    </div>

    <ChantierRace tracks={raceTracks} />

    {#if snap && activeSuites.length > 0}
      <div class="space-y-4 border-t border-obs-line/80 pt-10">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <p class="text-sm font-medium text-obs-ink">
            Suites de tests Inria et DGFiP exécutées chez nous
          </p>
          <span class="text-sm font-semibold tabular text-obs-emerald">
            {formatInt(totalInriaTests)} sur {formatInt(totalInriaTests)} réussis
          </span>
        </div>
        <div class="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
          {#each activeSuites as suite (suite.subject)}
            <div class="flex items-baseline justify-between gap-3 border-b border-obs-line/70 py-2.5">
              <span class="truncate text-sm text-obs-muted">{suite.folder.replaceAll('_', ' ')}</span>
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

<!-- BANDE 4 : CARTE INTERACTIVE PLEINE LARGEUR -->
<section id="carte-vivante" class="band-observatory border-t border-obs-line/60 py-18 sm:py-24" aria-labelledby="map-title">
  <div class="container-wide space-y-8">
    <div class="max-w-3xl space-y-2">
      <h2 id="map-title" class="font-serif text-3xl font-semibold text-obs-ink sm:text-5xl">
        La carte des trois codes
      </h2>
      <p class="text-base text-obs-muted">
        Chaque rectangle reflète la taille d’une section ; activez les étoiles ★ pour situer les articles déjà couverts par des tests.
      </p>
    </div>

    {#if data.mapPreviews.length > 0}
      <HomeTreemap previews={data.mapPreviews} onOpenSearch={() => shell?.openSearch()} />
    {:else}
      <p class="text-sm text-obs-muted">
        La carte interactive apparaîtra dès le retour de la base des textes.
      </p>
    {/if}
  </div>
</section>

<!-- BANDE 5 : ÉCHELLE DE PREUVE -->
<section class="bg-surface py-18 sm:py-24" aria-labelledby="proof-title">
  <div class="container-wide space-y-10">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div class="max-w-3xl space-y-2">
        <h2 id="proof-title" class="font-serif text-3xl font-semibold text-ink sm:text-4xl">
          L’échelle des niveaux de preuve
        </h2>
        <p class="text-base text-muted">
          Nous n’écrivons jamais qu’un article est « prouvé » : chaque palier indique le contrôle mécanique ou humain qui a réussi.
        </p>
      </div>
      <a href="/methode#niveaux" class="text-sm font-semibold text-brand-strong no-underline hover:underline">
        Méthode complète →
      </a>
    </div>

    <ProofScaleInteractive counts={totals} initial="REF" />
  </div>
</section>

<!-- BANDE 6 : MÉMOIRE DU PROJET & PARTICIPATION -->
<section class="border-t border-line bg-bg py-18 sm:py-24" aria-labelledby="join-title">
  <div class="container-wide space-y-12">
    <div class="grid gap-6 lg:grid-cols-2">
      <SinceLastVisit events={snap?.events ?? []} />

      <article class="flex h-full flex-col justify-between rounded-[var(--radius-xl)] bg-surface p-7 sm:p-8">
        <div class="space-y-3">
          <h2 class="font-serif text-2xl font-semibold text-ink">Le Cimetière · erreurs assumées</h2>
          <p class="text-sm leading-relaxed text-muted">
            {snap?.pipeline.rejectedCount
              ? `${formatInt(snap.pipeline.rejectedCount)} constats écartés par relecture humaine, et `
              : ''}
            <strong class="text-ink">{formatInt(snap?.pipeline.withdrawnCount ?? 0)} signalements</strong> déjà retirés automatiquement après correction de nos détecteurs (numéros réattribués, citations imbriquées). Une réfutation documentée vaut une preuve.
          </p>
        </div>
        <div class="mt-6">
          <a href="/anomalies/cimetiere" class="text-sm font-semibold text-brand-strong no-underline hover:underline">
            Ouvrir le cimetière public →
          </a>
        </div>
      </article>
    </div>

    <div class="grid gap-8 border-t border-line pt-12 lg:grid-cols-2">
      <div class="space-y-5">
        <h2 id="join-title" class="font-serif text-3xl font-semibold text-ink sm:text-4xl">
          Relire comme juriste, journaliste ou citoyen
        </h2>
        <p class="max-w-[54ch] text-base leading-relaxed text-muted">
          Les machines balaient des milliers d’articles, mais le verdict final reste humain. Chaque fiche donne accès à l’extrait officiel, au lien Légifrance et à la commande de vérification.
        </p>
        <div class="flex flex-wrap items-center gap-3 pt-1">
          <Button href="/anomalies" variant="ink" size="md">
            Consulter le registre
            <ArrowRight class="size-4" aria-hidden="true" />
          </Button>
          <Button href="/sponsors" variant="secondary" size="md">
            Transparence et soutien
          </Button>
        </div>
      </div>

      <div class="rounded-[var(--radius-xl)] bg-obs-bg p-7 sm:p-9 text-obs-ink space-y-5">
        <div class="space-y-2">
          <h2 class="font-serif text-2xl font-semibold text-obs-ink sm:text-3xl">
            Connecter un agent IA (MCP et WebMCP)
          </h2>
          <p class="text-sm leading-relaxed text-obs-muted">
            Toutes les données publiques sont interrogeables sans clé API via <code class="text-obs-ink">/api/mcp</code>, et chaque contrôle de cette page est pilotable en WebMCP.
          </p>
        </div>

        <div class="rounded-[var(--radius)] bg-obs-surface p-3.5">
          <div class="flex items-center justify-between gap-2 pb-2">
            <span class="mono inline-flex items-center gap-1.5 text-xs text-obs-emerald">
              <Terminal class="size-3.5" aria-hidden="true" />
              Commande MCP
            </span>
            <CopyButton text={claudeMcpCommand} label="Copier" tone="observatory" size="xs" />
          </div>
          <pre class="overflow-x-auto text-xs text-obs-ink/90"><code>{claudeMcpCommand}</code></pre>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <Button variant="observatory" size="sm" onclick={() => shell?.openAgent()}>
            <Bot class="size-4" aria-hidden="true" />
            Tester ici
          </Button>
          <Button href="/join" variant="observatoryOutline" size="sm">
            Mode d’emploi /join
          </Button>
          <a href="/design-system" class="text-xs font-semibold text-obs-emerald no-underline hover:underline">
            Design System →
          </a>
        </div>
      </div>
    </div>
  </div>
</section>
