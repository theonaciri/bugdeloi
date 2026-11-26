import { FINDING_ID_RE, FINDING_STATUSES, FINDING_TYPES } from '@bugdeloi/core/findings'
import { LEGIARTI_RE, legifranceArticleUrl } from '@bugdeloi/core/legi'
import summary from '../../../../../replications/c0.3/summary.json'
import { joinText } from '../join-text.ts'
import { readVerifications } from './c03-verifications.ts'
import { CACHE } from './http.ts'
import {
  article,
  CODE_KEYS,
  type CodeKey,
  FINDINGS_LIMIT_MAX,
  FINDINGS_NOTE,
  FINDINGS_OFFSET_MAX,
  findingDetail,
  isCodeKey,
  isFindingStatus,
  isFindingType,
  isSearchQuery,
  SEARCH_LIMIT_MAX,
  SEARCH_QUERY_MAX,
  searchCatalog,
  snapshot,
  type WorkingFindingsOptions,
  workingFindings,
} from './queries.ts'

const protocolVersion = '2025-03-26'
const serverInfo = { name: 'bugdeloi', version: '0.1.0' }
const endpoint = '/api/mcp'

const instructions =
  'BugDeLoi documente la formalisation du droit français. N0 brut, N1 ancré, N2 compilé, N3 testé, ' +
  'N4 éprouvé, N5 revue humaine signée. ★ indique une formalisation de référence externe de la version en vigueur ' +
  'dont la suite de tests a réussi dans notre environnement. ' +
  FINDINGS_NOTE

