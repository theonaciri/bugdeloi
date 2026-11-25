<script lang="ts">
import '../app.css'
import FictionalNotice from '#lib/components/FictionalNotice.svelte'
import PatternDefs from '#lib/components/PatternDefs.svelte'
import { page } from '$app/state'
import icon from '../../../../assets/icon.svg'
import type { LayoutProps } from './$types'

let { children, data }: LayoutProps = $props()

const nav = [
  { href: '/', label: 'Accueil' },
  { href: '/carte', label: 'Carte' },
  { href: '/anomalies', label: 'Anomalies' },
  { href: '/methode', label: 'Méthode' },
  { href: '/join', label: 'Participer' },
  { href: '/sponsors', label: 'Soutenir' },
]
const current = (href: string) =>
  href === '/'
    ? page.url.pathname === '/'
    : page.url.pathname === href || page.url.pathname.startsWith(`${href}/`)
</script>

<svelte:head>
  <link rel="icon" href={icon} type="image/svg+xml" />
</svelte:head>

<a href="#contenu" class="sr-only-focusable absolute left-2 top-2 z-50 rounded bg-surface px-3 py-2 font-semibold">Aller au contenu</a>

<div class="bg-[var(--banner-bg)] text-[var(--banner-ink)]">
  <p class="container-page py-1.5 text-center text-sm">
    Site citoyen indépendant · pas un service officiel · pas un conseil juridique
  </p>
</div>
{#if data.fictional}<FictionalNotice />{/if}

<header class="border-b border-line bg-surface">
  <div class="container-page flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
    <a href="/" class="flex items-center gap-2 text-ink no-underline">
      <img src={icon} alt="" width="32" height="32" />
      <span class="font-serif text-xl font-semibold tracking-tight">BugDeLoi</span>
    </a>
    <nav aria-label="Navigation principale">
      <ul class="flex flex-wrap gap-x-1 gap-y-1">
        {#each nav as item (item.href)}
          <li>
            <a
              href={item.href}
              aria-current={current(item.href) ? 'page' : undefined}
              class="block rounded-md px-2.5 py-1.5 font-medium text-ink no-underline hover:bg-surface-2 aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-strong aria-[current=page]:underline"
            >
              {item.label}
            </a>
          </li>
        {/each}
      </ul>
    </nav>
  </div>
</header>

<PatternDefs />

<main id="contenu" tabindex="-1" class="outline-none">
  {@render children()}
</main>

<footer class="mt-16 border-t border-line bg-surface">
  <div class="container-page grid gap-6 py-8 text-sm text-muted sm:grid-cols-3">
    <div>
      <p class="font-semibold text-ink">BugDeLoi</p>
      <p>
        Formaliser le droit calculable français et publier des résultats que chacun peut rejouer. Projet citoyen
        indépendant, en construction.
      </p>
    </div>
    <nav aria-label="Pages du projet">
      <ul class="space-y-1">
        <li><a href="/methode">Méthode et limites</a></li>
        <li><a href="/methode#compteurs">Comment sont calculés les compteurs</a></li>
        <li><a href="/registre">Registre des comptes</a></li>
        <li><a href="/status">État du service</a></li>
        <li><a href="/feed.atom">Flux Atom du journal</a></li>
        <li><a href="/join.txt">join.txt (pour les agents)</a></li>
      </ul>
    </nav>
    <div class="space-y-2">
      <p>
        Textes officiels : base LEGI de la DILA, sous Licence Ouverte. Le texte qui fait foi reste celui publié sur
        Légifrance.
      </p>
      <p>Code de la plateforme sous licence AGPL-3.0-or-later. Aucun cookie, aucun traceur.</p>
    </div>
  </div>
</footer>
