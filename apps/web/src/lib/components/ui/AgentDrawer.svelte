<script lang="ts">
import { Bot, Play, RefreshCw, Terminal } from '@lucide/svelte'
import { agentTools } from '@ui-sdk/svelte/agent'
import { type BugDeLoiWebMcpState, DATA_TOOLS, executeDataTool, getAgent } from '#lib/agent/webmcp.ts'
import Badge from './Badge.svelte'
import Button from './Button.svelte'
import CopyButton from './CopyButton.svelte'
import Drawer from './Drawer.svelte'
import Tabs from './Tabs.svelte'

let {
  open = $bindable(false),
  webMcpState,
}: {
  open?: boolean
  webMcpState: BugDeLoiWebMcpState
} = $props()

let uiSnapshot = $state<unknown[]>([])
let activeTool = $state('get_project_snapshot')
let toolResult = $state<string | null>(null)
let toolError = $state<string | null>(null)
let running = $state(false)

const serverTools = [
  {
    name: 'get_project_snapshot',
    label: 'Snapshot projet',
    args: {},
    desc: 'Compteurs temps réel, codes, C0.1, C0.2, desk.',
  },
  {
    name: 'list_findings',
    label: 'Constats reproduits (5)',
    args: { status: 'reproduced', limit: 5 },
    desc: 'Constats pré-qualification reproduits par machine.',
  },
  {
    name: 'get_c03_experiment',
    label: 'Expérience C0.3',
    args: {},
    desc: '17 cas allocations familiales + contre-vérifications.',
  },
  {
    name: 'search_articles',
    label: 'Chercher « D755-5 »',
    args: { query: 'D755-5', limit: 5 },
    desc: 'Recherche plein texte & numéro dans les 3 codes.',
  },
]

const mcpConfigSnippet = `{
  "mcpServers": {
    "bugdeloi": {
      "type": "http",
      "url": "https://bugdeloi.theonaciri.fr/api/mcp"
    }
  }
}`

function refreshSnapshot() {
  if (typeof window === 'undefined') return
  try {
    uiSnapshot = getAgent().snapshot()
  } catch {
    uiSnapshot = []
  }
}

$effect(() => {
  if (open) refreshSnapshot()
})

async function runServerTool(name: string, args: Record<string, unknown>) {
  activeTool = name
  running = true
  toolError = null
  try {
    const res = await executeDataTool('bugdeloi_mcp_call', { name, arguments: args })
    toolResult = JSON.stringify(res, null, 2)
  } catch (e) {
    toolError = e instanceof Error ? e.message : 'Erreur lors de l’appel MCP.'
    toolResult = null
  } finally {
    running = false
  }
}
</script>

<Drawer
  bind:open
  side="right"
  title="Interface Agents · MCP & WebMCP"
  description="Le site expose ses composants via @ui-sdk/svelte (WebMCP) et ses données en lecture seule via /api/mcp."
