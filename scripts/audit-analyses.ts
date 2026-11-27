#!/usr/bin/env bun
/**
 * Audit et resynchronisation des fiches d'analyse (`corpus/analyses/*.md`) :
 * - Liste les fiches v2 avec bloc `catala` figé vs les fiches v1 traduisibles sans bloc `catala`.
 * - Repère les articles N2 dont la fiche d'analyse est encore en v1 ou absente.
 * - Avec `--upgrade-n2`, crée les fiches `<LEGIARTI>.v2.md` à partir de la v1 et des déclarations
 *   Catala déjà compilées au niveau N2, et met à jour la citation `Interface \`Nom@v2\`` du fichier.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const workdir = 'corpus'
const analysesDir = join(workdir, 'analyses')
const upgradeN2 = process.argv.includes('--upgrade-n2')
const asJson = process.argv.includes('--json')

function extractPublicDeclarations(raw: string): { scopeName: string; block: string } | null {
  const blocks = [...raw.matchAll(/```(?:catala-metadata|catala)\n([\s\S]*?)```/g)].map((m) => m[1] ?? '')
  const lines: string[] = []
  let primaryScope: string | null = null

  for (const block of blocks) {
    let keep = false
    let isScope = false
    for (const rawLine of block.split('\n')) {
      const line = rawLine.replace(/#.*/, '').trimEnd()
      const trimmed = line.trim()
      const declMatch = /^déclaration\s+(structure|énumération|champ d'application)\s+([^\s:]+)\s*:/.exec(
        trimmed,
      )
      if (declMatch) {
        const kind = declMatch[1]
        const name = declMatch[2] ?? ''
        if (kind === "champ d'application" && name.startsWith('Test')) {
          keep = false
          continue
        }
        if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('')
        keep = true
        isScope = kind === "champ d'application"
        if (isScope && !primaryScope) primaryScope = name
        lines.push(trimmed)
        continue
      }
      if (/^champ d'application\s+/.test(trimmed) || /^#\[test\]/.test(trimmed)) {
        keep = false
        continue
      }
      if (keep && /^\s+\S/.test(line)) {
        if (isScope && /^\s+interne\s+/.test(line)) continue
        lines.push(`  ${trimmed}`)
      }
    }
  }
  if (!primaryScope) return null
  return { scopeName: primaryScope, block: lines.join('\n').trim() }
}

