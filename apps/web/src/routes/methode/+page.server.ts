import { articleInForce, articleStatus, legalArticle } from '@bugdeloi/db'
import { count, eq } from 'drizzle-orm'
import { asLevel, emptyLevelCounts } from '#lib/levels.ts'
import { db } from '#lib/server/db.ts'
import { CACHE } from '#lib/server/http.ts'
import type { PageServerLoad } from './$types'

/** Page éditoriale + compteurs live par niveau de preuve pour les liens vers /travail. */
export const load: PageServerLoad = async ({ setHeaders }) => {
  setHeaders({ 'cache-control': CACHE.data })

  const levelRows = await db()
    .select({
      level: articleStatus.level,
      total: count(),
    })
    .from(legalArticle)
    .leftJoin(articleStatus, eq(articleStatus.articleId, legalArticle.id))
    .where(articleInForce())
    .groupBy(articleStatus.level)

  const counts = emptyLevelCounts()
  for (const row of levelRows) {
    const lvl = asLevel(row.level)
    counts[lvl] += Number(row.total)
  }

  return { counts }
}
