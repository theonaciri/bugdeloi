#!/usr/bin/env bun
import { join } from 'node:path'
import { createDb, referenceCoverage } from '@bugdeloi/db'
import { sql } from 'drizzle-orm'
import { source, sourceCommit, withSource, writeJson } from './source.ts'

const headingPattern = /^#+[ \t]+Article[ \t]+[^|]+\|[ \t]*(LEGIARTI\d{12})(?!\w)/

export function articleHeadings(text: string) {
  const headings = []
  let fence: string | undefined
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(raw)
    if (marker?.[1]) {
      if (!fence) fence = marker[1]
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2]?.trim()) {
        fence = undefined
      }
      continue
    }
    if (fence) continue
    const heading = raw.trimEnd()
    const legiarti = headingPattern.exec(heading)?.[1]
    if (legiarti) headings.push({ legiarti, line: index + 1, heading })
  }
  return headings
}

async function collect(directory: string) {
  const mentions = new Map<string, { identifiers: Set<string>; rows: number; files: Set<string> }>()
  const entries: (typeof referenceCoverage.$inferInsert)[] = []
  const distinct = new Set<string>()
  const files = Array.from(new Bun.Glob('**/*.catala_{fr,en}').scanSync(directory)).sort()
  for (const file of files) {
    const folder = file.split('/')[0] ?? file
    const totals = mentions.get(folder) ?? { identifiers: new Set(), rows: 0, files: new Set() }
    mentions.set(folder, totals)
    const inFile = new Set<string>()
    for (const heading of articleHeadings(await Bun.file(join(directory, file)).text())) {
      if (inFile.has(heading.legiarti)) continue
      inFile.add(heading.legiarti)
      distinct.add(heading.legiarti)
      totals.identifiers.add(heading.legiarti)
      totals.files.add(file)
      totals.rows++
      entries.push({ source, sourceCommit, file, ...heading })
    }
  }
  const folders = Array.from(mentions, ([folder, { identifiers, rows, files }]) => ({
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

if (import.meta.main) {
  const { entries, summary } = await withSource(collect)
  const { db, sql: client } = createDb()
  try {
    await db
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
    await writeJson('coverage.json', summary)
    console.log(`${summary.distinctLegiarti} LEGIARTI distincts, ${summary.rows} lignes.`)
  } finally {
    await client.end()
  }
}
