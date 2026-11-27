import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { CODES } from '@bugdeloi/core'

export type AnalysisCategory = 'calculable' | 'mixte' | 'hors_perimetre' | 'autre'

export const ANALYSIS_CATEGORIES: readonly AnalysisCategory[] = [
  'calculable',
  'mixte',
  'hors_perimetre',
  'autre',
] as const

export const ANALYSIS_CATEGORY_LABEL: Record<AnalysisCategory, string> = {
  calculable: 'Calculable',
  mixte: 'Mixte',
  hors_perimetre: 'Hors périmètre',
  autre: 'À préciser',
}

export type CodeKey = keyof typeof CODES

export interface AnalysisEntry {
  id: string
  title: string
  codeKey: CodeKey | null
  interfaceName: string | null
  category: AnalysisCategory
  file: string
}

export interface AnalysesSummary {
  total: number
  byCategory: Record<AnalysisCategory, number>
  items: AnalysisEntry[]
}

const FILE_RE = /^(LEGIARTI\d{12})\.md$/

function resolveAnalysesDir(): string | null {
  const candidates = [
    resolve(process.cwd(), 'corpus/analyses'),
    resolve(process.cwd(), '../../corpus/analyses'),
  ]
  for (const dir of candidates) {
    if (existsSync(dir)) return dir
  }
  return null
}

function detectCodeKey(title: string): CodeKey | null {
  const lower = title.toLowerCase()
  if (lower.includes('code général des impôts') || lower.includes('code general des impots')) return 'CGI'
  if (lower.includes('sécurité sociale') || lower.includes('securite sociale')) return 'CSS'
  if (
    lower.includes('construction et de l’habitation') ||
    lower.includes("construction et de l'habitation")
  ) {
    return 'CCH'
  }
  return null
}

export function classifyAnalysis(content: string): AnalysisCategory {
  const section = (content.split(/##\s+Classement/i)[1] ?? content).toLowerCase()
  const hasCalc = /\bcalculable\b/.test(section)
  const hasApp = /appr[ée]ciation/.test(section)
  const hasHors = /hors[_\s-]p[ée]rim[èe]tre/.test(section)
  const matches = [hasCalc, hasApp, hasHors].filter(Boolean).length
  if (matches > 1) return 'mixte'
  if (hasCalc) return 'calculable'
  if (hasHors) return 'hors_perimetre'
  if (hasApp) return 'mixte'
  return 'autre'
}

let cachedSummary: AnalysesSummary | null = null

/** Les fiches d'analyse fusionnées (`corpus/analyses/LEGIARTI*.md`), triées par identifiant. */
export function readAnalysisFiles(): { id: string; file: string; content: string }[] {
  const dir = resolveAnalysesDir()
  if (!dir) return []
  return readdirSync(dir)
    .filter((f) => FILE_RE.test(f))
    .sort()
    .flatMap((filename) => {
      const id = FILE_RE.exec(filename)?.[1]
      if (!id) return []
      return [{ id, file: `corpus/analyses/${filename}`, content: readFileSync(join(dir, filename), 'utf8') }]
    })
}

/**
 * Charge et catégorise les fiches d'analyse (`corpus/analyses/LEGIARTI*.md`).
 * Mis en cache en mémoire pour la durée du processus (les fichiers sont figés par release).
 */
export function getAnalysesSummary(): AnalysesSummary {
  if (cachedSummary) return cachedSummary

  const byCategory: Record<AnalysisCategory, number> = {
    calculable: 0,
    mixte: 0,
    hors_perimetre: 0,
    autre: 0,
  }
  const items: AnalysisEntry[] = []

  const dir = resolveAnalysesDir()
  if (dir) {
    const files = readdirSync(dir)
      .filter((f) => FILE_RE.test(f))
      .sort()
    for (const filename of files) {
      const match = FILE_RE.exec(filename)
      const id = match?.[1]
      if (!id) continue
      const content = readFileSync(join(dir, filename), 'utf8')
      const headingMatch = /^#\s+(.+)$/m.exec(content)
      const title = headingMatch?.[1]?.trim() ?? id
      const ifaceSection = content.split(/##\s+Interface/i)[1]?.split(/^##\s+/m)[0] ?? ''
      const ifaceMatch = /`(\p{Lu}[\p{L}\p{N}_]*@v\d+)`/u.exec(ifaceSection)
      const category = classifyAnalysis(content)
      byCategory[category] += 1
      items.push({
        id,
        title,
        codeKey: detectCodeKey(title),
        interfaceName: ifaceMatch?.[1] ?? null,
        category,
        file: `corpus/analyses/${filename}`,
      })
    }
  }

  cachedSummary = { total: items.length, byCategory, items }
  return cachedSummary
}
