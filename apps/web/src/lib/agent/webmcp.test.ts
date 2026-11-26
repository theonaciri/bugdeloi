import { expect, test } from 'bun:test'
import { cn } from '../utils/cn'
import { type BugDeLoiWebMcpState, DATA_TOOLS, executeDataTool, getAgent, initBugDeLoiWebMcp } from './webmcp'

test('cn combines conditional classes and resolves Tailwind conflicts', () => {
  expect(cn('px-2 text-sm', { hidden: false, block: true }, ['px-4'])).toBe('text-sm block px-4')
})

test('data tool descriptors describe read-only object inputs', () => {
  expect(DATA_TOOLS.map((tool) => tool.name)).toEqual([
    'bugdeloi_get_snapshot',
    'bugdeloi_search_articles',
    'bugdeloi_list_findings',
    'bugdeloi_mcp_call',
  ])
  for (const tool of DATA_TOOLS) {
    expect(tool.annotations.readOnlyHint).toBe(true)
    expect(tool.inputSchema.type).toBe('object')
    expect(tool.inputSchema.additionalProperties).toBe(false)
  }
  expect(DATA_TOOLS[1].inputSchema.required).toEqual(['q'])
  expect(DATA_TOOLS[2].inputSchema.properties).toHaveProperty('status')
  expect(DATA_TOOLS[3].inputSchema.required).toEqual(['name'])
})

test('data tools send their corresponding HTTP requests', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetcher: typeof fetch = Object.assign(
    async (...[input, init]: Parameters<typeof fetch>) => {
      calls.push({ url: String(input), init })
      return Response.json({ example: true })
    },
    { preconnect: () => {} },
  )

  expect(await executeDataTool(DATA_TOOLS[0].name, undefined, fetcher)).toEqual({ example: true })
  await executeDataTool(DATA_TOOLS[1].name, { q: 'a & b', code: 'CGI', limit: 5 }, fetcher)
  await executeDataTool(DATA_TOOLS[2].name, { status: 'published', type: 'SYNTAXE', limit: 2 }, fetcher)
  await executeDataTool(DATA_TOOLS[3].name, { name: 'get_finding', arguments: { id: 'test' } }, fetcher)

  expect(calls.map(({ url }) => url)).toEqual([
    '/api/snapshot.json',
    '/api/search?q=a+%26+b&code=CGI&limit=5',
    '/api/findings?status=published&type=SYNTAXE&limit=2',
    '/api/mcp',
  ])
  expect(calls[3]?.init).toMatchObject({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: 'get_finding', arguments: { id: 'test' } },
  })
  await expect(executeDataTool('unknown', {}, fetcher)).rejects.toThrow('Outil inconnu')
  expect(calls).toHaveLength(4)
})

test('initialization is a no-op during SSR', () => {
  expect(typeof window).toBe('undefined')
  const states: BugDeLoiWebMcpState[] = []
  expect(() => initBugDeLoiWebMcp((state) => states.push(state))()).not.toThrow()
  expect(states).toEqual([])
})

test('initialization registers SDK and data tools and cleans up both contexts', () => {
  const registered = new Set<string>()
  const documentContext = {
    async registerTool(tool: { name: string }, { signal }: { signal: AbortSignal }) {
      registered.add(tool.name)
      signal.addEventListener('abort', () => registered.delete(tool.name), { once: true })
    },
  }
  const navigatorContext = {
    registerTool(tool: { name: string }) {
      registered.add(tool.name)
      return () => registered.delete(tool.name)
    },
  }
  const globals = {
    window: {},
    document: { modelContext: documentContext },
    navigator: { modelContext: navigatorContext },
  }
  const descriptors = Object.getOwnPropertyDescriptors(globalThis)
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  let cleanup: (() => void) | undefined
  try {
    const states: BugDeLoiWebMcpState[] = []
    cleanup = initBugDeLoiWebMcp((state) => states.push(state))
    expect(states[0]).toMatchObject({
      ready: true,
      webMcpDetected: true,
      webMcpTarget: 'navigator.modelContext',
      registeredTools: ['act', 'query', 'snapshot', ...DATA_TOOLS.map((tool) => tool.name)],
    })
    expect(registered.size).toBe(7)
    expect(window.__bugdeloiAgent?.agent).toBe(getAgent())
    cleanup()
    expect(registered.size).toBe(0)
    expect(window.__bugdeloiAgent).toBeUndefined()
    expect(states.at(-1)).toMatchObject({ ready: false, registeredTools: [] })
  } finally {
    cleanup?.()
    for (const key of Object.keys(globals)) {
      const descriptor = descriptors[key]
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