function runAudit() {
  const analysisFiles = readdirSync(analysesDir).sort()
  const latestById = new Map<string, { file: string; version: number }>()
  for (const file of analysisFiles) {
    const m = /^(LEGIARTI\d{12})(?:\.v(\d+))?\.md$/.exec(file)
    if (!m?.[1]) continue
    const version = m[2] ? Number(m[2]) : 1
    const prev = latestById.get(m[1])
    if (!prev || version > prev.version) latestById.set(m[1], { file, version })
  }

  let v2WithBlock = 0
  let v1WithoutBlock = 0
  let v1WithBlock = 0

  for (const [, info] of latestById) {
    const content = readFileSync(join(analysesDir, info.file), 'utf8')
    const section = content.split(/^##\s+Interface[^\n]*\n/im)[1]?.split(/^##\s+/m)[0] ?? ''
    const hasBlock = /```catala\n/.test(section)
    if (info.version >= 2 && hasBlock) v2WithBlock++
    else if (hasBlock) v1WithBlock++
    else v1WithoutBlock++
  }

  const catalaFiles = Array.from(new Bun.Glob('**/*.catala_fr').scanSync({ cwd: workdir }))
    .filter((f) => !f.startsWith('interfaces/'))
    .sort()

  const n2V1: { id: string; catalaFile: string; analysisFile: string }[] = []
  const n2NoAnalysis: { id: string; catalaFile: string }[] = []
  const n2V2: string[] = []

  for (const file of catalaFiles) {
    const raw = readFileSync(join(workdir, file), 'utf8')
    for (const m of raw.matchAll(/^#{1,6}\s+.*\|(LEGIARTI\d{12})\s*$/gm)) {
      const id = m[1]
      if (!id) continue
      const latest = latestById.get(id)
      if (!latest) {
        n2NoAnalysis.push({ id, catalaFile: file })
      } else if (latest.version >= 2) {
        n2V2.push(id)
      } else {
        n2V1.push({ id, catalaFile: file, analysisFile: latest.file })
      }
    }
  }

  const upgraded: string[] = []
  if (upgradeN2) {
    for (const item of n2V1) {
      const catalaPath = join(workdir, item.catalaFile)
      const catalaRaw = readFileSync(catalaPath, 'utf8')
      const pub = extractPublicDeclarations(catalaRaw)
      if (!pub) {
        console.error(`[SKIP] Impossible d'extraire les déclarations de ${item.catalaFile}`)
        continue
      }
      const v1Path = join(analysesDir, item.analysisFile)
      const v1Raw = readFileSync(v1Path, 'utf8')
      const beforeInterface = v1Raw.split(/^##\s+Interface[^\n]*\n/im)[0]?.trimEnd() ?? ''
      const afterInterfaceParts = v1Raw.split(/^##\s+Interface[^\n]*\n/im)[1] ?? ''
      const restSectionsMatch = /\n(##\s+[\s\S]*)$/.exec(afterInterfaceParts)
      const restSections = restSectionsMatch?.[1]?.trim() ?? ''

      const v2Content = [
        beforeInterface,
        '',
        '## Interface proposée',
        '',
        `\`${pub.scopeName}@v2\`, qui remplace \`${pub.scopeName}@v1\` ([fiche v1](./${item.id}.md)). Les règles et le classement ne changent pas. La v2 fige exactement la déclaration Catala ci-dessous, celle de la traduction déjà au niveau N2 (\`${item.catalaFile}\`). La déclaration est contractuelle : une traduction la recopie à l’identique, avec ses seules variables \`interne\` en plus, et un cas d’oracle en reprend les noms et les types.`,
        '',
        '```catala',
        pub.block,
        '```',
        '',
        restSections,
        '',
      ].join('\n')

      const v2Path = join(analysesDir, `${item.id}.v2.md`)
      if (!existsSync(v2Path)) {
        writeFileSync(v2Path, v2Content, 'utf8')
      }

      // Met à jour la citation `Interface \`Nom@v1\`` -> `Interface \`Nom@v2\`` dans le fichier Catala
      const oldIfaceRe = new RegExp(`Interface \`${pub.scopeName}@v1\``)
      if (oldIfaceRe.test(catalaRaw)) {
        writeFileSync(catalaPath, catalaRaw.replace(oldIfaceRe, `Interface \`${pub.scopeName}@v2\``), 'utf8')
      } else if (!new RegExp(`Interface \`${pub.scopeName}@v2\``).test(catalaRaw)) {
        // Insère la ligne Interface juste avant le premier bloc ```catala si absente
        const updated = catalaRaw.replace(
          /```catala\n/,
          `Interface \`${pub.scopeName}@v2\`.\n\n\`\`\`catala\n`,
        )
        writeFileSync(catalaPath, updated, 'utf8')
      }
      upgraded.push(item.id)
    }
  }

  const summary = {
    totalUniqueAnalyses: latestById.size,
    v2WithBlock,
    v1WithBlock,
    v1WithoutBlock,
    n2Total: n2V2.length + n2V1.length + n2NoAnalysis.length,
    n2WithV2: n2V2.length,
    n2OnlyV1: n2V1.length,
    n2NoAnalysis: n2NoAnalysis.length,
    upgraded,
  }

  if (asJson) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    console.log(
      `[AUDIT ANALYSES] ${summary.totalUniqueAnalyses} articles analysés : ${summary.v2WithBlock} v2 figées, ${summary.v1WithoutBlock} v1 sans bloc Catala.`,
    )
    console.log(
      `  Articles N2/N3 (${summary.n2Total}) : ${summary.n2WithV2} avec v2, ${summary.n2OnlyV1} encore en v1, ${summary.n2NoAnalysis} sans fiche d'analyse.`,
    )
    if (upgraded.length > 0) {
      console.log(`  [UPGRADE N2] ${upgraded.length} fiches v2 créées : ${upgraded.join(', ')}`)
    }
  }
}

runAudit()
