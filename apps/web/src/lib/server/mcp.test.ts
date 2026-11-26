import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { handleMcpPost, mcpManifest } from './mcp.ts'

const origin = 'https://example.test'
const rpc = (method: string, params?: object) => ({ jsonrpc: '2.0', id: 1, method, params })

function request(body: string, headers: HeadersInit = {}) {
  const values = new Headers(headers)
  values.set('content-type', 'application/json')
  if (!values.has('accept')) values.set('accept', 'application/json, text/event-stream')
  return new Request(`${origin}/api/mcp`, { method: 'POST', headers: values, body })
}

function post(
  body: unknown,
  sources?: Parameters<typeof handleMcpPost>[3],
  reports?: Record<string, string>,
) {
  return handleMcpPost(request(JSON.stringify(body)), origin, reports, sources)
}

describe('MCP Streamable HTTP', () => {
  test('initialisation, découverte et ping', async () => {
    const response = await post(
      rpc('initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'test', version: '0' },
      }),
    )
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: 'bugdeloi', version: '0.1.0' },
        instructions: expect.stringContaining('candidate et reproduced'),
      },
    })
    expect(mcpManifest(origin)).toMatchObject({ name: 'bugdeloi-mcp', endpoint: '/api/mcp' })
    expect(await (await post(rpc('ping'))).json()).toEqual({ jsonrpc: '2.0', id: 1, result: {} })
  })

  test('notifications sans réponse JSON et requêtes en lot', async () => {
    const initialized = { jsonrpc: '2.0', method: 'notifications/initialized' }
    for (const message of [initialized, [initialized, initialized]]) {
      const response = await post(message)
      expect(response.status).toBe(202)
      expect(await response.text()).toBe('')
    }
    const response = await post([initialized, { ...rpc('ping'), id: 'a' }, false, rpc('inconnue')])
    expect(await response.json()).toMatchObject([
      { id: 'a', result: {} },
      { id: null, error: { code: -32600 } },
      { id: 1, error: { code: -32601 } },
    ])
  })

  test('les six outils publiés déclarent leur schéma et leur lecture seule', async () => {
    const tools = mcpManifest(origin).tools
    expect(tools.map(({ name }) => name)).toEqual([
      'get_project_snapshot',
      'search_articles',
      'get_article',
      'list_findings',
      'get_finding',
      'get_c03_experiment',
    ])
    for (const tool of tools) {
      expect(tool.inputSchema).toMatchObject({ type: 'object', additionalProperties: false })
      expect(tool.annotations).toEqual({ readOnlyHint: true, openWorldHint: false })
    }
    expect(await (await post(rpc('tools/list'))).json()).toEqual({ jsonrpc: '2.0', id: 1, result: { tools } })
  })

  test('JSON illisible, requête invalide, méthode inconnue et paramètres invalides', async () => {
    const malformed = await handleMcpPost(request('{'), origin)
    expect(malformed.status).toBe(400)
    expect(await malformed.json()).toMatchObject({ id: null, error: { code: -32700 } })
    const cases = [
      [[], -32600],
      [{ ...rpc('ping'), jsonrpc: '1.0' }, -32600],
      [rpc('unknown'), -32601],
      [rpc('tools/call', { name: 'unknown' }), -32602],
      [rpc('tools/call', { name: 'search_articles', arguments: { query: '' } }), -32602],
      [
        rpc('tools/call', { name: 'search_articles', arguments: { query: 'x', code: 'constructor' } }),
        -32602,
      ],
      [rpc('tools/call', { name: 'list_findings', arguments: { status: 'inconnu' } }), -32602],
      [rpc('tools/call', { name: 'list_findings', arguments: { offset: -1 } }), -32602],
      [rpc('tools/call', { name: 'get_c03_experiment', arguments: { unexpected: true } }), -32602],
      [rpc('resources/read'), -32602],
      [rpc('resources/read', { uri: 'bugdeloi://unknown' }), -32002],
    ] as const
    for (const [body, code] of cases) {
      expect(await (await post(body)).json()).toMatchObject({ error: { code } })
    }
  })

  test('appel d’un outil avec source simulée et résultat structuré', async () => {
    const data = { articles: [], findings: [] }
    const response = await post(
      rpc('tools/call', { name: 'search_articles', arguments: { query: ' 197 ', code: 'CGI', limit: 4 } }),
      {
        search: async (query, options) => {
          expect(query).toBe('197')
          expect(options).toEqual({ code: 'CGI', limit: 4 })
          return data
        },
      },
    )
    expect(await response.json()).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: { structuredContent: data, content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] },
    })
  })

  test('lecture de ressources simulées et erreur interne sans détail de la source', async () => {
    expect(await (await post(rpc('resources/list'))).json()).toMatchObject({
      result: { resources: mcpManifest(origin).resources },
    })
    const uri = 'bugdeloi://snapshot'
    const snapshot = async () => ({ codes: [] })
    const result = await post(rpc('resources/read', { uri }), { snapshot })
    expect(await result.json()).toMatchObject({
      result: {
        contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(await snapshot(), null, 2) }],
      },
    })
    const instructions = await post(rpc('resources/read', { uri: 'bugdeloi://join-instructions' }), {
      join: () => 'Instructions simulées',
    })
    expect(await instructions.json()).toMatchObject({
      result: { contents: [{ mimeType: 'text/plain', text: 'Instructions simulées' }] },
    })
    const failed = await post(rpc('resources/read', { uri }), {
      snapshot: async () => {
        throw new Error('Détail interne')
      },
    })
    expect(await failed.json()).toMatchObject({ error: { code: -32603, message: 'Internal error' } })
  })

  test('C0.3 expose les montants en euros par les deux accès', async () => {
    const reports = Object.fromEntries(
      await Promise.all(
        ['anthropic', 'google'].map(async (family) => {
          const name = `2026-11-25-c0.3-${family}.md`
          return [
            name,
            await readFile(
              new URL(`../../../../../docs/audits/verifications/${name}`, import.meta.url),
              'utf8',
            ),
          ]
        }),
      ),
    )
    const tool = await post(rpc('tools/call', { name: 'get_c03_experiment' }), undefined, reports)
    const resource = await post(
      rpc('resources/read', { uri: 'bugdeloi://c03-experiment' }),
      undefined,
      reports,
    )
    const toolResult = (await tool.json()) as { result: { structuredContent: { cases: unknown[] } } }
    const resourceResult = (await resource.json()) as { result: { contents: [{ text: string }] } }
    const resourceContent: unknown = JSON.parse(resourceResult.result.contents[0].text)
    expect(toolResult.result.structuredContent.cases).toHaveLength(17)
    expect(resourceContent).toEqual(toolResult.result.structuredContent)
    expect(toolResult).toMatchObject({
      result: {
        structuredContent: {
          currency: 'EUR',
          verifications: {
            Test3: [
              { family: 'anthropic', verdict: 'Le résultat de la traduction est retenu.' },
              { family: 'google', verdict: 'Plusieurs lectures sont possibles.' },
            ],
          },
          cases: expect.arrayContaining([
            expect.objectContaining({ name: 'Test1', expected: 285.24, actual: 285.25 }),
          ]),
        },
      },
    })
  })

  test('origine étrangère et média de réponse incompatible', async () => {
    const body = JSON.stringify(rpc('ping'))
    expect((await handleMcpPost(request(body, { origin: 'https://other.test' }), origin)).status).toBe(403)
    expect((await handleMcpPost(request(body, { accept: 'text/event-stream' }), origin)).status).toBe(406)
  })
})
