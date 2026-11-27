import { CODES } from '@bugdeloi/core'
import { articleInForce, articleStatus, legalArticle, legalText } from '@bugdeloi/db'
import { and, asc, count, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { asLevel, emptyLevelCounts, LEVELS, type Level } from '#lib/levels.ts'
import { db } from '#lib/server/db.ts'
import { CACHE } from '#lib/server/http.ts'
import type { PageServerLoad } from './$types'

type CodeKey = keyof typeof CODES
const isCodeKey = (value: string | null): value is CodeKey => value !== null && Object.hasOwn(CODES, value)

const PAGE_SIZE = 100
type FilterLevel = Level | 'formalises' | 'all'

function parseFilterLevel(raw: string | null): FilterLevel {
  if (!raw || raw === 'formalises') return 'formalises'
  if (raw === 'all') return 'all'
  if ((LEVELS as readonly string[]).includes(raw)) return raw as Level
  return 'formalises'
}

export const load: PageServerLoad = async ({ url, setHeaders }) => {
  setHeaders({ 'cache-control': CACHE.data })

  const niveau = parseFilterLevel(url.searchParams.get('niveau'))
  const rawCode = url.searchParams.get('code')
  const code: CodeKey | 'all' = rawCode && isCodeKey(rawCode) ? rawCode : 'all'
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  const baseConditions = [articleInForce()]
  if (code !== 'all') {
    baseConditions.push(eq(legalArticle.textId, CODES[code].id))
  }

  // Compteurs par niveau de preuve pour le code sélectionné
  const levelRows = await db()
    .select({
      level: sql<string>`coalesce(${articleStatus.level}, 'N0')`,
      total: count(),
    })
    .from(legalArticle)
    .leftJoin(articleStatus, eq(articleStatus.articleId, legalArticle.id))
    .where(and(...baseConditions))
    .groupBy(sql`coalesce(${articleStatus.level}, 'N0')`)

  const counts = emptyLevelCounts()
  for (const row of levelRows) {
    counts[asLevel(row.level)] += row.total
  }
  const formalisesTotal = counts.N5 + counts.N4 + counts.N3 + counts.N2 + counts.N1 + counts.REF
  const allTotal = formalisesTotal + counts.N0

  const filterConditions = [...baseConditions]
  if (niveau === 'formalises') {
    filterConditions.push(inArray(articleStatus.level, ['N5', 'N4', 'N3', 'N2', 'N1', 'REF']))
  } else if (niveau === 'N0') {
    const n0Cond = or(isNull(articleStatus.level), eq(articleStatus.level, 'N0'))
    if (n0Cond) filterConditions.push(n0Cond)
  } else if (niveau !== 'all') {
    filterConditions.push(eq(articleStatus.level, niveau))
  }

  const totalMatching =
    niveau === 'formalises' ? formalisesTotal : niveau === 'all' ? allTotal : counts[niveau]

  const rows = await db()
    .select({
      id: legalArticle.id,
      num: legalArticle.num,
      codeId: legalArticle.textId,
      codeTitle: legalText.title,
      level: articleStatus.level,
      evidence: articleStatus.evidence,
      updatedAt: articleStatus.updatedAt,
    })
    .from(legalArticle)
    .innerJoin(legalText, eq(legalText.id, legalArticle.textId))
    .leftJoin(articleStatus, eq(articleStatus.articleId, legalArticle.id))
    .where(and(...filterConditions))
    .orderBy(asc(legalText.shortTitle), asc(legalArticle.num), asc(legalArticle.id))
    .limit(PAGE_SIZE)
    .offset(offset)

  const items = rows.map((r) => {
    const ev = r.evidence && typeof r.evidence === 'object' ? (r.evidence as Record<string, unknown>) : null
    const corpusEv =
      ev?.corpus && typeof ev.corpus === 'object' ? (ev.corpus as Record<string, unknown>) : null
    const catalaFile = typeof corpusEv?.file === 'string' ? corpusEv.file : null
    return {
      id: r.id,
      num: r.num,
      codeTitle: r.codeTitle,
      level: asLevel(r.level),
      catalaFile,
      updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
    }
  })

  return {
    niveau,
    code,
    page,
    pageSize: PAGE_SIZE,
    totalMatching,
    totalPages: Math.max(1, Math.ceil(totalMatching / PAGE_SIZE)),
    counts,
    formalisesTotal,
    allTotal,
    items,
  }
}
