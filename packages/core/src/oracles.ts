/**
 * Schéma des cas d'oracle YAML (AGENTS.md §4.3) et générateur de tests Catala `#[test]`.
 *
 * Module pur (sans dépendance à Bun ni à PostgreSQL) : le parseur YAML est fourni par l'appelant
 * (ex. `Bun.YAML.parse`), puis `validateOracleCases` contrôle la structure et `generateOracleCatalaFile`
 * produit un fichier `.catala_fr` autonome exécutable par `clerk test`.
 */

export const ORACLE_SOURCE_KINDS = [
  'bofip_example',
  'brochure_officielle',
  'inria_test',
  'dgfip_m',
  'openfisca_test',
  'derivation_manuelle',
  'llm_blind',
] as const
export type OracleSourceKind = (typeof ORACLE_SOURCE_KINDS)[number]

/** Sources non-LLM éligibles à elles seules pour le seuil N3 (AGENTS.md §4.1). */
export const NON_LLM_ORACLE_KINDS: readonly OracleSourceKind[] = [
  'bofip_example',
  'brochure_officielle',
  'inria_test',
  'dgfip_m',
  'openfisca_test',
]

export type OracleScalar = string | number | boolean

export interface OracleSource {
  kind: OracleSourceKind
  ref: string
  url?: string
  retrieved: string
  legal_units: string[]
}

export interface OracleAuthor {
  handle: string
  role: string
  family: string
  model_declared?: string
}

export interface OracleCase {
  id: string
  interface: string
  module?: string
  source: OracleSource
  author: OracleAuthor
  blind_to: string[]
  inputs: Record<string, OracleScalar>
  expected: Record<string, OracleScalar>
  derivation?: string
}

export interface OracleValidationResult {
  cases: OracleCase[]
  errors: string[]
}

const ID_RE = /^[a-z0-9][a-z0-9._-]*$/i
const INTERFACE_RE = /^(\p{Lu}[\p{L}\p{N}_]*)@(v\d+)$/u
const LEGAL_UNIT_RE = /^(LEGIARTI\d{12})@(\d{4}-\d{2}-\d{2})$/
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isScalar(v: unknown): v is OracleScalar {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
}

function asDateString(v: unknown): string | null {
  if (typeof v === 'string' && ISO_DATE_RE.test(v.trim())) return v.trim()
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10)
  return null
}

