<script lang="ts">
import '../app.css'
import { Bot, Menu, Search, X } from '@lucide/svelte'
import { type BugDeLoiWebMcpState, initBugDeLoiWebMcp } from '#lib/agent/webmcp.ts'
import FictionalNotice from '#lib/components/FictionalNotice.svelte'
import PatternDefs from '#lib/components/PatternDefs.svelte'
import { AgentDrawer, Button, CommandSearch } from '#lib/components/ui/index.ts'
import { setShellActions } from '#lib/context/shell.ts'
import { cn } from '#lib/utils/cn.ts'
import { page } from '$app/state'
import icon from '../../../../assets/icon.svg'
import type { LayoutProps } from './$types'

let { children, data }: LayoutProps = $props()

let searchOpen = $state(false)
let agentOpen = $state(false)
let mobileNavOpen = $state(false)
let webMcpState = $state<BugDeLoiWebMcpState>({
  ready: false,
  webMcpDetected: false,
  webMcpTarget: 'none',
  registeredTools: [],
  uiComponentsCount: 0,
  lastAction: null,
})

setShellActions({
  openSearch: () => {
    searchOpen = true
  },
  openAgent: () => {
    agentOpen = true
  },
  getWebMcpState: () => webMcpState,
})

$effect(() => {
  return initBugDeLoiWebMcp((next) => {
    webMcpState = next
  })
})

const nav = [
  { href: '/carte', label: 'Carte' },
  { href: '/taches', label: 'Tâches' },
  { href: '/live', label: 'En direct' },
  { href: '/anomalies', label: 'Constats' },
  { href: '/experiences', label: 'Expériences' },
  { href: '/methode', label: 'Méthode' },
  { href: '/journal', label: 'Journal' },
]

const current = (item: { href: string; matchPrefix?: string }) => {
  const prefix = item.matchPrefix ?? item.href
  return page.url.pathname === prefix || page.url.pathname.startsWith(`${prefix}/`)
}
</script>

<svelte:head>
  <link rel="icon" href={icon} type="image/svg+xml" />
</svelte:head>

<a
  href="#contenu"
  class="sr-only-focusable fixed left-3 top-3 z-50 rounded-[var(--radius)] border border-brand bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-md"
>
  Aller au contenu
</a>

<!-- Bandeau permanent citoyen (AGENTS.md §9.5) -->
<div class="bg-[var(--banner-bg)] text-[var(--banner-ink)]">
  <div class="container-wide flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2 text-xs">
    <p class="text-[0.76rem] text-[var(--banner-ink)]/85">
      Site citoyen indépendant · pas un service officiel · pas un conseil juridique
    </p>
    <div class="hidden items-center gap-4 text-[0.74rem] sm:flex">
      <button
        type="button"
        onclick={() => (agentOpen = true)}
        class="inline-flex items-center gap-1.5 text-[var(--banner-ink)]/80 hover:text-white cursor-pointer"
      >
        <Bot class="size-3.5 text-obs-emerald" aria-hidden="true" />
        <span>Accès agents · MCP</span>
      </button>
      <a href="/status" class="text-[var(--banner-ink)]/75 no-underline hover:text-white hover:underline">
        État du service
      </a>
    </div>
  </div>
</div>