>
  <div class="space-y-5">
    <div class="rounded-[var(--radius)] border border-line bg-surface-2/70 p-3.5 text-xs">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="inline-flex items-center gap-2 font-semibold text-ink">
          <Bot class="size-4 text-brand" aria-hidden="true" />
          Pont WebMCP navigateur
        </span>
        <Badge variant={webMcpState.webMcpDetected ? 'brand' : 'default'} size="sm" pulse={webMcpState.ready}>
          {webMcpState.webMcpDetected ? webMcpState.webMcpTarget : 'Mode pont JS (window.__bugdeloiAgent)'}
        </Badge>
      </div>
      <p class="mt-2 text-muted leading-relaxed">
        Chaque onglet, filtre, tiroir et bouton du design system est pilotable sans clic pixel par
        <code class="text-ink">snapshot()</code>, <code class="text-ink">query()</code> et <code class="text-ink">act()</code>.
      </p>
      <div class="mt-2.5 flex flex-wrap gap-1.5">
        <Badge variant="outline" size="sm">{agentTools.length} outils UI</Badge>
        <Badge variant="outline" size="sm">{DATA_TOOLS.length} outils WebMCP données</Badge>
        <Badge variant="brand" size="sm">Serveur /api/mcp actif</Badge>
      </div>
    </div>

    <Tabs
      defaultValue="mcp"
      ariaLabel="Modes d’inspection agent"
      variant="pill"
      items={[
        { value: 'mcp', label: 'Serveur MCP', badge: '6 outils' },
        { value: 'webmcp', label: 'UI Live (WebMCP)', badge: uiSnapshot.length },
        { value: 'connect', label: 'Connecter' },
      ]}
    >
      {#snippet panel(tab)}
        {#if tab === 'mcp'}
          <div class="space-y-3">
            <p class="text-xs text-muted">
              Exécutez un appel JSON-RPC 2.0 réel sur <code class="text-ink">POST /api/mcp</code> (lecture seule, inclut les constats pré-qualification marqués comme non qualifiés).
            </p>
            <div class="grid gap-2 sm:grid-cols-2">
              {#each serverTools as t (t.name)}
                <button
                  type="button"
                  onclick={() => runServerTool(t.name, t.args)}
                  class="flex flex-col items-start gap-1 rounded-[var(--radius)] border border-line bg-surface p-3 text-left transition-colors hover:border-brand hover:bg-brand-soft/30 cursor-pointer"
                >
                  <span class="flex w-full items-center justify-between gap-2 text-xs font-semibold text-ink">
                    <span>{t.label}</span>
                    <Play class="size-3.5 text-brand" aria-hidden="true" />
                  </span>
                  <span class="text-[0.72rem] text-muted">{t.desc}</span>
                </button>
              {/each}
            </div>

            {#if running}
              <p class="mono rounded-[var(--radius)] border border-line bg-obs-bg p-3 text-xs text-obs-emerald">
                Appel POST /api/mcp → {activeTool}…
              </p>
            {:else if toolError}
              <p class="rounded-[var(--radius)] border border-ko/40 bg-ko-soft p-3 text-xs text-ko">
                {toolError}
              </p>
            {:else if toolResult}
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <span class="mono text-xs font-semibold text-ink">Réponse · {activeTool}</span>
                  <CopyButton text={toolResult} label="Copier JSON" size="xs" />
                </div>
                <pre class="max-h-72 overflow-auto rounded-[var(--radius)] border border-obs-line bg-obs-bg p-3 text-[0.72rem] leading-relaxed text-obs-ink"><code>{toolResult}</code></pre>
              </div>
            {/if}
          </div>
        {:else if tab === 'webmcp'}
          <div class="space-y-3">
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs text-muted">
                Composants <code class="text-ink">@ui-sdk/svelte</code> détectés dans cette page :
              </p>
              <Button variant="secondary" size="xs" onclick={refreshSnapshot}>
                <RefreshCw class="size-3.5" aria-hidden="true" />
                Actualiser
              </Button>
            </div>
            <pre class="max-h-80 overflow-auto rounded-[var(--radius)] border border-obs-line bg-obs-bg p-3 text-[0.72rem] leading-relaxed text-obs-ink"><code>{JSON.stringify(uiSnapshot, null, 2)}</code></pre>
          </div>
        {:else}
          <div class="space-y-4 text-xs">
            <div>
              <div class="flex items-center justify-between gap-2">
                <span class="inline-flex items-center gap-1.5 font-semibold text-ink">
                  <Terminal class="size-3.5 text-brand" aria-hidden="true" />
                  Configuration MCP (Claude Code, Codex, Cursor)
                </span>
                <CopyButton text={mcpConfigSnippet} label="Copier" size="xs" />
              </div>
              <pre class="mt-2 overflow-x-auto rounded-[var(--radius)] border border-obs-line bg-obs-bg p-3 text-[0.72rem] text-obs-ink"><code>{mcpConfigSnippet}</code></pre>
            </div>
            <div class="rounded-[var(--radius)] border border-line bg-surface-2/70 p-3 space-y-1.5">
              <p class="font-semibold text-ink">Manifeste de découverte</p>
              <p class="text-muted">
                <a href="/api/mcp" class="mono">GET /api/mcp</a> renvoie la liste complète des outils, schémas JSON et ressources.
                Pour réserver une tâche de travail, donnez <a href="/join.txt" class="mono">/join.txt</a> à votre agent.
              </p>
            </div>
          </div>
        {/if}
      {/snippet}
    </Tabs>
  </div>
</Drawer>
