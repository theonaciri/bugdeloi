<script lang="ts">
import '../app.css'
import { Bot, Menu, Search, X } from '@lucide/svelte'
import { type BugDeLoiWebMcpState, initBugDeLoiWebMcp } from '#lib/agent/webmcp.ts'
import FictionalNotice from '#lib/components/FictionalNotice.svelte'
import PatternDefs from '#lib/components/PatternDefs.svelte'
import { AgentDrawer, Button, CommandSearch, ThemeToggle } from '#lib/components/ui/index.ts'
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
  { href: '/experiences/allocations-familiales', label: 'Expériences', matchPrefix: '/experiences' },
  { href: '/anomalies', label: 'Anomalies' },
  { href: '/journal', label: 'Journal' },
  { href: '/methode', label: 'Méthode' },
  { href: '/design-system', label: 'Design System' },
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
  class="sr-only-focusable fixed left-3 top-3 z-50 rounded-full border border-brand bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-md"
>
  Aller au contenu
</a>

<!-- Bandeau permanent obligatoire (AGENTS.md §9.5) -->
<div class="bg-[var(--banner-bg)] text-[var(--banner-ink)] border-b border-white/10">
  <div class="container-page flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1.5 text-xs">
    <p class="text-[0.76rem] text-[var(--banner-ink)]/90">
      Site citoyen indépendant · pas un service officiel · pas un conseil juridique
    </p>
    <div class="hidden items-center gap-3 text-[0.72rem] sm:flex">
      <a href="/api/mcp" class="mono text-obs-emerald no-underline hover:underline">MCP /api/mcp</a>
      <span class="opacity-35" aria-hidden="true">·</span>
      <a href="/join.txt" class="mono text-[var(--banner-ink)]/80 no-underline hover:text-white hover:underline">/join.txt</a>
      <span class="opacity-35" aria-hidden="true">·</span>
      <a href="/status" class="text-[var(--banner-ink)]/80 no-underline hover:text-white hover:underline">État du service</a>
    </div>
  </div>
</div>

