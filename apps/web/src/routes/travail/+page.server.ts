import { CODES } from '@bugdeloi/core'
import { articleInForce, articleStatus, legalArticle, legalText } from '@bugdeloi/db'
import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm'
import { asLevel, LEVELS, type Level } from '#lib/levels.ts'
import { ANALYSIS_CATEGORIES, type AnalysisCategory, getAnalysesSummary } from '#lib/server/analyses.ts'
import { db } from '#lib/server/db.ts'
import { CACHE } from '#lib/server/http.ts'
import { getLevelCounts } from '#lib/server/queries.ts'
import type { PageServerLoad } from './$types'

type CodeKey = keyof typeof CODES
const isCodeKey = (value: string | null): value is CodeKey => value !== null && Object.hasOwn(CODES, value)

const PAGE_SIZE = 100
type FilterLevel = Level | 'formalises' | 'analyses' | 'all'
type FilterCategory = AnalysisCategory | 'all'

function parseFilterLevel(raw: string | null): FilterLevel {
  if (!raw || raw === 'formalises') return 'formalises'
  if (raw === 'analyses') return 'analyses'
  if (raw === 'all') return 'all'
  if ((LEVELS as readonly string[]).includes(raw)) return raw as Level
  return 'formalises'
}

function parseFilterCategory(raw: string | null): FilterCategory {
  if (!raw || raw === 'all') return 'all'
  if ((ANALYSIS_CATEGORIES as readonly string[]).includes(raw)) return raw as AnalysisCategory
  return 'all'
}

export const load: PageServerLoad = async ({ url, setHeaders }) => {
  setHeaders({ 'cache-control': CACHE.data })

  const niveau = parseFilterLevel(url.searchParams.get('niveau'))
  const categorie = parseFilterCategory(url.searchParams.get('categorie'))
  const rawCode = url.searchParams.get('code')
  const code: CodeKey | 'all' = rawCode && isCodeKey(rawCode) ? rawCode : 'all'
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  const baseConditions = [articleInForce()]
  if (code !== 'all') {
    baseConditions.push(eq(legalArticle.textId, CODES[code].id))
  }

  // Compteurs par niveau de preuve pour le code sélectionné (cache mémoire 60 s)
  const counts = await getLevelCounts(code !== 'all' ? CODES[code].id : undefined)
  const formalisesTotal = counts.N5 + counts.N4 + counts.N3 + counts.N2 + counts.N1 + counts.REF
  const allTotal = formalisesTotal + counts.N0

  // Analyses préparatoires (corpus/analyses/*.md) filtrées par code si sélectionné
  const allAnalyses = getAnalysesSummary()
  const analysesForCode =
    code === 'all' ? allAnalyses.items : allAnalyses.items.filter((a) => a.codeKey === code)
  const analysesByCategory: Record<AnalysisCategory, number> = {
    calculable: 0,
    mixte: 0,
    hors_perimetre: 0,
    autre: 0,
  }
  for (const a of analysesForCode) {
    analysesByCategory[a.category] += 1
  }
  const analysesTotal = analysesForCode.length

  if (niveau === 'analyses') {
    const filtered =
      categorie === 'all' ? analysesForCode : analysesForCode.filter((a) => a.category === categorie)
    const totalMatching = filtered.length
    const paged = filtered.slice(offset, offset + PAGE_SIZE)
    return {
      codes: CODES,
      niveau,
      categorie,
      code,
      page,
      pageSize: PAGE_SIZE,
      totalMatching,
      totalPages: Math.max(1, Math.ceil(totalMatching / PAGE_SIZE)),
      counts,
      formalisesTotal,
      allTotal,
      analysesTotal,
      analysesByCategory,
      items: [],
      analysesItems: paged,
    }
  }

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
      codes: CODES,
      id: r.id,
      num: r.num,
      codeTitle: r.codeTitle,
      level: asLevel(r.level),
      catalaFile,
      updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
    }
  })

  return {
    codes: CODES,
    niveau,
    categorie,
    code,
    page,
    pageSize: PAGE_SIZE,
    totalMatching,
    totalPages: Math.max(1, Math.ceil(totalMatching / PAGE_SIZE)),
    counts,
    formalisesTotal,
    allTotal,
    analysesTotal,
    analysesByCategory,
    items,
    analysesItems: [],
  }
}
