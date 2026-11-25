import { LEGIARTI_RE } from '@bugdeloi/core/legi'
import { CACHE } from '#lib/server/http.ts'
import { referenceArticles } from '#lib/server/queries.ts'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ url, setHeaders }) => {
  const value = url.searchParams.get('sauf')
  const exclude = value && LEGIARTI_RE.test(value) ? value : undefined
  const articles = await referenceArticles(exclude)
  setHeaders({ 'cache-control': CACHE.live })
  return { articles, exclude }
}
