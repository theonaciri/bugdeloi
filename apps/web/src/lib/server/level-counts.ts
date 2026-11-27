import { articleInForce } from '@bugdeloi/db/predicates'
import { articleStatus, legalArticle } from '@bugdeloi/db/schema'
import { and, count, eq } from 'drizzle-orm'
import { asLevel, emptyLevelCounts, type LevelCounts } from '../levels.ts'
import { db } from './db.ts'

// ---------------------------------------------------------------------------
// Compteurs par niveau de preuve (cache mémoire court, 60 s)
// ---------------------------------------------------------------------------

const LEVEL_COUNTS_TTL_MS = 60_000
const levelCountsCache = new Map<string, { expiresAt: number; counts: LevelCounts }>()

/**
 * Compteurs d'articles en vigueur par niveau de preuve (`N0`–`N5`, `REF`),
 * optionnellement filtrés sur un `textId` (`LEGITEXT…`).
 * Mis en cache 60 s en mémoire pour éviter de rescanner ~72k versions à chaque requête.
 */
export async function getLevelCounts(textId?: string): Promise<LevelCounts> {
  const key = textId ?? 'all'
  const now = Date.now()
  const cached = levelCountsCache.get(key)
  if (cached && cached.expiresAt > now) {
    return { ...cached.counts }
  }

  const baseCond = textId ? and(articleInForce(), eq(legalArticle.textId, textId)) : articleInForce()
  const rows = await db()
    .select({
      level: articleStatus.level,
      total: count(),
    })
    .from(legalArticle)
    .leftJoin(articleStatus, eq(articleStatus.articleId, legalArticle.id))
    .where(baseCond)
    .groupBy(articleStatus.level)

  const counts = emptyLevelCounts()
  for (const row of rows) {
    const lvl = asLevel(row.level)
    counts[lvl] += Number(row.total)
  }

  levelCountsCache.set(key, { expiresAt: now + LEVEL_COUNTS_TTL_MS, counts })
  return { ...counts }
}
