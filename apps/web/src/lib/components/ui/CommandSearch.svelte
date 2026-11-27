<script lang="ts">
import { ArrowRight, BookOpen, Cpu, FileText, Map as MapIcon, Search, ShieldAlert, X } from '@lucide/svelte'
import {
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogTitle,
  Dialog as UiDialog,
} from '@ui-sdk/svelte/dialog'
import { cn } from '#lib/utils/cn.ts'

interface SearchArticle {
  id: string
  num: string | null
  code: string
  codeTitle: string
  level: string
  snippet?: string | null
}

interface SearchFinding {
  id: string
  type: string
  typeLabel?: string
  status: string
  claim: string
}

interface SearchResponse {
  query: string
  articles: SearchArticle[]
  findings: SearchFinding[]
}

let {
  open = $bindable(false),
}: {
  open?: boolean
} = $props()

let query = $state('')
let loading = $state(false)
let results = $state<SearchResponse | null>(null)
let errorMsg = $state<string | null>(null)
let inputEl = $state<HTMLInputElement | null>(null)

const quickLinks = [
  {
    href: '/carte',
    label: 'Carte interactive des codes',
    desc: 'CGI, CSS et CCH : articles en vigueur par chapitre',
    icon: MapIcon,
  },
  {
    href: '/experiences/allocations-familiales',
    label: 'Expérience C0.3 · Allocations familiales',
    desc: 'Traduction à l’aveugle : 12 cas sur 17 concordants, écarts Guyane et Mayotte',
    icon: BookOpen,
  },
  {
    href: '/anomalies',
    label: 'Anomalies et cimetière',
    desc: 'Registre qualifié et constats reproduits',
    icon: ShieldAlert,
  },
  {
    href: '/design-system',
    label: 'Système de design et WebMCP',
    desc: 'Composants @ui-sdk/svelte, jetons graphiques et inspecteur MCP',
    icon: Cpu,
  },
  {
    href: '/methode',
    label: 'Méthode et niveaux N0 à N5',
    desc: 'Définitions mécaniques, limites et calcul des compteurs',
    icon: FileText,
  },
]

// Raccourcis clavier globaux : ⌘K / Ctrl+K et '/' hors champ de saisie.
$effect(() => {
  if (typeof window === 'undefined') return
  const onKey = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      open = !open
      return
    }
    if (
      e.key === '/' &&
      !open &&
      !(e.target instanceof HTMLInputElement) &&
      !(e.target instanceof HTMLTextAreaElement) &&
      !(e.target instanceof HTMLElement && e.target.isContentEditable)
    ) {
      e.preventDefault()
      open = true
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
})

$effect(() => {
  if (open && inputEl) {
    queueMicrotask(() => inputEl?.focus())
  }
})

$effect(() => {
  const q = query.trim()
  if (q.length < 2) {
    results = null
    errorMsg = null
    loading = false
    return
  }
  const controller = new AbortController()
  loading = true
  errorMsg = null
  const timer = setTimeout(async () => {
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      results = (await res.json()) as SearchResponse
    } catch (e) {
      if ((e as { name?: string })?.name !== 'AbortError') {
        errorMsg = 'Recherche momentanément indisponible.'
      }
    } finally {
      loading = false
    }
  }, 180)
  return () => {
    clearTimeout(timer)
    controller.abort()
  }
})

function close() {
  open = false
}
</script>

