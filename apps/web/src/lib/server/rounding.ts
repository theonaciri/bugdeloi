import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveCorpusRoot, walkCatalaFiles } from './interfaces.ts'

/**
 * Inventaire mécanique des points d'arrondi du corpus (page `/anomalies/arrondis`).
 *
 * - `prescrit` : appel d'arrondi explicite (`arrondi de`, `Argent.arrondi_…`) sans `# TODO juridique`
 *   sur l'arrondi au-dessus de la définition : la traduction applique un arrondi qu'elle cite.
 * - `choisi` : la définition porte un `# TODO juridique` qui mentionne l'arrondi : le texte est muet
 *   et la traduction a fait un choix écrit (AGENTS.md §7).
 * - `implicite` : produit d'un montant par un pourcentage ou un décimal déclaré, que Catala arrondit
 *   au centime, sans note d'arrondi au-dessus de la définition. Écart possible inférieur à 1 € par
 *   opération ; à annoter (corpus/CATALA.md).
 *
 * Les scopes `#[test]` et les commentaires sont ignorés. Ce n'est pas un finding : un candidat
 * `ARRONDI` (§4.4) exige deux placements d'arrondi distants de plus de 1 €.
 */
export type RoundingKind = 'prescrit' | 'choisi' | 'implicite'

export const ROUNDING_KINDS: readonly RoundingKind[] = ['prescrit', 'choisi', 'implicite'] as const

export interface RoundingPoint {
  kind: RoundingKind
  /** Nom de la variable définie (`définition x égal à`), ou `null` hors définition. */
  definition: string | null
  /** Article sous lequel se trouve le code (`#### Article 197|LEGIARTI…`). */
  article: { num: string; legiarti: string } | null
  /** Numéros de ligne (1 = première ligne du fichier). */
  lines: number[]
  /** Code de la première ligne concernée, sans indentation. */
  code: string
  /** Commentaires qui précèdent la définition (citation ou `TODO juridique`). */
  note: string | null
}

export interface RoundingFile {
  /** Chemin relatif à `corpus/`. */
  file: string
  points: RoundingPoint[]
}

const ARTICLE_RE = /^#{1,6}\s+Article\s+(.+?)\|(LEGIARTI\d{12})\s*$/
const DEFINITION_RE = /^\s*définition\s+([\p{L}\p{N}_.]+)/u
/** Corps de scope, éventuellement conditionnel (`champ d'application X sous condition … :`). */
const SCOPE_RE = /^champ d'application\s+([\p{L}\p{N}_]+)(?:\s+sous condition\b.*)?\s*:\s*$/u
const TEST_DECL_RE = /^déclaration champ d'application\s+([\p{L}\p{N}_]+)\s*:/u
const DECIMAL_VAR_RE = /^\s*(?:entrée|résultat|interne|contexte)\s+([\p{L}\p{N}_]+)\s+contenu\s+décimal\b/u
const EXPLICIT_RE = /\barrondi de\b|\bArgent\.arrondi_[\p{L}_]+|\bDécimal\.arrondi\b/u
const PERCENT_RE = /[*/]\s*\d[\d ]*(?:,\d+)?\s*%/

function isComment(line: string): boolean {
  return /^\s*#(?!\[)/.test(line) && !ARTICLE_RE.test(line)
}