function tool(
  name: string,
  description: string,
  properties: Record<string, object> = {},
  required: string[] = [],
) {
  return {
    name,
    description,
    inputSchema: { type: 'object', properties, required, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }
}

const codeProperty = { type: 'string', enum: CODE_KEYS }
const tools = [
  tool(
    'get_project_snapshot',
    'Consulter les codes, les exécutions des tests C0.1, le balayage C0.2, le guichet et le journal.',
  ),
  tool(
    'search_articles',
    'Rechercher des articles en vigueur et des constats reproduits ou qualifiés.',
    {
      query: { type: 'string', minLength: 1, maxLength: SEARCH_QUERY_MAX },
      code: codeProperty,
      limit: { type: 'integer', minimum: 1, maximum: SEARCH_LIMIT_MAX },
    },
    ['query'],
  ),
  tool(
    'get_article',
    'Lire une version LEGI, son texte, son empreinte, son niveau et sa couverture.',
    {
      legiarti: { type: 'string', pattern: LEGIARTI_RE.source },
    },
    ['legiarti'],
  ),
  tool('list_findings', 'Parcourir les constats par statut. Par défaut, affiche les constats reproduits.', {
    status: { type: 'string', enum: FINDING_STATUSES },
    type: { type: 'string', enum: FINDING_TYPES },
    code: codeProperty,
    limit: { type: 'integer', minimum: 1, maximum: FINDINGS_LIMIT_MAX },
    offset: { type: 'integer', minimum: 0, maximum: FINDINGS_OFFSET_MAX },
  }),
  tool(
    'get_finding',
    'Lire le certificat, les extraits, la reproduction indépendante et la commande de reproduction.',
    {
      id: { type: 'string', pattern: FINDING_ID_RE.source, examples: ['F-2026-1120'] },
    },
    ['id'],
  ),
  tool(
    'get_c03_experiment',
    'Consulter les scores, les cas et les revues indépendantes de l’expérience C0.3.',
  ),
]

const resources = [
  { uri: 'bugdeloi://snapshot', name: 'Instantané du projet', mimeType: 'application/json' },
  { uri: 'bugdeloi://c03-experiment', name: 'Expérience C0.3', mimeType: 'application/json' },
  { uri: 'bugdeloi://join-instructions', name: 'Instructions de participation', mimeType: 'text/plain' },
]

export function mcpManifest(origin: string) {
  const url = new URL(endpoint, origin).href
  return {
    name: 'bugdeloi-mcp',
    version: serverInfo.version,
    protocolVersion,
    endpoint,
    tools,
    resources,
    usage: {
      'Claude Code': `claude mcp add --transport http bugdeloi ${url}`,
      Codex: `codex mcp add bugdeloi --url ${url}`,
      Cursor: JSON.stringify({ mcpServers: { bugdeloi: { url } } }, null, 2),
    },
  }
}

function c03Experiment(reports: Record<string, string>) {
  const reportsUrl = 'https://github.com/theonaciri/bugdeloi/blob/main/docs/audits/verifications'
  return {
    ...summary,
    currency: 'EUR',
    cases: summary.cases.map((row) => ({
      ...row,
      expected: typeof row.expected === 'number' ? row.expected / 100 : row.expected,
      actual: typeof row.actual === 'number' ? row.actual / 100 : row.actual,
    })),
    verifications: {
      Test3: readVerifications('Test3', reports, reportsUrl),
      Test12: readVerifications('Test12', reports, reportsUrl),
    },
  }
}

type SearchOptions = { code?: CodeKey; limit?: number }
type McpSources = {
  snapshot: () => Promise<object>
  search: (query: string, options: SearchOptions) => Promise<object>
  article: (id: string) => Promise<object | null>
  findings: (options: WorkingFindingsOptions) => Promise<object>
  finding: (id: string) => Promise<object | null>
  experiment: () => object
  join: () => string
}

function dataSources(origin: string, reports: Record<string, string>): McpSources {
  return {
    snapshot,
    search: searchCatalog,
    async article(id) {
      const result = await article(id)
      return result && { ...result, url: legifranceArticleUrl(id) }
    },
    async findings(options) {
      return {
        ...(await workingFindings(options)),
        status: options.status ?? 'reproduced',
        note: FINDINGS_NOTE,
      }
    },
    async finding(id) {
      const detail = await findingDetail(id)
      if (!detail) return null
      const certificate: unknown = JSON.parse(detail.certificate)
      return { ...detail, certificate }
    },
    experiment: () => c03Experiment(reports),
    join: () => joinText(origin, process.env.DESK_ENABLED === '1'),
  }
}

type RpcId = number | string | null
const errors = {
  [-32700]: 'Parse error',
  [-32600]: 'Invalid Request',
  [-32601]: 'Method not found',
  [-32602]: 'Invalid params',
  [-32603]: 'Internal error',
  [-32002]: 'Resource not found',
} as const
type RpcCode = keyof typeof errors
const rpcError = (id: RpcId, code: RpcCode) => ({
  jsonrpc: '2.0',
  id,
  error: { code, message: errors[code] },
})
const rpcResult = (id: RpcId, result: object) => ({ jsonrpc: '2.0', id, result })

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRpcId(value: unknown): value is string | number {
  return typeof value === 'string' || (typeof value === 'number' && Number.isInteger(value))
}

function validInteger(value: unknown, min: number, max: number): value is number | undefined {
  return (
    value === undefined ||
    (typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max)
  )
}

function validCode(value: unknown): value is CodeKey | undefined {
  return value === undefined || (typeof value === 'string' && isCodeKey(value))
}

function validIdentifier(id: unknown, pattern: RegExp): id is string {
  return typeof id === 'string' && id.length <= 64 && pattern.test(id) && !/\s/u.test(id)
}

async function callTool(params: Record<string, unknown>, sources: McpSources) {
  const { name, arguments: args = {} } = params
  const definition = tools.find((tool) => tool.name === name)
  if (
    !definition ||
    !isRecord(args) ||
    Object.keys(args).some((key) => !Object.hasOwn(definition.inputSchema.properties, key))
  ) {
    return null
  }
  switch (name) {
    case 'get_project_snapshot':
      return sources.snapshot()
    case 'search_articles': {
      const { query, code, limit } = args
      if (isSearchQuery(query) && validCode(code) && validInteger(limit, 1, SEARCH_LIMIT_MAX)) {
        return sources.search(query.trim(), { code, limit })
      }
      return null
    }
    case 'get_article':
      return validIdentifier(args.legiarti, LEGIARTI_RE)
        ? ((await sources.article(args.legiarti)) ?? { article: null })
        : null
    case 'list_findings': {
      const { status, type, code, limit, offset } = args
      if (
        (status === undefined || (typeof status === 'string' && isFindingStatus(status))) &&
        (type === undefined || (typeof type === 'string' && isFindingType(type))) &&
        validCode(code) &&
        validInteger(limit, 1, FINDINGS_LIMIT_MAX) &&
        validInteger(offset, 0, FINDINGS_OFFSET_MAX)
      ) {
        return sources.findings({ status, type, code, limit, offset })
      }
      return null
    }
    case 'get_finding':
      return validIdentifier(args.id, FINDING_ID_RE)
        ? ((await sources.finding(args.id)) ?? { finding: null })
        : null
    case 'get_c03_experiment':
      return sources.experiment()
    default:
      return null
  }
}

async function dispatch(message: unknown, sources: McpSources) {
  if (!isRecord(message) || message.jsonrpc !== '2.0') return rpcError(null, -32600)
  const id = message.id
  if (typeof message.method !== 'string') {
    // Les réponses du client n’ont aucun effet sur ce serveur sans session.
    if (!Object.hasOwn(message, 'method') && isRpcId(id)) {
      if (Object.hasOwn(message, 'result') && !Object.hasOwn(message, 'error')) return null
      const error = message.error
      if (
        !Object.hasOwn(message, 'result') &&
        isRecord(error) &&
        typeof error.code === 'number' &&
        Number.isInteger(error.code) &&
        typeof error.message === 'string'
      )
        return null
    }
    return rpcError(null, -32600)
  }
  if (id !== undefined && !isRpcId(id)) return rpcError(null, -32600)
  const params = message.params ?? {}
  if (id === undefined) return null
  if (!isRecord(params) || message.params === null) return rpcError(id, -32602)

  try {
    switch (message.method) {
      case 'initialize': {
        const { protocolVersion: requested, capabilities, clientInfo } = params
        if (
          typeof requested !== 'string' ||
          !requested ||
          !isRecord(capabilities) ||
          !isRecord(clientInfo) ||
          typeof clientInfo.name !== 'string' ||
          typeof clientInfo.version !== 'string'
        )
          return rpcError(id, -32602)
        return rpcResult(id, {
          protocolVersion,
          capabilities: { tools: {}, resources: {} },
          serverInfo,
          instructions,
        })
      }
      case 'ping':
        return rpcResult(id, {})
      case 'tools/list':
        return rpcResult(id, { tools })
      case 'tools/call': {
        const data = await callTool(params, sources)
        return data
          ? rpcResult(id, {
              content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
              structuredContent: data,
            })
          : rpcError(id, -32602)
      }
      case 'resources/list':
        return rpcResult(id, { resources })
      case 'resources/read': {
        if (typeof params.uri !== 'string') return rpcError(id, -32602)
        const resource = resources.find(({ uri }) => uri === params.uri)
        if (!resource) return rpcError(id, -32002)
        const { uri, mimeType } = resource
        const text =
          uri === 'bugdeloi://join-instructions'
            ? sources.join()
            : JSON.stringify(
                uri === 'bugdeloi://snapshot' ? await sources.snapshot() : sources.experiment(),
                null,
                2,
              )
        return rpcResult(id, { contents: [{ uri, mimeType, text }] })
      }
      default:
        return rpcError(id, -32601)
    }
  } catch {
    return rpcError(id, -32603)
  }
}

export function mcpOriginAllowed(request: Request, origin: string): boolean {
  const header = request.headers.get('origin')
  return header === null || header === origin
}

export function acceptsSse(request: Request): boolean {
  return accepts(request, 'text/event-stream')
}

function accepts(request: Request, type: string): boolean {
  return (
    request.headers
      .get('accept')
      ?.split(',')
      .some((entry) => {
        const [media, ...params] = entry.trim().toLowerCase().split(';')
        return media?.trim() === type && !params.some((param) => /^\s*q\s*=\s*0(?:\.0*)?\s*$/u.test(param))
      }) ?? false
  )
}

const noStore = { 'cache-control': CACHE.none }
const maxMessages = 32

/** Transport stateless. Une requête POST reçoit une réponse JSON ou un 202 vide. */
export async function handleMcpPost(
  request: Request,
  origin: string,
  reports: Record<string, string> = {},
  sources: Partial<McpSources> = {},
): Promise<Response> {
  if (!mcpOriginAllowed(request, origin)) return new Response(null, { status: 403, headers: noStore })
  if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    return new Response(null, { status: 415, headers: noStore })
  }
  if (
    request.headers.has('accept') &&
    !['application/json', 'application/*', '*/*'].some((type) => accepts(request, type))
  ) {
    return new Response(null, { status: 406, headers: noStore })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json(rpcError(null, -32700), { status: 400, headers: noStore })
  }
  const handlers = { ...dataSources(origin, reports), ...sources }
  if (Array.isArray(payload)) {
    if (payload.length === 0 || payload.length > maxMessages) {
      return Response.json(rpcError(null, -32600), { headers: noStore })
    }
    const responses = (
      await Promise.all(payload.map((message: unknown) => dispatch(message, handlers)))
    ).filter((response) => response !== null)
    return responses.length > 0
      ? Response.json(responses, { headers: noStore })
      : new Response(null, { status: 202, headers: noStore })
  }

  const response = await dispatch(payload, handlers)
  return response
    ? Response.json(response, { headers: noStore })
    : new Response(null, { status: 202, headers: noStore })
}