<UiDialog bind:open>
  <DialogBackdrop class="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" />
  <DialogContent
    class="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-1.5rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-[var(--radius-xl)] border border-line bg-surface text-ink shadow-[var(--shadow-lg)]"
  >
    <DialogTitle class="sr-only">Rechercher dans BugDeLoi</DialogTitle>
    <div class="flex items-center gap-3 border-b border-line px-4 py-3.5">
      <Search class="size-4.5 shrink-0 text-muted" aria-hidden="true" />
      <input
        bind:this={inputEl}
        bind:value={query}
        type="search"
        placeholder="Rechercher un article (ex. 197, D755-5, LEGIARTI…), un constat (F-2026-…), un thème…"
        aria-label="Rechercher un article de loi ou un constat"
        class="w-full bg-transparent text-sm text-ink placeholder:text-subtle outline-none"
      />
      <DialogClose
        aria-label="Fermer la recherche"
        class="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-muted hover:bg-surface-2 hover:text-ink cursor-pointer"
      >
        <X class="size-3.5" aria-hidden="true" />
      </DialogClose>
    </div>

    <div class="max-h-[65dvh] overflow-y-auto p-3">
      {#if query.trim().length < 2}
        <p class="kicker px-2.5 py-1.5">Accès rapides</p>
        <ul class="space-y-1">
          {#each quickLinks as item (item.href)}
            {@const Icon = item.icon}
            <li>
              <a
                href={item.href}
                onclick={close}
                class="flex items-center justify-between gap-3 rounded-[var(--radius)] px-3 py-2.5 text-ink no-underline transition-colors hover:bg-surface-2"
              >
                <span class="flex items-center gap-3 min-w-0">
                  <span class="flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-bg text-brand">
                    <Icon class="size-4" aria-hidden="true" />
                  </span>
                  <span class="min-w-0">
                    <span class="block text-sm font-semibold truncate">{item.label}</span>
                    <span class="block text-xs text-muted truncate">{item.desc}</span>
                  </span>
                </span>
                <ArrowRight class="size-4 shrink-0 text-subtle" aria-hidden="true" />
              </a>
            </li>
          {/each}
        </ul>
      {:else if loading}
        <p class="px-3 py-6 text-center text-sm text-muted">Recherche dans les articles en vigueur…</p>
      {:else if errorMsg}
        <p class="px-3 py-6 text-center text-sm text-ko">{errorMsg}</p>
      {:else if results && results.articles.length === 0 && results.findings.length === 0}
        <p class="px-3 py-6 text-center text-sm text-muted">
          Aucun article en vigueur ni constat trouvé pour « {results.query} ».
        </p>
      {:else if results}
        {#if results.articles.length > 0}
          <p class="kicker px-2.5 py-1.5">Articles en vigueur ({results.articles.length})</p>
          <ul class="space-y-1">
            {#each results.articles as art (art.id)}
              <li>
                <a
                  href={`/article/${art.id}`}
                  onclick={close}
                  class="flex items-start justify-between gap-3 rounded-[var(--radius)] px-3 py-2 text-ink no-underline transition-colors hover:bg-surface-2"
                >
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="font-semibold text-sm">Article {art.num ?? art.id}</span>
                      <span class="mono rounded bg-surface-2 px-1.5 py-0.5 text-[0.68rem] text-muted">{art.code}</span>
                      <span class={cn('mono rounded px-1.5 py-0.5 text-[0.68rem] font-semibold', art.level === 'REF' ? 'lvl-bg-ref' : 'bg-surface-2 text-muted')}>
                        {art.level === 'REF' ? '★ Référence' : art.level}
                      </span>
                    </div>
                    {#if art.snippet}
                      <p class="mt-0.5 line-clamp-2 text-xs text-muted">{art.snippet}</p>
                    {/if}
                  </div>
                  <span class="mono shrink-0 text-[0.68rem] text-subtle">{art.id}</span>
                </a>
              </li>
            {/each}
          </ul>
        {/if}

        {#if results.findings.length > 0}
          <p class="kicker mt-3 px-2.5 py-1.5">Constats & anomalies ({results.findings.length})</p>
          <ul class="space-y-1">
            {#each results.findings as f (f.id)}
              <li>
                <a
                  href={`/anomalies/${f.id}`}
                  onclick={close}
                  class="block rounded-[var(--radius)] px-3 py-2 text-ink no-underline transition-colors hover:bg-surface-2"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="mono text-xs font-semibold text-brand-strong">{f.id}</span>
                    <span class="mono rounded bg-notice px-1.5 py-0.5 text-[0.68rem] text-notice-ink">
                      {f.status === 'reproduced' ? 'Reproduit · non qualifié' : f.status === 'candidate' ? 'Candidat' : f.status}
                    </span>
                    <span class="text-xs text-muted">{f.typeLabel ?? f.type}</span>
                  </div>
                  <p class="mt-0.5 line-clamp-2 text-xs text-muted">{f.claim}</p>
                </a>
              </li>
            {/each}
          </ul>
        {/if}
      {/if}
    </div>

    <div class="flex items-center justify-between border-t border-line bg-surface-2/60 px-4 py-2 text-[0.72rem] text-muted">
      <span>Index plein texte Postgres · articles en vigueur & constats</span>
      <span class="mono hidden sm:inline">Échap pour fermer</span>
    </div>
  </DialogContent>
</UiDialog>