/** Produit ou quotient d'un montant par un décimal (heuristique de ligne, sans typage). */
function implicitOperation(line: string, isDecimal: (name: string) => boolean): boolean {
  if (/\bdécimal de\b/u.test(line)) return false
  if (PERCENT_RE.test(line)) return true
  for (const m of line.matchAll(/[*/]\s*\(?\s*([\p{L}_][\p{L}\p{N}_.]*)/gu)) {
    if (m[1] && isDecimal(m[1])) return true
  }
  return false
}

/** Sous-scope déclaré, y compris comme résultat ou interne (`résultat appel champ d'application Taux`). */
const SUBSCOPE_RE =
  /^\s+(?:(?:résultat|interne)\s+)?([\p{L}\p{N}_]+)\s+champ d'application\s+([\p{L}\p{N}_]+)\s*$/u

export function scanRounding(file: string, raw: string): RoundingFile {
  const lines = raw.split('\n')
  /** Variables décimales et sous-scopes, par scope déclaré : un même nom peut changer de type d'un scope à l'autre. */
  const decimals = new Map<string, Set<string>>()
  const subscopes = new Map<string, Map<string, string>>()
  const testScopes = new Set<string>()
  let pendingTest = false
  let declaring: string | null = null
  for (const line of lines) {
    if (/^#\[test\]/.test(line)) pendingTest = true
    const decl = TEST_DECL_RE.exec(line)?.[1]
    if (decl) {
      if (pendingTest) testScopes.add(decl)
      pendingTest = false
      declaring = decl
      continue
    }
    if (/^\S/.test(line)) declaring = null
    if (!declaring) continue
    const decimal = DECIMAL_VAR_RE.exec(line)?.[1]
    if (decimal) decimals.set(declaring, (decimals.get(declaring) ?? new Set()).add(decimal))
    const sub = SUBSCOPE_RE.exec(line)
    if (sub?.[1] && sub[2])
      subscopes.set(declaring, (subscopes.get(declaring) ?? new Map()).set(sub[1], sub[2]))
  }
  /** `x` dans le scope courant, ou `sous_scope.x` dans le scope du sous-scope. */
  function decimalIn(scope: string | null, name: string): boolean {
    if (!scope) return false
    const [head, field] = name.split('.', 2)
    if (head && field) return decimalIn(subscopes.get(scope)?.get(head) ?? null, field)
    return decimals.get(scope)?.has(name) ?? false
  }

  const points: RoundingPoint[] = []
  let inCode = false
  let inTest = false
  let currentScope: string | null = null
  let article: RoundingPoint['article'] = null
  let definition: string | null = null
  /** Ligne de la définition en cours : deux définitions homonymes ne fusionnent pas. */
  let definitionLine = 0
  let previousLine = -1
  let note: string | null = null
  let comments: string[] = []
  /** Un `TODO juridique` sur l'arrondi vaut pour les arrondis explicites suivants du même scope. */
  let scopeChoice = false

  lines.forEach((line, index) => {
    const heading = ARTICLE_RE.exec(line)
    if (heading?.[1] && heading[2]) article = { num: heading[1].trim(), legiarti: heading[2] }
    if (/^```catala/.test(line)) {
      inCode = true
      comments = []
      return
    }
    if (/^```/.test(line)) {
      inCode = false
      return
    }
    if (!inCode) return
    const scope = SCOPE_RE.exec(line)?.[1]
    if (scope) {
      inTest = testScopes.has(scope)
      currentScope = scope
      definition = null
      note = null
      comments = []
      scopeChoice = false
      return
    }
    if (inTest) return
    if (isComment(line)) {
      const text = line.replace(/^\s*#\s?/, '').trim()
      if (/TODO juridique/i.test(text) && /arrondi/i.test(text)) scopeChoice = true
      comments.push(text)
      return
    }
    const def = DEFINITION_RE.exec(line)?.[1]
    if (def) {
      definition = def
      definitionLine = index + 1
      note = comments.length > 0 ? comments.join(' ') : null
    } else if (definition !== null && comments.length > 0) {
      // Un commentaire à l'intérieur d'une définition complète sa note.
      note = [note, ...comments].filter(Boolean).join(' ')
    }
    comments = []
    const explicit = EXPLICIT_RE.test(line)
    // Un résultat décimal (ratio, taux) n'est pas un montant : Catala ne l'arrondit pas au centime.
    const isDecimal = (name: string) => decimalIn(currentScope, name)
    const decimalResult = definition !== null && isDecimal(definition)
    if (!explicit && (decimalResult || !implicitOperation(line, isDecimal))) return
    const choisi =
      (note !== null && /TODO juridique/i.test(note) && /arrondi/i.test(note)) || (explicit && scopeChoice)
    const kind: RoundingKind = choisi ? 'choisi' : explicit ? 'prescrit' : 'implicite'
    const previous = points.at(-1)
    if (previous && definition !== null && previousLine === definitionLine && previous.kind === kind) {
      previous.lines.push(index + 1)
      return
    }
    previousLine = definition !== null ? definitionLine : -1
    points.push({ kind, definition, article, lines: [index + 1], code: line.trim(), note })
  })
  return { file, points }
}

let cached: RoundingFile[] | null = null

/** Fichiers du corpus qui contiennent au moins un point d'arrondi, triés par chemin. */
export function corpusRounding(): RoundingFile[] {
  if (cached) return cached
  const root = resolveCorpusRoot()
  if (!root) return []
  cached = walkCatalaFiles(root)
    .sort()
    .map((rel) => scanRounding(rel, readFileSync(join(root, rel), 'utf8')))
    .filter((entry) => entry.points.length > 0)
  return cached
}