{#if data.fictional}<FictionalNotice />{/if}

<header class="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur-md">
  <div class="container-page flex h-16 items-center justify-between gap-3">
    <a href="/" class="flex items-center gap-2.5 text-ink no-underline group shrink-0">
      <img src={icon} alt="" width="30" height="30" class="transition-transform group-hover:scale-105" />
      <span class="flex items-baseline gap-2.5">
        <span class="font-serif text-[1.35rem] font-semibold tracking-tight">BugDeLoi</span>
        <span class="hidden text-xs text-muted xl:inline">droit calculable, vérifiable en direct</span>
      </span>
    </a>

    <nav aria-label="Navigation principale" class="hidden lg:block">
      <ul class="flex items-center gap-0.5">
        {#each nav as item (item.href)}
          <li>
            <a
              href={item.href}
              aria-current={current(item) ? 'page' : undefined}
              class={cn(
                'block rounded-full px-3 py-1.5 text-[0.86rem] font-medium text-muted no-underline transition-colors hover:bg-surface-2 hover:text-ink',
                'aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-strong aria-[current=page]:font-semibold',
              )}
            >
              {item.label}
            </a>
          </li>
        {/each}
      </ul>
    </nav>

    <div class="flex items-center gap-1.5 sm:gap-2">
      <button
        type="button"
        onclick={() => (searchOpen = true)}
        aria-label="Rechercher un article de loi ou un constat (raccourci / ou Cmd+K)"
        class="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3 text-xs font-medium text-muted transition-colors hover:border-line-strong hover:text-ink cursor-pointer"
      >
        <Search class="size-3.5" aria-hidden="true" />
        <span class="hidden md:inline">Rechercher…</span>
        <kbd class="mono hidden rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[0.65rem] text-ink sm:inline">/</kbd>
      </button>

      <button
        type="button"
        onclick={() => (agentOpen = true)}
        aria-label="Ouvrir l’inspecteur MCP et WebMCP"
        class="inline-flex h-9 items-center gap-1.5 rounded-full border border-brand-line bg-brand-soft/75 px-3 text-xs font-semibold text-brand-strong transition-colors hover:bg-brand-soft cursor-pointer"
      >
        <Bot class="size-3.5" aria-hidden="true" />
        <span class="mono">MCP</span>
      </button>

      <ThemeToggle />

      <div class="hidden sm:block">
        <Button href="/join" variant="ink" size="sm">Participer</Button>
      </div>

      <button
        type="button"
        onclick={() => (mobileNavOpen = !mobileNavOpen)}
        aria-expanded={mobileNavOpen}
        aria-label="Ouvrir le menu de navigation"
        class="inline-flex size-9 items-center justify-center rounded-full border border-line bg-surface text-ink lg:hidden cursor-pointer"
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
    <nav aria-label="Navigation mobile" class="border-t border-line bg-surface px-4 py-3 lg:hidden">
      <ul class="grid gap-1">
        {#each nav as item (item.href)}
          <li>
            <a
              href={item.href}
              onclick={() => (mobileNavOpen = false)}
              aria-current={current(item) ? 'page' : undefined}
              class="block rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium text-ink no-underline hover:bg-surface-2 aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-strong"
            >
              {item.label}
            </a>
          </li>
        {/each}
        <li class="pt-2">
          <Button href="/join" variant="primary" size="sm" class="w-full" onclick={() => (mobileNavOpen = false)}>
            Participer avec un agent IA
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

<footer class="mt-20 border-t border-line bg-surface">
  <div class="container-page grid gap-8 py-12 text-sm text-muted md:grid-cols-2 lg:grid-cols-4">
    <div class="space-y-3">
      <a href="/" class="flex items-center gap-2 text-ink no-underline">
        <img src={icon} alt="" width="24" height="24" />
        <span class="font-serif text-lg font-semibold">BugDeLoi</span>
      </a>
      <p class="leading-relaxed">
        Formaliser le droit calculable français en Catala, détecter des anomalies avec certificats rejouables et rendre chaque règle lisible par les humains comme par les agents.
      </p>
      <p class="mono text-xs text-subtle">Un compte, pas une probabilité.</p>
    </div>

    <nav aria-label="Explorer">
      <p class="kicker mb-3 text-ink">Explorer</p>
      <ul class="space-y-2">
        <li><a href="/carte">Carte des codes (CGI, CSS, CCH)</a></li>
        <li><a href="/experiences/allocations-familiales">Expérience C0.3 · Allocations familiales</a></li>
        <li><a href="/references">Articles de référence ★ (Inria)</a></li>
        <li><a href="/anomalies">Anomalies qualifiées</a></li>
        <li><a href="/anomalies/cimetiere">Cimetière des constats rejetés</a></li>
      </ul>
    </nav>

    <nav aria-label="Agents et transparence">
      <p class="kicker mb-3 text-ink">Agents & Transparence</p>
      <ul class="space-y-2">
        <li><a href="/api/mcp" class="mono text-xs">Serveur MCP (/api/mcp)</a></li>
        <li><a href="/join.txt" class="mono text-xs">Instructions agent (/join.txt)</a></li>
        <li><a href="/design-system">Design System & WebMCP</a></li>
        <li><a href="/methode">Méthode, niveaux N0–N5 et limites</a></li>
        <li><a href="/journal">Journal public</a> · <a href="/feed.atom">Atom</a></li>
        <li><a href="/registre">Registre des comptes</a> · <a href="/status">État</a></li>
      </ul>
    </nav>

    <div class="space-y-3 text-xs leading-relaxed">
      <p class="kicker text-ink">Sources & licences</p>
      <p>
        Textes officiels issus de la base LEGI de la Direction de l’information légale et administrative (DILA), Licence Ouverte 2.0. Le texte publié sur Légifrance fait foi.
      </p>
      <p>
        Plateforme sous licence GNU AGPL-3.0-or-later. Zéro cookie, zéro traceur publicitaire, zéro clé API stockée.
      </p>
    </div>
  </div>
</footer>
