import { createDeskRateLimiter } from '#lib/server/desk-http.ts'
import { CACHE } from '#lib/server/http.ts'
import { acceptsSse, handleMcpPost, mcpManifest, mcpOriginAllowed } from '#lib/server/mcp.ts'
import type { RequestHandler } from './$types'

const reports = import.meta.glob<string>('../../../../../../docs/audits/verifications/2026-11-25-c0.3-*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
})

export const GET: RequestHandler = ({ request, url }) => {
  const vary = 'Accept, Origin'
  if (!mcpOriginAllowed(request, url.origin)) {
    return new Response(null, { status: 403, headers: { 'cache-control': CACHE.none, vary } })
  }
  if (acceptsSse(request)) {
    return new Response(null, {
      status: 405,
      headers: { allow: 'GET, POST', 'cache-control': CACHE.none, vary },
    })
  }
  return Response.json(mcpManifest(url.origin), { headers: { 'cache-control': CACHE.data, vary } })
}

const limitRequests = createDeskRateLimiter()

export const POST: RequestHandler = ({ request, url, getClientAddress }) => {
  if (!mcpOriginAllowed(request, url.origin)) return handleMcpPost(request, url.origin)
  let address = ''
  try {
    address = getClientAddress()
  } catch {
    // Quota commun lorsque l’adaptateur ne fournit pas l’adresse.
  }
  const limited = limitRequests(address)
  if (limited) {
    limited.headers.set('cache-control', CACHE.none)
    return limited
  }
  return handleMcpPost(request, url.origin, reports)
}
