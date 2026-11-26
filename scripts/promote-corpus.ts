#!/usr/bin/env bun
/**
 * Chaîne mécanique de promotion du corpus Catala (`corpus/`):
 * - N1 Ancré : vérifie que le titre `#### Article …|LEGIARTI…` correspond à un article en vigueur
 *   en base LEGI, que le texte officiel est présent verbatim (normalisé) et qu'au moins un bloc
 *   ```catala contient une déclaration/définition/règle.
 * - N2 Compilé : exécute `clerk test` dans le bac à sable Catala 1.3.2 épinglé sans réseau.
 * - Promotion : met à jour `article_status` au niveau `N2` et publie un événement dans `event`
 *   (diffusé en direct via PostgreSQL LISTEN/NOTIFY -> SSE).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { and, eq, inArray } from '../packages/db/node_modules/drizzle-orm'
import {
  articleInForce,
  articleStatus,
  createDb,
  event,
  legalArticle,
  legalText,
} from '../packages/db/src/index.ts'
import { runInSandbox } from '../packages/runner/src/index.ts'

const checkOnly = process.argv.includes('--check-only')
const workdir = 'corpus'
const files = Array.from(new Bun.Glob('**/*.catala_fr').scanSync({ cwd: workdir })).sort()

if (files.length === 0) {
  console.error('Aucun fichier .catala_fr trouvé dans corpus/.')
  process.exit(1)
}

function normalize(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

interface ParsedFile {
  file: string
  legiarti: string
  prose: string
  hasCatalaCode: boolean
}

const parsed: ParsedFile[] = []
const seenLegiarti = new Map<string, string>()
const seenSymbols = new Map<string, string>()
const declRe = /^\s*déclaration\s+(structure|énumération|champ d'application)\s+([^\s:]+)\s*:/gm

for (const file of files) {
  const raw = readFileSync(join(workdir, file), 'utf8')
  const headings = [...raw.matchAll(/^#{1,6}\s+.*\|(LEGIARTI\d+)\s*$/gm)].map((m) => m[1]).filter(Boolean)
  if (headings.length === 0) {
    console.error(`[N1 ECHEC] En-tête LEGIARTI introuvable dans ${file}`)
    process.exit(1)
  }
  const codeBlocks = [...raw.matchAll(/```catala\n([\s\S]*?)```/g)].map((m) => m[1] ?? '')
  const hasCatalaCode = codeBlocks.some((b) =>
    /\b(déclaration|champ d'application|définition|règle|assertion)\b/.test(b),
  )
  if (!hasCatalaCode) {
    console.error(`[N1 ECHEC] Aucun bloc Catala formalisé dans ${file}`)
    process.exit(1)
  }

  for (const block of codeBlocks) {
    for (const match of block.matchAll(declRe)) {
      const kind = match[1]
      const name = match[2]
      if (!kind || !name || name.startsWith('Test')) continue
      const key = `${kind} ${name}`
      const prev = seenSymbols.get(key)
      if (prev && prev !== file) {
        console.error(`[N1 DOUBLON] "${key}" est déjà défini dans ${prev} et redéfini dans ${file}.`)
        process.exit(1)
      }
      seenSymbols.set(key, file)
    }
  }

  const prose = raw.replace(/```catala[\s\S]*?```/g, ' ')
  for (const legiarti of headings) {
    const prev = seenLegiarti.get(legiarti)
    if (prev && prev !== file) {
      console.error(`[N1 DOUBLON] ${legiarti} est déjà formalisé dans ${prev} et redéfini dans ${file}.`)
      process.exit(1)
    }
    seenLegiarti.set(legiarti, file)
    parsed.push({ file, legiarti, prose, hasCatalaCode })
  }
}

console.log(
  `[N1] Anti-doublon OK : ${seenLegiarti.size} LEGIARTI uniques et ${seenSymbols.size} déclarations Catala uniques.`,
)

// 1. Contrôle N2 : clerk test dans le bac à sable Catala 1.3.2 épinglé
console.log(`[N2] Exécution de clerk test sur ${files.length} fichier(s) dans le bac à sable Catala 1.3.2…`)
const sandbox = await runInSandbox({
  workdir,
  command: ['clerk', 'test', '--color=never', ...files],
  timeoutMs: 60_000,
  memoryMb: 1536,
  cpus: 2,
  network: false,
})
process.stdout.write(sandbox.stdout)
process.stderr.write(sandbox.stderr)
if (sandbox.exitCode !== 0) {
  console.error(`[N2 ECHEC] clerk test a échoué (code ${sandbox.exitCode}).`)
  process.exit(sandbox.exitCode || 1)
}

// 2. Contrôle N1 contre la base LEGI locale + promotion en N2
const { db, sql: client } = createDb()
try {
  const ids = parsed.map((p) => p.legiarti)
  const rows = await db
    .select({
      id: legalArticle.id,
      num: legalArticle.num,
      code: legalText.shortTitle,
      contentText: legalArticle.contentText,
    })
    .from(legalArticle)
    .innerJoin(legalText, eq(legalText.id, legalArticle.textId))
    .where(and(inArray(legalArticle.id, ids), articleInForce()))

  const byId = new Map(rows.map((r) => [r.id, r]))
  const promoted: { id: string; code: string; num: string; file: string }[] = []

  for (const item of parsed) {
    const dbRow = byId.get(item.legiarti)
    if (!dbRow) {
      console.error(`[N1 ECHEC] ${item.legiarti} (${item.file}) introuvable ou non en vigueur en base LEGI.`)
      process.exit(1)
    }
    const normDb = normalize(dbRow.contentText)
    const normFile = normalize(item.prose)
    if (!normFile.includes(normDb)) {
      console.error(
        `[N1 ECHEC] Le texte verbatim de ${item.legiarti} (${item.file}) ne correspond pas à LEGI.`,
      )
      process.exit(1)
    }
    promoted.push({ id: dbRow.id, code: dbRow.code, num: dbRow.num ?? '', file: item.file })
  }

  if (checkOnly) {
    console.log(
      `\n[OK --check-only] ${promoted.length} articles vérifiés (N1 anti-doublon + verbatim LEGI + N2 clerk test).`,
    )
    process.exit(0)
  }

  const now = new Date()
  await db.transaction(async (tx) => {
    for (const art of promoted) {
      const evidence = {
        corpus: {
          file: `corpus/${art.file}`,
          legiarti: art.id,
          n1_anchor: true,
          n2_clerk_test: 'passed',
          verified_at: now.toISOString(),
        },
      }
      await tx
        .insert(articleStatus)
        .values({
          articleId: art.id,
          level: 'N2',
          contested: false,
          evidence,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: articleStatus.articleId,
          set: {
            level: 'N2',
            evidence,
            updatedAt: now,
          },
        })
    }

    await tx.insert(event).values({
      type: 'article_promoted',
      actor: 'system:corpus',
      summary: `${promoted.length} articles promus au niveau N2 Compilé (${promoted.map((p) => `${p.code} ${p.num}`).join(', ')})`,
      payload: {
        level: 'N2',
        count: promoted.length,
        articles: promoted,
      },
    })
  })

  console.log(`\n[OK] ${promoted.length} articles vérifiés (N1 + N2) et promus au niveau N2 en base :`)
  for (const art of promoted) {
    console.log(`  - ${art.code} ${art.num} (${art.id}) -> corpus/${art.file}`)
  }
} finally {
  await client.end({ timeout: 5 })
}
