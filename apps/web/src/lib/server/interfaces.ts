/**
 * Interfaces figées : ce qui ouvre une tâche de traduction au guichet.
 *
 * Règle (AGENTS.md §6, décision du 27/11/2026) : **une fiche d'analyse fusionnée sur `main` fige
 * l'interface qu'elle propose.** La fusion suit la relecture de la PR et les contrôles du dépôt ; elle
 * vaut gel. Une traduction s'ouvre pour chaque article au niveau N1 dont la fiche est classée
 * « calculable » ou « mixte », si le texte en vigueur a toujours l'empreinte relevée par l'analyse.
 * Les fiches « hors périmètre » ou « à préciser » n'ouvrent rien. La liste manuelle
 * (`desk-translations.ts`) reste prioritaire quand elle couvre le même article.
 */
import { CODES } from '@bugdeloi/core/legi'
import { type Db, legalSection } from '@bugdeloi/db'
import { asc, sql } from 'drizzle-orm'
import { type AnalysisCategory, classifyAnalysis, readAnalysisFiles } from './analyses.ts'
import { translations } from './desk-translations.ts'

export interface FrozenInterface {
  legiarti: string
  /** Empreinte du texte relevée par l'analyse : la tâche n'existe que si LEGI n'a pas changé depuis. */
  hash: string
  /** `Nom@vN`. */
  interface: string
  /** Entrées, sorties et consignes, telles que la fiche les formule. */
  signature: string
  /** Chemin du fichier Catala imposé (liste manuelle) ; sinon calculé depuis l'arbre Légifrance. */
  path: string | null
  source: 'analyse' | 'manuelle'
  analysisFile: string | null
  category: AnalysisCategory | null
}

const TRANSLATABLE: AnalysisCategory[] = ['calculable', 'mixte']