/** Valide une liste de cas d'oracle déjà parsée depuis YAML. */
export function validateOracleCases(raw: unknown, fileLabel: string): OracleValidationResult {
  const errors: string[] = []
  const cases: OracleCase[] = []

  const list = Array.isArray(raw) ? raw : isRecord(raw) ? [raw] : null
  if (!list || list.length === 0) {
    return { cases: [], errors: [`${fileLabel} : le fichier YAML doit contenir au moins un cas d'oracle.`] }
  }

  const seenIds = new Set<string>()

  for (let i = 0; i < list.length; i++) {
    const entry = list[i]
    const prefix = `${fileLabel}[${i}]`
    if (!isRecord(entry)) {
      errors.push(`${prefix} : un cas d'oracle doit être un objet YAML.`)
      continue
    }

    const id = typeof entry.id === 'string' ? entry.id.trim() : ''
    if (!ID_RE.test(id)) {
      errors.push(`${prefix} : identifiant \`id\` invalide ou absent.`)
      continue
    }
    if (seenIds.has(id)) {
      errors.push(`${prefix} (${id}) : identifiant en doublon dans le fichier.`)
      continue
    }
    seenIds.add(id)

    const iface = typeof entry.interface === 'string' ? entry.interface.trim() : ''
    if (!INTERFACE_RE.test(iface)) {
      errors.push(`${prefix} (${id}) : \`interface\` doit respecter le format \`Nom@vN\`.`)
      continue
    }

    const mod = typeof entry.module === 'string' && entry.module.trim() ? entry.module.trim() : undefined

    if (!isRecord(entry.source)) {
      errors.push(`${prefix} (${id}) : bloc \`source\` absent.`)
      continue
    }
    const kind = entry.source.kind
    if (typeof kind !== 'string' || !(ORACLE_SOURCE_KINDS as readonly string[]).includes(kind)) {
      errors.push(`${prefix} (${id}) : \`source.kind\` inconnu (${String(kind)}).`)
      continue
    }
    const ref = typeof entry.source.ref === 'string' ? entry.source.ref.trim() : ''
    if (!ref) {
      errors.push(`${prefix} (${id}) : \`source.ref\` obligatoire.`)
      continue
    }
    const retrieved = asDateString(entry.source.retrieved)
    if (!retrieved) {
      errors.push(`${prefix} (${id}) : \`source.retrieved\` doit être une date AAAA-MM-JJ.`)
      continue
    }
    const rawUnits = entry.source.legal_units
    if (!Array.isArray(rawUnits) || rawUnits.length === 0) {
      errors.push(
        `${prefix} (${id}) : \`source.legal_units\` doit lister au moins une unité LEGIARTI@AAAA-MM-JJ.`,
      )
      continue
    }
    const legalUnits: string[] = []
    let badUnit = false
    for (const u of rawUnits) {
      if (typeof u !== 'string' || !LEGAL_UNIT_RE.test(u.trim())) {
        errors.push(`${prefix} (${id}) : unité légale invalide (${String(u)}).`)
        badUnit = true
      } else {
        legalUnits.push(u.trim())
      }
    }
    if (badUnit) continue

    const url =
      typeof entry.source.url === 'string' && entry.source.url.trim() ? entry.source.url.trim() : undefined

    if (!isRecord(entry.author)) {
      errors.push(`${prefix} (${id}) : bloc \`author\` absent.`)
      continue
    }
    const handle = typeof entry.author.handle === 'string' ? entry.author.handle.trim() : ''
    const role = typeof entry.author.role === 'string' ? entry.author.role.trim() : ''
    const family = typeof entry.author.family === 'string' ? entry.author.family.trim() : ''
    if (!handle || !role || !family) {
      errors.push(`${prefix} (${id}) : \`author\` requiert \`handle\`, \`role\` et \`family\`.`)
      continue
    }
    const modelDeclared =
      typeof entry.author.model_declared === 'string' && entry.author.model_declared.trim()
        ? entry.author.model_declared.trim()
        : undefined

    const blindTo = Array.isArray(entry.blind_to)
      ? entry.blind_to.filter((s): s is string => typeof s === 'string')
      : []

    if (!isRecord(entry.inputs) || Object.keys(entry.inputs).length === 0) {
      errors.push(`${prefix} (${id}) : \`inputs\` doit contenir au moins une entrée.`)
      continue
    }
    const inputs: Record<string, OracleScalar> = {}
    let badField = false
    for (const [k, v] of Object.entries(entry.inputs)) {
      if (!isScalar(v)) {
        errors.push(`${prefix} (${id}) : entrée \`${k}\` non scalaire (non prise en charge).`)
        badField = true
      } else {
        inputs[k] = v
      }
    }
    if (badField) continue

    if (!isRecord(entry.expected) || Object.keys(entry.expected).length === 0) {
      errors.push(`${prefix} (${id}) : \`expected\` doit contenir au moins une sortie attendue.`)
      continue
    }
    const expected: Record<string, OracleScalar> = {}
    for (const [k, v] of Object.entries(entry.expected)) {
      if (!isScalar(v)) {
        errors.push(`${prefix} (${id}) : sortie attendue \`${k}\` non scalaire.`)
        badField = true
      } else {
        expected[k] = v
      }
    }
    if (badField) continue

    const derivation =
      typeof entry.derivation === 'string' && entry.derivation.trim() ? entry.derivation.trim() : undefined
    if (kind === 'derivation_manuelle' && !derivation) {
      errors.push(`${prefix} (${id}) : \`derivation\` obligatoire pour \`kind: derivation_manuelle\`.`)
      continue
    }

    cases.push({
      id,
      interface: iface,
      ...(mod ? { module: mod } : {}),
      source: {
        kind: kind as OracleSourceKind,
        ref,
        ...(url ? { url } : {}),
        retrieved,
        legal_units: legalUnits,
      },
      author: {
        handle,
        role,
        family,
        ...(modelDeclared ? { model_declared: modelDeclared } : {}),
      },
      blind_to: blindTo,
      inputs,
      expected,
      ...(derivation ? { derivation } : {}),
    })
  }

  return { cases, errors }
}

/** Extrait les identifiants LEGIARTI d'un cas d'oracle (sans la date de version). */
export function oracleLegiartis(c: OracleCase): string[] {
  return c.source.legal_units.map((u) => LEGAL_UNIT_RE.exec(u)?.[1]).filter((id): id is string => Boolean(id))
}

/** Nom du champ d'application Catala extrait de `Nom@vN`. */
export function interfaceScopeName(iface: string): string | null {
  return INTERFACE_RE.exec(iface)?.[1] ?? null
}

