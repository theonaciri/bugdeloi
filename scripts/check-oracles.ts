#!/usr/bin/env bun
/**
 * Contrôle N3 des cas d'oracle (`corpus/oracles/<module>/<suite>.yaml`) :
 * 1. Valide le schéma YAML de chaque fichier d'oracle (AGENTS.md §4.3).
 * 2. Génère des tests Catala `#[test]` pour tous les cas indépendants (`author.role === 'oracle'`)
 *    dans une copie temporaire de `corpus/`.
 * 3. Exécute `clerk test --color=never` dans le bac à sable Catala 1.3.2 épinglé sans réseau.
 * 4. Retourne la liste des `LEGIARTI` éligibles au niveau N3 Testé : tous leurs cas d'oracle
 *    passent et au moins un cas provient d'une source non-LLM (AGENTS.md §4.1).
 */
import { chmodSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  extractScopeSchema,
  generateOracleCatalaFile,
  interfaceScopeName,
  isIndependentOracle,
  isQualifyingNonLlmOracle,
  type OracleCase,
  oracleLegiartis,
  type ScopeSchema,
  validateOracleCases,
} from '../packages/core/src/oracles.ts'
import { runInSandbox } from '../packages/runner/src/index.ts'

export interface OracleN3Article {
  legiarti: string
  oracleFiles: string[]
  totalCases: number
  nonLlmCases: number
  sources: string[]
}

export interface OracleCheckResult {
  ok: boolean
  errors: string[]
  totalFiles: number
  totalCases: number
  executedCases: number
  eligibleN3: OracleN3Article[]
}