/** Lit une fiche d'analyse : interface proposée, signature, empreinte. `null` si un élément manque. */
export function parseAnalysis(
  content: string,
): { interface: string; signature: string; hash: string } | null {
  const section = content.split(/^##\s+Interface[^\n]*\n/im)[1]?.split(/^##\s+/m)[0] ?? ''
  const name = /`(\p{Lu}[\p{L}\p{N}_]*@v\d+)`/u.exec(section)?.[1]
  const hash = /SHA-256\s*`([0-9a-f]{64})`/.exec(content)?.[1]
  if (!name || !hash) return null
  const signature = section
    .replace(`\`${name}\``, '')
    .replace(/^#{3,}\s+(.+)$/gm, '$1 :')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/:\s*\n+/g, ' : ')
    .replace(/\.?\s*\n+\s*/g, '. ')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+/, '')
    .trim()
  return { interface: name, signature: signature || `Interface ${name}.`, hash }
}

let cached: Map<string, FrozenInterface> | null = null

/** Toutes les interfaces figées, par LEGIARTI (calculé une fois par processus : le corpus est figé par release). */
export function frozenInterfaces(): Map<string, FrozenInterface> {
  if (cached) return cached
  const map = new Map<string, FrozenInterface>()
  for (const { id, file, content } of readAnalysisFiles()) {
    const category = classifyAnalysis(content)
    if (!TRANSLATABLE.includes(category)) continue
    const parsed = parseAnalysis(content)
    if (!parsed) continue
    map.set(id, { legiarti: id, ...parsed, path: null, source: 'analyse', analysisFile: file, category })
  }
  for (const t of translations) {
    map.set(t.legiarti, {
      legiarti: t.legiarti,
      hash: t.hash,
      interface: t.interface,
      signature: t.signature,
      path: t.path,
      source: 'manuelle',
      analysisFile: map.get(t.legiarti)?.analysisFile ?? null,
      category: map.get(t.legiarti)?.category ?? null,
    })
  }
  cached = map
  return map
}

/** Identifiant de la tâche de traduction : `translate-<LEGIARTI>-v<N>`. */
export function translationTaskId(spec: Pick<FrozenInterface, 'legiarti' | 'interface'>): string {
  return `translate-${spec.legiarti}-${spec.interface.split('@')[1] ?? 'v1'}`
}

// ---------------------------------------------------------------------------
// Chemin du fichier Catala (AGENTS.md §7 : le chemin reflète la hiérarchie Légifrance)
// ---------------------------------------------------------------------------

const ORDINALS: Record<string, number> = {
  premier: 1,
  premiere: 1,
  ier: 1,
  '1er': 1,
  '1re': 1,
  deuxieme: 2,
  second: 2,
  seconde: 2,
  troisieme: 3,
  quatrieme: 4,
  cinquieme: 5,
  sixieme: 6,
  septieme: 7,
  huitieme: 8,
  neuvieme: 9,
  dixieme: 10,
}

const KINDS = [
  'livre',
  'partie',
  'titre',
  'chapitre',
  'section',
  'sous-section',
  'paragraphe',
  'sous-paragraphe',
]

function plain(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function slugify(s: string): string {
  return plain(s)
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function romanToInt(s: string): number | null {
  if (!/^[ivxlcdm]+$/.test(s)) return null
  const v: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 }
  let total = 0
  for (let i = 0; i < s.length; i++) {
    const cur = v[s[i] as string] ?? 0
    const next = v[s[i + 1] as string] ?? 0
    total += cur < next ? -cur : cur
  }
  return total
}

function numberOf(token: string): string | null {
  const t = plain(token).replace(/[.°]$/, '')
  if (ORDINALS[t] !== undefined) return String(ORDINALS[t])
  if (/^\d+(e|er|re)?$/.test(t)) return t.replace(/\D/g, '')
  const r = romanToInt(t)
  return r ? String(r) : null
}

/** « Section V : Calcul de la taxe » → `section5` ; « I : Taux » → `i` ; « Partie législative » → `null`. */
export function sectionSlug(title: string): string | null {
  const head = (title.split(':')[0] ?? title).trim()
  const p = plain(head)
  if (p === 'partie legislative') return null
  if (p.startsWith('partie reglementaire')) return slugify(head.split(/\s+-\s+/)[1] ?? head) || null
  const words = head.split(/\s+/)
  const first = plain(words[0] ?? '')
  // Ordinal avant le type : « Première Partie », « 1re Sous-section », « 2e Section »
  const ordinal = numberOf(words[0] ?? '')
  const kindAfter = plain(words[1] ?? '')
  if (words.length >= 2 && ordinal && KINDS.includes(kindAfter)) {
    const rest = words.slice(2).map(slugify).filter(Boolean)
    return [`${kindAfter}${ordinal}`, ...rest].join('-')
  }
  if (KINDS.includes(first)) {
    const n = numberOf(words[1] ?? '')
    const rest = words
      .slice(n ? 2 : 1)
      .map(slugify)
      .filter(Boolean)
    return [n ? `${first}${n}` : first, ...rest].join('-')
  }
  return slugify(head) || null
}

/** `cgi/livre1/partie1/titre2/chapitre1/section5/i/a/article_278.catala_fr` (relatif à `corpus/`). */
export function catalaPath(
  textId: string,
  sectionTitles: string[],
  num: string | null,
  legiarti: string,
): string {
  const code =
    Object.values(CODES)
      .find((c) => c.id === textId)
      ?.short.toLowerCase() ?? 'autres'
  const dirs = sectionTitles.map(sectionSlug).filter((s): s is string => Boolean(s))
  const file = `article_${num ? slugify(num) : legiarti.toLowerCase()}.catala_fr`
  return [code, ...dirs, file].join('/')
}

/** Titres des sections ancêtres d'un article, de la racine du code à sa section. */
export async function sectionTitles(
  database: Pick<Db, 'select'>,
  sectionId: string | null,
): Promise<string[]> {
  if (!sectionId) return []
  const own = sql`(select ${legalSection.path} from ${legalSection} where ${legalSection.id} = ${sectionId})`
  const rows = await database
    .select({ title: legalSection.title })
    .from(legalSection)
    .where(sql`${legalSection.path} @> ${own}`)
    .orderBy(asc(legalSection.depth))
  return rows.map((r) => r.title)
}