/**
 * Un cas compte comme oracle N3 non-LLM s'il porte le rôle `oracle` (jamais `translate`)
 * et provient d'une source officielle / implémentation de référence, ou d'une dérivation
 * manuelle écrite par un humain.
 */
export function isQualifyingNonLlmOracle(c: OracleCase): boolean {
  if (c.author.role !== 'oracle') return false
  if (NON_LLM_ORACLE_KINDS.includes(c.source.kind)) return true
  return (
    c.source.kind === 'derivation_manuelle' && c.author.family === 'humain' && Boolean(c.derivation?.trim())
  )
}

/** Un cas d'oracle indépendant (non-LLM ou LLM aveugle au rôle `oracle`). */
export function isIndependentOracle(c: OracleCase): boolean {
  return c.author.role === 'oracle'
}

export interface ScopeSchema {
  moduleName: string
  scopeName: string
  inputs: Map<string, string>
  outputs: Map<string, string>
  /** Constructeur d'énumération -> nom de l'énumération (pour qualifier `Module.Enum.Constructeur`). */
  enumConstructors: Map<string, string>
}

/**
 * Lit les déclarations d'un fichier `.catala_fr` (nom de module, types des entrées/sorties
 * d'un champ d'application, constructeurs d'énumération).
 */
export function extractScopeSchema(catalaSource: string, scopeName: string): ScopeSchema | null {
  const modMatch = /^>\s*Module\s+([A-Za-z0-9_]+)\s*$/m.exec(catalaSource)
  if (!modMatch?.[1]) return null
  const moduleName = modMatch[1]

  const blocks = [...catalaSource.matchAll(/```(?:catala-metadata|catala)\n([\s\S]*?)```/g)].map(
    (m) => m[1] ?? '',
  )
  const inputs = new Map<string, string>()
  const outputs = new Map<string, string>()
  const enumConstructors = new Map<string, string>()
  let foundScope = false

  for (const block of blocks) {
    let mode: 'none' | 'scope' | 'enum' = 'none'
    let currentEnum = ''
    for (const rawLine of block.split('\n')) {
      const line = rawLine.replace(/#.*/, '').trimEnd()
      const scopeHead = /^déclaration\s+champ d'application\s+([^\s:]+)\s*:/.exec(line.trim())
      if (scopeHead) {
        mode = scopeHead[1] === scopeName ? 'scope' : 'none'
        if (mode === 'scope') foundScope = true
        continue
      }
      const enumHead = /^déclaration\s+énumération\s+([^\s:]+)\s*:/.exec(line.trim())
      if (enumHead?.[1]) {
        mode = 'enum'
        currentEnum = enumHead[1]
        continue
      }
      if (/^déclaration\s+/.test(line.trim()) || /^champ d'application\s+/.test(line.trim())) {
        mode = 'none'
        continue
      }
      if (mode === 'scope') {
        const m = /^\s+(entrée|résultat)\s+([^\s]+)\s+contenu\s+(.+?)\s*$/.exec(line)
        if (m?.[1] && m[2] && m[3]) {
          if (m[1] === 'entrée') inputs.set(m[2], m[3])
          else outputs.set(m[2], m[3])
        }
      } else if (mode === 'enum' && currentEnum) {
        const m = /^\s+--\s+([^\s:]+)(?:\s+contenu\s+.*)?$/.exec(line)
        if (m?.[1]) enumConstructors.set(m[1], currentEnum)
      }
    }
  }

  if (!foundScope) return null
  return { moduleName, scopeName, inputs, outputs, enumConstructors }
}

/** Formate un montant YAML (`"1200 €"`, `"1 200,50 €"`, `1200`) en littéral Catala `argent`. */
function formatCatalaMoney(value: OracleScalar): string {
  if (typeof value === 'number') {
    const fixed = Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',')
    return `${fixed}€`
  }
  const cleaned = String(value)
    .replace(/€/g, '')
    .replace(/[\s\u00a0\u202f]/g, '')
    .replace('.', ',')
    .trim()
  if (!/^-?\d+(?:,\d{1,2})?$/.test(cleaned)) {
    throw new Error(`Montant Catala invalide : "${String(value)}"`)
  }
  return `${cleaned}€`
}

