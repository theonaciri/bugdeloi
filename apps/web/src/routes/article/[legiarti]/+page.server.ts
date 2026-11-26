import { legifranceArticleUrl } from '@bugdeloi/core/legi'
import { error } from '@sveltejs/kit'
import { isLegiarti } from '#lib/ids.ts'
import { sanitizeLegalHtml } from '#lib/sanitize.ts'
import { CACHE } from '#lib/server/http.ts'
import { article } from '#lib/server/queries.ts'
import bofipIndex from '../../../../../../corpus/doctrine/bofip-index.json'
import type { PageServerLoad } from './$types'

type BofipEntry = {
  bofipRef: string
  title: string
  url: string
  source: string
  note: string
}

const bofipByArticle = bofipIndex.articles as Record<string, BofipEntry[]>

export const load: PageServerLoad = async ({ params, setHeaders }) => {
  const a = await article(params.legiarti)
  if (!a) error(404, 'Article introuvable dans notre base')
  setHeaders({ 'cache-control': CACHE.data })
  const { contentHtml, notaHtml, ...rest } = a
  return {
    article: rest,
    doctrine: bofipByArticle[a.id] ?? [],
    // Le HTML DILA est assaini côté serveur, une seule fois, par liste blanche.
    contentSafe: sanitizeLegalHtml(contentHtml),
    notaSafe: sanitizeLegalHtml(notaHtml),
    legifrance: legifranceArticleUrl(a.id),
    versionLinks: Object.fromEntries(a.versions.map((v) => [v.id, legifranceArticleUrl(v.id)])),
    targetLinks: Object.fromEntries(
      a.links
        .map((l) => l.targetId)
        .filter(isLegiarti)
        .map((id) => [id, legifranceArticleUrl(id)]),
    ),
  }
}