{#if data.fictional}<FictionalNotice />{/if}

<header class="sticky top-0 z-40 border-b border-line/80 bg-bg/92 backdrop-blur-md">
  <div class="container-wide flex h-17 items-center justify-between gap-4">
    <a href="/" class="flex items-center gap-2.5 text-ink no-underline shrink-0">
      <img src={icon} alt="" width="28" height="28" />
      <span class="font-display text-[1.35rem] font-extrabold tracking-tight [font-stretch:118%]">BugDeLoi</span>
      <span class="hidden text-xs text-muted 2xl:inline">· observatoire du droit calculable</span>
    </a>

    <nav aria-label="Navigation principale" class="hidden lg:block">
      <ul class="flex items-center gap-1">
        {#each nav as item (item.href)}
          <li>
            <a
              href={item.href}
              aria-current={current(item) ? 'page' : undefined}
              class={cn(
                'relative block whitespace-nowrap px-3 py-2 text-[0.9rem] font-medium text-muted no-underline transition-colors hover:text-ink',
                "after:absolute after:inset-x-3 after:-bottom-[0.95rem] after:h-[3px] after:bg-transparent after:content-['']",
                'aria-[current=page]:text-ink aria-[current=page]:font-semibold aria-[current=page]:after:bg-brand',
              )}
            >
              {item.label}
            </a>
          </li>
        {/each}
      </ul>
    </nav>

    <div class="flex items-center gap-2 shrink-0">
      <button
        type="button"
        onclick={() => (searchOpen = true)}
        aria-label="Rechercher un article de loi ou un constat"
        class="inline-flex h-9 items-center gap-2 rounded-[var(--radius)] bg-surface-2/85 px-3.5 text-xs font-medium text-muted transition-colors hover:bg-surface-3 hover:text-ink cursor-pointer"
      >
        <Search class="size-3.5" aria-hidden="true" />
        <span class="hidden md:inline">Rechercher un article…</span>
        <kbd class="mono hidden rounded bg-bg px-1.5 py-0.5 text-[0.65rem] text-muted sm:inline">/</kbd>
      </button>


      <div class="hidden sm:block">
        <Button href="/join" variant="ink" size="sm">Participer</Button>
      </div>

      <button
        type="button"
        onclick={() => (mobileNavOpen = !mobileNavOpen)}
        aria-expanded={mobileNavOpen}
        aria-label="Ouvrir le menu de navigation"
        class="inline-flex size-9 items-center justify-center rounded-[var(--radius)] bg-surface-2 text-ink lg:hidden cursor-pointer"
      >
        {#if mobileNavOpen}
          <X class="size-4" aria-hidden="true" />
        {:else}
          <Menu class="size-4" aria-hidden="true" />
        {/if}
      </button>
    </div>
  </div>

  {#if mobileNavOpen}
    <nav aria-label="Navigation mobile" class="border-t border-line bg-surface px-5 py-4 lg:hidden">
      <ul class="grid gap-1">
        {#each nav as item (item.href)}
          <li>
            <a
              href={item.href}
              onclick={() => (mobileNavOpen = false)}
              aria-current={current(item) ? 'page' : undefined}
              class="block rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium text-ink no-underline hover:bg-surface-2 aria-[current=page]:bg-surface-2 aria-[current=page]:font-semibold"
            >
              {item.label}
            </a>
          </li>
        {/each}
        <li class="pt-3 flex gap-2">
          <Button href="/join" variant="ink" size="sm" class="flex-1" onclick={() => (mobileNavOpen = false)}>
            Participer
          </Button>
          <Button variant="secondary" size="sm" onclick={() => { mobileNavOpen = false; agentOpen = true }}>
            MCP
          </Button>
        </li>
      </ul>
    </nav>
  {/if}
</header>

<PatternDefs />
<CommandSearch bind:open={searchOpen} />
<AgentDrawer bind:open={agentOpen} {webMcpState} />

<main id="contenu" tabindex="-1" class="outline-none">
  {@render children()}
</main>

<footer class="border-t border-line bg-surface">
  <div class="container-wide grid gap-10 py-14 text-sm text-muted md:grid-cols-2 lg:grid-cols-4">
    <div class="space-y-3">
      <a href="/" class="flex items-center gap-2 text-ink no-underline">
        <img src={icon} alt="" width="24" height="24" />
        <span class="font-display text-lg font-semibold">BugDeLoi</span>
      </a>
      <p class="leading-relaxed">
        Observatoire citoyen qui formalise le droit calculable français en code exécutable, documente chaque écart de manière reproductible et publie ses données en accès libre.
      </p>
    </div>

    <nav aria-label="Explorer">
      <p class="kicker mb-3 text-ink">Explorer</p>
      <ul class="space-y-2">
        <li><a href="/carte">Carte des codes (CGI, CSS, CCH)</a></li>
        <li><a href="/experiences/allocations-familiales">Allocations familiales · comparaison en euros</a></li>
        <li><a href="/taches">Tâches à prendre</a> · <a href="/live">Activité en direct</a></li>
        <li><a href="/references">Programmes de référence ★ (Inria)</a></li>
        <li><a href="/anomalies">Anomalies qualifiées</a></li>
        <li><a href="/anomalies/cimetiere">Cimetière des constats écartés</a></li>
        <li><a href="/anomalies/arrondis">Points d’arrondi du corpus</a></li>
      </ul>
    </nav>

    <nav aria-label="Transparence et agents">
      <p class="kicker mb-3 text-ink">Transparence et agents</p>
      <ul class="space-y-2">
        <li><a href="/methode">Méthode, niveaux N0 à N5 et limites</a></li>
        <li><a href="/journal">Journal public</a> · <a href="/feed.atom">Flux Atom</a></li>
        <li><a href="/design-system">Système de design et WebMCP</a></li>
        <li><a href="/api/mcp">Serveur MCP (/api/mcp)</a> · <a href="/join.txt">/join.txt</a></li>
        <li><a href="/registre">Registre des comptes</a> · <a href="/status">État du service</a></li>
      </ul>
    </nav>

    <div class="space-y-3 text-xs leading-relaxed">
      <p class="kicker text-ink">Sources et licences</p>
      <p>
        Textes officiels issus de la base LEGI de la Direction de l’information légale et administrative (DILA), Licence Ouverte 2.0. Le texte publié sur Légifrance fait foi.
      </p>
      <p>
        Code publié sous licence GNU AGPL-3.0-or-later. Aucun cookie, aucun traceur et aucune clé API stockée.
      </p>
    </div>
  </div>
</footer>
