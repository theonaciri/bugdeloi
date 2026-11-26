import { agentTools, createAgent, registerTools } from '@ui-sdk/svelte/agent'

export interface BugDeLoiWebMcpState {
  ready: boolean
  webMcpDetected: boolean
  webMcpTarget: 'document.modelContext' | 'navigator.modelContext' | 'none'
  registeredTools: string[]
  uiComponentsCount: number
  lastAction: { tool: string; at: string; ok: boolean } | null
}

const MCP_ENDPOINT = '/api/mcp'
const allow = (step: { confirm?: string }) => !step.confirm
type Agent = ReturnType<typeof createAgent>
let agent: Agent | undefined

export function getAgent(): Agent {
  if (typeof window === 'undefined') throw new Error('Agent disponible uniquement dans le navigateur')
  agent ??= createAgent({ allow })
  return agent
}

const readOnly = { readOnlyHint: true } as const
const limit = { type: 'integer', minimum: 1 } as const
export const DATA_TOOLS = [
  {
    name: 'bugdeloi_get_snapshot',
    description: 'Lire le dernier état public de BugDeLoi.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: readOnly,
  },
  {
    name: 'bugdeloi_search_articles',
    description: 'Rechercher des articles par texte et, facultativement, par code.',
    inputSchema: {
      type: 'object',
      properties: { q: { type: 'string' }, code: { type: 'string' }, limit },
      required: ['q'],
      additionalProperties: false,
    },
    annotations: readOnly,
  },
  {
    name: 'bugdeloi_list_findings',
    description: 'Lister les constats publics et les filtrer par statut ou type.',
    inputSchema: {
      type: 'object',
      properties: { status: { type: 'string' }, type: { type: 'string' }, limit },
      additionalProperties: false,
    },
    annotations: readOnly,
  },
  {
    name: 'bugdeloi_mcp_call',
    description: 'Appeler un outil de consultation du serveur MCP de BugDeLoi.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string' }, arguments: { type: 'object' } },
      required: ['name'],
      additionalProperties: false,
    },
    annotations: readOnly,
  },
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function queryUrl(path: string, args: Record<string, unknown>, keys: string[]): string {
  const params = new URLSearchParams()
  for (const key of keys) {
    const value = args[key]
    if (value === undefined) continue
    if (key === 'limit' ? !Number.isInteger(value) || Number(value) < 1 : typeof value !== 'string') {
      throw new Error(`Paramètre invalide : ${key}`)
    }
    params.set(key, String(value))
  }
  return params.size ? `${path}?${params}` : path
}

export async function executeDataTool(
  name: string,
  args: Record<string, unknown> = {},
  fetcher: typeof fetch = globalThis.fetch,
): Promise<unknown> {
  let response: Response
  switch (name) {
    case 'bugdeloi_get_snapshot':
      response = await fetcher('/api/snapshot.json')
      break
    case 'bugdeloi_search_articles':
      if (typeof args.q !== 'string') throw new Error('Paramètre requis : q')
      response = await fetcher(queryUrl('/api/search', args, ['q', 'code', 'limit']))
      break
    case 'bugdeloi_list_findings':
      response = await fetcher(queryUrl('/api/findings', args, ['status', 'type', 'limit']))
      break
    case 'bugdeloi_mcp_call':
      if (typeof args.name !== 'string' || !args.name.trim()) throw new Error('Paramètre requis : name')
      if (args.arguments !== undefined && !isRecord(args.arguments)) {
        throw new Error('Paramètre invalide : arguments')
      }
      response = await fetcher(MCP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: args.name, arguments: args.arguments ?? {} },
        }),
      })
      break
    default:
      throw new Error(`Outil inconnu : ${name}`)
  }
  if (!response.ok) throw new Error(`Erreur HTTP ${response.status} (${name})`)
  const result: unknown = await response.json()
  if (name === 'bugdeloi_mcp_call' && isRecord(result)) {
    if (result.error || (isRecord(result.result) && result.result.isError === true)) {
      throw new Error(`Échec de l’appel MCP : ${String(args.name)}`)
    }
  }
  return result
}

type Context = {
  registerTool: (
    tool: (typeof DATA_TOOLS)[number] & { execute: (args?: unknown) => Promise<unknown> },
    options: { signal: AbortSignal },
  ) => unknown
  unregisterTool?: (name: string) => unknown
}

