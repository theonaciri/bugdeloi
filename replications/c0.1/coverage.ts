#!/usr/bin/env bun
import { join } from 'node:path'
import { createDb, type Db, referenceCoverage } from '@bugdeloi/db'
import { and, eq, sql } from 'drizzle-orm'
import { source, sourceCommit, withSource, writeJson } from './source.ts'

const headingPattern = /^ {0,3}(#+)[ \t]+(.+)$/
const articlePattern = /^Article[ \t]+[^|]+\|[ \t]*(LEGIARTI\d{12})(?!\w)/
const fencePattern = /^ {0,3}(`{3,}|~{3,})(.*)$/
const codeItemPattern =
  /^(?:(?:(?:étiquette|label)\s+\S+\s+)?(?:exception(?:\s+\S+)?\s+)?(?:définition|definition|règle|rule|assertion)|déclaration|declaration)(?=\s|$)/u

/** Relevé structurel du Catala lettré (FR/EN). Un bloc fermé `catala` ou `catala-metadata`
 * compte s'il contient une ligne de définition, règle (y compris étiquetée ou en exception),
 * assertion ou déclaration. Un commentaire et un simple en-tête d'utilisation de scope ne
 * comptent pas. Un sous-titre ordinaire conserve l'article courant, tandis qu'un titre de même
 * niveau ou supérieur le ferme. Un nouveau titre d'article prend la priorité sur le précédent.
 */
export function articleHeadings(text: string) {
  const headings: { legiarti: string; line: number; heading: string; formalized: boolean }[] = []
  let article: { level: number; entry: (typeof headings)[number] } | undefined
  let fence: { marker: string; catala: boolean; hasCode: boolean } | undefined
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const marker = fencePattern.exec(raw)
    if (marker?.[1]) {
      if (!fence) {
        const catala = marker[1] === '```' && /^(catala|catala-metadata)\s*$/.test(marker[2] ?? '')
        fence = { marker: marker[1], catala, hasCode: false }
      } else if (
        marker[1][0] === fence.marker[0] &&
        marker[1].length >= fence.marker.length &&
        !marker[2]?.trim()
      ) {
        if (article && fence.hasCode) article.entry.formalized = true
        fence = undefined
      }
      continue
    }
    if (fence) {
      if (fence.catala && codeItemPattern.test(raw.trimStart())) fence.hasCode = true
      continue
    }

    const heading = raw.trimEnd()
    const match = headingPattern.exec(heading)
    if (!match?.[1] || !match[2]) continue
    const level = match[1].length
    if (article && level <= article.level) article = undefined
    const legiarti = articlePattern.exec(match[2])?.[1]
    if (legiarti) {
      const entry = { legiarti, line: index + 1, heading, formalized: false }
      headings.push(entry)
      article = { level, entry }
    }
  }
  return headings
}

type CoverageEntry = typeof referenceCoverage.$inferInsert

export async function collectCoverage(directory: string) {
  const byFolder = new Map<string, { identifiers: Set<string>; rows: number; files: Set<string> }>()
  const entries: CoverageEntry[] = []
  const distinct = new Set<string>()
  const files = Array.from(new Bun.Glob('**/*.catala_{fr,en}').scanSync(directory)).sort()
  for (const file of files) {
    const folder = file.split('/')[0] ?? file
    const totals = byFolder.get(folder) ?? { identifiers: new Set(), rows: 0, files: new Set() }
    byFolder.set(folder, totals)
    const inFile = new Set<string>()
    for (const { formalized, ...heading } of articleHeadings(await Bun.file(join(directory, file)).text())) {
      if (!formalized || inFile.has(heading.legiarti)) continue
      inFile.add(heading.legiarti)
      distinct.add(heading.legiarti)
      totals.identifiers.add(heading.legiarti)
      totals.files.add(file)
      totals.rows++
      entries.push({ source, sourceCommit, file, ...heading })
    }
  }
  const folders = Array.from(byFolder, ([folder, { identifiers, rows, files }]) => ({
    folder,
    distinctLegiarti: identifiers.size,
    rows,
    files: files.size,
  }))
  return {
    entries,
    summary: { source, sourceCommit, distinctLegiarti: distinct.size, rows: entries.length, folders },
  }
}

export async function syncCoverage(tx: Pick<Db, 'insert' | 'delete'>, entries: CoverageEntry[]) {
  const retained = entries.length
    ? sql`(${referenceCoverage.legiarti}, ${referenceCoverage.file}) not in (${sql.join(
        entries.map(({ legiarti, file }) => sql`(${legiarti}, ${file})`),
        sql`, `,
      )})`
    : undefined
  await tx
    .delete(referenceCoverage)
    .where(
      and(eq(referenceCoverage.source, source), eq(referenceCoverage.sourceCommit, sourceCommit), retained),
    )
  if (entries.length === 0) return
  await tx
    .insert(referenceCoverage)
    .values(entries)
    .onConflictDoUpdate({
      target: [referenceCoverage.source, referenceCoverage.legiarti, referenceCoverage.file],
      set: {
        sourceCommit: sql`excluded.source_commit`,
        line: sql`excluded.line`,
        heading: sql`excluded.heading`,
      },
      setWhere: sql`(${referenceCoverage.sourceCommit}, ${referenceCoverage.line}, ${referenceCoverage.heading})
        is distinct from (excluded.source_commit, excluded.line, excluded.heading)`,
    })
}

if (import.meta.main) {
  const { entries, summary } = await withSource(collectCoverage)
  if (process.argv.includes('--dry-run')) {
    console.log(JSON.stringify(summary, null, 2))
  } else {
    const { db, sql: client } = createDb()
    try {
      await db.transaction((tx) => syncCoverage(tx, entries))
      await writeJson('coverage.json', summary)
      console.log(`${summary.distinctLegiarti} LEGIARTI distincts, ${summary.rows} lignes.`)
    } finally {
      await client.end()
    }
  }
}
