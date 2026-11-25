/**
 * Politique de cache HTTP. Les pages publiques sont derrière Cloudflare : `s-maxage` règle le
 * cache edge, `max-age` le navigateur. Seuls /api/stream et les routes /desk/* doivent
 * toucher l'origine à chaque requête (AGENTS.md §9.3).
 */
export const CACHE = {
  /** Compteurs et état : quasi temps réel (l'accueil se met à jour par SSE de toute façon). */
  live: 'public, max-age=0, s-maxage=5, stale-while-revalidate=30',
  /** Pages de données (carte, article) : changent à l'ingestion ou quand un niveau évolue. */
  data: 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
  /** Pages éditoriales (méthode, participer, soutenir…) : changent au déploiement. */
  editorial: 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
  /** Alias permanents (/map → /carte…). */
  redirect: 'public, max-age=86400, s-maxage=86400',
  /** Page introuvable : courte durée pour ne pas figer une erreur. */
  notFound: 'public, max-age=30, s-maxage=60',
  /** Flux SSE : jamais en cache, jamais transformé (la compression bufferiserait le flux). */
  stream: 'no-cache, no-transform',
  none: 'no-store',
} as const

/** En-têtes de sécurité ajoutés à toutes les réponses (la CSP est gérée par SvelteKit). */
export const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'cross-origin-opener-policy': 'same-origin',
  'x-frame-options': 'DENY',
}

/** Redirection permanente d'un alias, en conservant la requête (?code=…). */
export function permanentRedirect(url: URL, to: string): Response {
  return new Response(null, {
    status: 308,
    headers: { location: `${to}${url.search}`, 'cache-control': CACHE.redirect },
  })
}