function modelContext(host: unknown): Context | undefined {
  if (!isRecord(host) || !isRecord(host.modelContext)) return
  if (typeof host.modelContext.registerTool === 'function') return host.modelContext as Context
}

type Bridge = {
  agent: Agent
  tools: [...typeof agentTools, ...typeof DATA_TOOLS]
  snapshot: Agent['snapshot']
  query: Agent['query']
  act: Agent['act']
  callDataTool: (name: string, args?: Record<string, unknown>) => Promise<unknown>
  mcpEndpoint: typeof MCP_ENDPOINT
}

declare global {
  interface Window {
    __bugdeloiAgent?: Bridge
  }
}

export function initBugDeLoiWebMcp(onStateChange?: (state: BugDeLoiWebMcpState) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const browser = window
  const pageAgent = getAgent()
  const documentContext = modelContext(globalThis.document)
  const navigatorContext = modelContext(globalThis.navigator)
  const context = navigatorContext ?? documentContext
  const registered = new Set<string>()
  const controller = new AbortController()
  let lastAction: BugDeLoiWebMcpState['lastAction'] = null
  let stopUiTools: (() => void) | undefined

  const publish = () =>
    onStateChange?.({
      ready: !controller.signal.aborted,
      webMcpDetected: Boolean(context),
      webMcpTarget: navigatorContext
        ? 'navigator.modelContext'
        : documentContext
          ? 'document.modelContext'
          : 'none',
      registeredTools: [...registered],
      uiComponentsCount: pageAgent.snapshot().length,
      lastAction,
    })

  function recordAction(tool: string, ok: boolean) {
    if (controller.signal.aborted) return
    lastAction = { tool, at: new Date().toISOString(), ok }
    publish()
  }

  async function callDataTool(name: string, args?: Record<string, unknown>) {
    let ok = false
    try {
      const result = await executeDataTool(name, args)
      ok = true
      return result
    } finally {
      recordAction(name, ok)
    }
  }

  try {
    stopUiTools = registerTools(pageAgent, { allow })
    if (documentContext) for (const tool of agentTools) registered.add(tool.name)
  } catch {
    // A browser may expose a partial implementation of the SDK's registration API.
  }

  async function removeTool(name: string, cleanup: unknown) {
    try {
      if (typeof cleanup === 'function') await cleanup()
      else if (typeof context?.unregisterTool === 'function') await context.unregisterTool(name)
    } catch {
      // Registration may already have been removed by the abort signal.
    }
  }

  const cleanupTools = new Map<string, unknown>()
  if (context) {
    for (const tool of DATA_TOOLS) {
      try {
        const registration = context.registerTool(
          {
            ...tool,
            execute: (args) => {
              if (args !== undefined && !isRecord(args)) return Promise.reject(new Error('Entrée invalide'))
              return callDataTool(tool.name, args)
            },
          },
          { signal: controller.signal },
        )
        if (isRecord(registration) && typeof registration.then === 'function') {
          void Promise.resolve(registration).then(
            (cleanup) => {
              if (controller.signal.aborted) return removeTool(tool.name, cleanup)
              registered.add(tool.name)
              cleanupTools.set(tool.name, cleanup)
              publish()
            },
            () => {},
          )
        } else {
          registered.add(tool.name)
          cleanupTools.set(tool.name, registration)
        }
      } catch {
        // Continue registering the other tools if this one is unavailable.
      }
    }
  }

  const bridge: Bridge = {
    agent: pageAgent,
    tools: [...agentTools, ...DATA_TOOLS],
    snapshot: () => pageAgent.snapshot(),
    query: (q) => pageAgent.query(q),
    act: async (action, options) => {
      let ok = false
      try {
        const result = await pageAgent.act(action, options)
        ok = result.ok
        return result
      } finally {
        recordAction('act', ok)
      }
    },
    callDataTool,
    mcpEndpoint: MCP_ENDPOINT,
  }
  browser.__bugdeloiAgent = bridge
  publish()

  return () => {
    if (controller.signal.aborted) return
    controller.abort()
    stopUiTools?.()
    for (const [name, cleanup] of cleanupTools) void removeTool(name, cleanup)
    cleanupTools.clear()
    registered.clear()
    if (browser.__bugdeloiAgent === bridge) delete browser.__bugdeloiAgent
    publish()
  }
}