/** Indexe tous les modules/scopes Catala de `corpus/`. */
function indexCorpusSchemas(workdir: string): {
  byModuleScope: Map<string, ScopeSchema>
  byScope: Map<string, ScopeSchema[]>
} {
  const byModuleScope = new Map<string, ScopeSchema>()
  const byScope = new Map<string, ScopeSchema[]>()
  const files = Array.from(new Bun.Glob('**/*.catala_fr').scanSync({ cwd: workdir })).sort()

  for (const file of files) {
    const raw = readFileSync(join(workdir, file), 'utf8')
    const scopeMatches = [...raw.matchAll(/déclaration\s+champ d'application\s+([^\s:]+)\s*:/g)]
    for (const m of scopeMatches) {
      const scopeName = m[1]
      if (!scopeName || scopeName.startsWith('Test')) continue
      const schema = extractScopeSchema(raw, scopeName)
      if (!schema) continue
      byModuleScope.set(`${schema.moduleName}.${schema.scopeName}`, schema)
      const list = byScope.get(schema.scopeName) ?? []
      if (!list.some((s) => s.moduleName === schema.moduleName)) list.push(schema)
      byScope.set(schema.scopeName, list)
    }
  }
  return { byModuleScope, byScope }
}

export async function runOracleChecks(workdir = 'corpus'): Promise<OracleCheckResult> {
  const errors: string[] = []
  const oracleFiles = Array.from(new Bun.Glob('oracles/**/*.yaml').scanSync({ cwd: workdir })).sort()

  if (oracleFiles.length === 0) {
    return { ok: true, errors: [], totalFiles: 0, totalCases: 0, executedCases: 0, eligibleN3: [] }
  }

  const allCases: { file: string; entry: OracleCase }[] = []
  const globalIds = new Set<string>()

  for (const rel of oracleFiles) {
    const rawText = readFileSync(join(workdir, rel), 'utf8')
    let parsed: unknown
    try {
      parsed = Bun.YAML.parse(rawText)
    } catch (e) {
      errors.push(`${rel} : YAML illisible (${e instanceof Error ? e.message : String(e)})`)
      continue
    }
    const validated = validateOracleCases(parsed, rel)
    errors.push(...validated.errors)
    for (const entry of validated.cases) {
      if (globalIds.has(entry.id)) {
        errors.push(`${rel} (${entry.id}) : identifiant déjà utilisé dans un autre fichier d'oracle.`)
      } else {
        globalIds.add(entry.id)
        allCases.push({ file: rel, entry })
      }
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      totalFiles: oracleFiles.length,
      totalCases: allCases.length,
      executedCases: 0,
      eligibleN3: [],
    }
  }

  // Seuls les cas avec `author.role === 'oracle'` participent au contrôle N3 (les fixtures
  // rédigées par `translate` sont validées sur le schéma mais ne peuvent pas faire monter N3).
  const independent = allCases.filter((item) => isIndependentOracle(item.entry))
  if (independent.length === 0) {
    return {
      ok: true,
      errors: [],
      totalFiles: oracleFiles.length,
      totalCases: allCases.length,
      executedCases: 0,
      eligibleN3: [],
    }
  }

  const { byModuleScope, byScope } = indexCorpusSchemas(workdir)
  const grouped = new Map<string, { schema: ScopeSchema; items: { file: string; entry: OracleCase }[] }>()

  for (const item of independent) {
    const scopeName = interfaceScopeName(item.entry.interface)
    if (!scopeName) {
      errors.push(`${item.file} (${item.entry.id}) : interface invalide (${item.entry.interface}).`)
      continue
    }
    let schema: ScopeSchema | undefined
    if (item.entry.module) {
      schema = byModuleScope.get(`${item.entry.module}.${scopeName}`)
    } else {
      const candidates = byScope.get(scopeName) ?? []
      if (candidates.length === 1) schema = candidates[0]
      else if (candidates.length > 1) {
        errors.push(
          `${item.file} (${item.entry.id}) : plusieurs modules déclarent ${scopeName} ; renseigner le champ \`module\`.`,
        )
        continue
      }
    }
    if (!schema) {
      errors.push(
        `${item.file} (${item.entry.id}) : champ d'application ${item.entry.module ? `${item.entry.module}.` : ''}${scopeName} introuvable dans corpus/.`,
      )
      continue
    }
    const key = `${schema.moduleName}.${schema.scopeName}`
    const bucket = grouped.get(key) ?? { schema, items: [] }
    bucket.items.push(item)
    grouped.set(key, bucket)
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      totalFiles: oracleFiles.length,
      totalCases: allCases.length,
      executedCases: 0,
      eligibleN3: [],
    }
  }

  // Copie temporaire de `corpus/` pour exécuter les tests générés sans jamais salir le dépôt.
  const tmpDir = mkdtempSync(join(tmpdir(), 'bugdeloi-oracles-'))
  chmodSync(tmpDir, 0o755)
  try {
    cpSync(workdir, tmpDir, { recursive: true })
    const generatedFiles: string[] = []
    let idx = 0

    for (const [key, { schema, items }] of grouped) {
      let catalaText: string
      try {
        catalaText = generateOracleCatalaFile(
          schema,
          items.map((i) => i.entry),
        )
      } catch (e) {
        errors.push(`Génération Catala (${key}) : ${e instanceof Error ? e.message : String(e)}`)
        continue
      }
      const relOut = `oracles_generated_${idx++}_${schema.moduleName.toLowerCase()}.catala_fr`
      writeFileSync(join(tmpDir, relOut), catalaText, 'utf8')
      generatedFiles.push(relOut)
    }

    if (errors.length > 0) {
      return {
        ok: false,
        errors,
        totalFiles: oracleFiles.length,
        totalCases: allCases.length,
        executedCases: 0,
        eligibleN3: [],
      }
    }

    const sandbox = await runInSandbox({
      workdir: tmpDir,
      command: ['clerk', 'test', '-I', '.', '--color=never', ...generatedFiles],
      timeoutMs: 60_000,
      memoryMb: 1536,
      cpus: 2,
      network: false,
    })

    if (sandbox.exitCode !== 0) {
      errors.push(
        `clerk test sur les oracles a échoué (code ${sandbox.exitCode}) :\n${sandbox.stdout}${sandbox.stderr}`.trim(),
      )
      return {
        ok: false,
        errors,
        totalFiles: oracleFiles.length,
        totalCases: allCases.length,
        executedCases: independent.length,
        eligibleN3: [],
      }
    }

    // Agrégation par LEGIARTI : éligible N3 si ≥ 1 oracle non-LLM et 100 % des oracles réussis.
    const byLegiarti = new Map<
      string,
      { files: Set<string>; total: number; nonLlm: number; sources: Set<string> }
    >()
    for (const { file, entry } of independent) {
      const nonLlm = isQualifyingNonLlmOracle(entry)
      for (const legiarti of oracleLegiartis(entry)) {
        const agg = byLegiarti.get(legiarti) ?? {
          files: new Set<string>(),
          total: 0,
          nonLlm: 0,
          sources: new Set<string>(),
        }
        agg.files.add(`corpus/${file}`)
        agg.total += 1
        if (nonLlm) agg.nonLlm += 1
        agg.sources.add(entry.source.kind)
        byLegiarti.set(legiarti, agg)
      }
    }

    const eligibleN3: OracleN3Article[] = [...byLegiarti.entries()]
      .filter(([, agg]) => agg.nonLlm >= 1)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([legiarti, agg]) => ({
        legiarti,
        oracleFiles: [...agg.files].sort(),
        totalCases: agg.total,
        nonLlmCases: agg.nonLlm,
        sources: [...agg.sources].sort(),
      }))

    return {
      ok: true,
      errors: [],
      totalFiles: oracleFiles.length,
      totalCases: allCases.length,
      executedCases: independent.length,
      eligibleN3,
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  const asJson = process.argv.includes('--json')
  const result = await runOracleChecks('corpus')
  if (asJson) {
    console.log(JSON.stringify(result, null, 2))
  } else if (!result.ok) {
    for (const err of result.errors) console.error(`[N3 ECHEC] ${err}`)
  } else {
    console.log(
      `[N3 ORACLES OK] ${result.totalFiles} fichier(s), ${result.executedCases}/${result.totalCases} cas exécutés dans Catala 1.3.2, ${result.eligibleN3.length} article(s) éligibles N3 :`,
    )
    for (const art of result.eligibleN3) {
      console.log(
        `  - ${art.legiarti} : ${art.totalCases} cas (${art.nonLlmCases} non-LLM · ${art.sources.join(', ')})`,
      )
    }
  }
  if (!result.ok) process.exit(1)
}