/** Formate un scalaire YAML en littéral Catala français selon le type déclaré du champ. */
export function formatCatalaLiteral(
  value: OracleScalar,
  typeName: string,
  enumConstructors: Map<string, string>,
  moduleName: string,
): string {
  if (typeName === 'booléen') {
    if (typeof value === 'boolean') return value ? 'vrai' : 'faux'
    if (value === 'vrai' || value === 'true') return 'vrai'
    if (value === 'faux' || value === 'false') return 'faux'
    throw new Error(`Booléen Catala invalide : "${String(value)}"`)
  }
  if (typeName === 'argent') {
    return formatCatalaMoney(value)
  }
  if (typeName === 'entier') {
    const n = typeof value === 'number' ? value : Number(String(value).replace(/[\s\u00a0\u202f]/g, ''))
    if (!Number.isInteger(n)) throw new Error(`Entier Catala invalide : "${String(value)}"`)
    return String(n)
  }
  if (typeName === 'décimal') {
    if (typeof value === 'number') {
      return Number.isInteger(value) ? `${value},0` : String(value).replace('.', ',')
    }
    const s = String(value).trim()
    if (s.endsWith('%')) {
      const pct = s
        .slice(0, -1)
        .replace(/[\s\u00a0\u202f]/g, '')
        .replace('.', ',')
      if (!/^-?\d+(?:,\d+)?$/.test(pct)) throw new Error(`Pourcentage Catala invalide : "${s}"`)
      return `${pct}%`
    }
    const dec = s.replace(/[\s\u00a0\u202f]/g, '').replace('.', ',')
    if (!/^-?\d+(?:,\d+)?$/.test(dec)) throw new Error(`Décimal Catala invalide : "${s}"`)
    return dec.includes(',') ? dec : `${dec},0`
  }
  if (typeName === 'date') {
    const s = String(value).trim()
    if (!ISO_DATE_RE.test(s)) throw new Error(`Date Catala invalide : "${s}"`)
    return `|${s}|`
  }
  // Constructeur d'énumération
  const ctor = String(value).trim()
  const enumName = enumConstructors.get(ctor)
  if (enumName) {
    return `${moduleName}.${enumName}.${ctor}`
  }
  throw new Error(`Valeur "${ctor}" incompatible avec le type Catala "${typeName}"`)
}

function sanitizeScopeId(id: string): string {
  const ascii = id
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return `TestOracle_${ascii || 'Cas'}`
}

/**
 * Génère un fichier `.catala_fr` contenant un scope `#[test]` par cas d'oracle,
 * prêt à être exécuté par `clerk test` contre le module Catala cible.
 */
export function generateOracleCatalaFile(schema: ScopeSchema, cases: OracleCase[]): string {
  const lines: string[] = [
    `> Usage de ${schema.moduleName}`,
    '',
    `# Tests d'oracle générés automatiquement pour ${schema.moduleName}.${schema.scopeName}`,
    '',
    '```catala',
  ]

  const usedNames = new Set<string>()

  for (const c of cases) {
    let testScope = sanitizeScopeId(c.id)
    let suffix = 2
    while (usedNames.has(testScope)) {
      testScope = `${sanitizeScopeId(c.id)}_${suffix++}`
    }
    usedNames.add(testScope)

    lines.push(`# Oracle ${c.id} · source : ${c.source.kind} (${c.source.ref})`)
    lines.push('#[test]')
    lines.push(`déclaration champ d'application ${testScope}:`)
    lines.push(`  c champ d'application ${schema.moduleName}.${schema.scopeName}`)
    lines.push('')
    lines.push(`champ d'application ${testScope}:`)

    for (const [field, val] of Object.entries(c.inputs)) {
      const typeName = schema.inputs.get(field)
      if (!typeName) {
        throw new Error(
          `Oracle ${c.id} : entrée "${field}" absente de ${schema.moduleName}.${schema.scopeName}`,
        )
      }
      const lit = formatCatalaLiteral(val, typeName, schema.enumConstructors, schema.moduleName)
      lines.push(`  définition c.${field} égal à ${lit}`)
    }

    for (const [field, val] of Object.entries(c.expected)) {
      const typeName = schema.outputs.get(field)
      if (!typeName) {
        throw new Error(
          `Oracle ${c.id} : sortie "${field}" absente de ${schema.moduleName}.${schema.scopeName}`,
        )
      }
      const lit = formatCatalaLiteral(val, typeName, schema.enumConstructors, schema.moduleName)
      lines.push(`  assertion c.${field} = ${lit}`)
    }

    lines.push('')
  }

  lines.push('```')
  lines.push('')
  return lines.join('\n')
}
