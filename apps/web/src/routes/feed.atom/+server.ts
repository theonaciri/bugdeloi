import { eventHref, explainEvent } from '#lib/events.ts'
import { CACHE } from '#lib/server/http.ts'
import { feedEvents } from '#lib/server/queries.ts'
import type { RequestHandler } from './$types'

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

/** Flux Atom du journal public (mêmes règles de filtrage que l'accueil). */
export const GET: RequestHandler = async ({ url }) => {
  const events = await feedEvents(50)
  const origin = url.origin
  const updated = events[0]?.ts ?? new Date(0).toISOString()
  const entries = events
    .map((e) => {
      const title = `${explainEvent(e.type).title}${e.subject ? ` · ${e.subject}` : ''}`
      const summary = [e.summary ?? explainEvent(e.type).why, `Type : ${e.type}`, `Acteur : ${e.actor}`]
        .filter(Boolean)
        .join(' — ')
      const link = `${origin}${eventHref(e.id)}`
      return `  <entry>
    <id>tag:bugdeloi,2026:event/${e.id}</id>
    <title>${esc(title)}</title>
    <updated>${esc(e.ts)}</updated>
    <link href="${esc(link)}"/>
    <author><name>${esc(e.actor)}</name></author>
    <summary>${esc(summary)}</summary>
  </entry>`
    })
    .join('\n')
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="fr">
  <id>tag:bugdeloi,2026:journal</id>
  <title>BugDeLoi — journal public</title>
  <subtitle>Site citoyen indépendant · pas un service officiel · pas un conseil juridique</subtitle>
  <updated>${esc(updated)}</updated>
  <link rel="self" href="${esc(`${origin}/feed.atom`)}"/>
  <link href="${esc(`${origin}/`)}"/>
${entries}
</feed>
`
  return new Response(xml, {
    headers: { 'content-type': 'application/atom+xml; charset=utf-8', 'cache-control': CACHE.live },
  })
}
