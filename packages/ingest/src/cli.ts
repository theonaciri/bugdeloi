import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { CODES } from '@bugdeloi/core'
import type { Db } from '@bugdeloi/db'
import {
  type Archive,
  archiveFromName,
  type Code,
  type CodeFiles,
  documentPath,
  emptyCodeFiles,
  isDeleted,
  listArchives,
  openArchive,
  readArchive,
} from './archive.ts'
import {
  type ArchiveInput,
  applyCode,
  describeError,
  journalArchive,
  readStates,
  withIngestDatabase,
} from './database.ts'
import { projectTree, type Summary, summarize } from './project.ts'
import { parseDate } from './xml.ts'

const usage =
  'bun packages/ingest/src/cli.ts legi [--codes CGI,CSS,CCH] [--date YYYY-MM-DD] [--archive <chemin>] [--incremental] [--dry-run] [--reproject]'
const codeNames = Object.keys(CODES) as Code[]

function argumentsFrom(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      codes: { type: 'string' },
      date: { type: 'string' },
      archive: { type: 'string' },
      incremental: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      reproject: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  })
  if (values.help) return null
  if (positionals.length !== 1 || positionals[0] !== 'legi') throw new Error(usage)
  const codes = values.codes === undefined ? codeNames : [...new Set(values.codes.split(','))]
  if (codes.some((code) => !Object.hasOwn(CODES, code))) throw new Error('Codes admis : CGI,CSS,CCH')
  const asOf = parseDate(values.date ?? new Date().toISOString().slice(0, 10))
  if (!asOf) throw new Error('Date de projection attendue')
  const archive = values.archive
    ? { ...archiveFromName(values.archive), path: resolve(values.archive) }
    : undefined
  if (archive?.kind === 'increment' && !values.incremental)
    throw new Error('Archive LEGI_* : ajouter --incremental')
  return {
    codes: codes as Code[],
    asOf,
    archive,
    incremental: values.incremental,
    dryRun: values['dry-run'],
    reproject: values.reproject,
  }
}

type Options = NonNullable<ReturnType<typeof argumentsFrom>>

async function archivePlan(options: Options): Promise<Archive[]> {
  if (options.archive && (!options.incremental || options.archive.kind === 'increment')) {
    return [options.archive]
  }
  const available = await listArchives()
  const newest = available.findLast((archive) => archive.kind === 'global')
  const global = options.archive ?? newest
  if (!global) throw new Error('Aucun stock global dans le catalogue DILA')
  if (!options.incremental) return [global]
  if (newest && global.stamp < newest.stamp) {
    throw new Error(
      `Les incréments de ce stock ont quitté le catalogue DILA ; stock disponible : ${newest.name}`,
    )
  }
  return [
    global,
    ...available.filter((archive) => archive.kind === 'increment' && archive.stamp > global.stamp),
  ]
}

function statFields(code: Code, summary: Summary): Record<string, number> {
  const { links, ...counts } = summary
  return Object.fromEntries([
    ...Object.entries(counts).map(([name, n]) => [`${code}.${name}`, n]),
    ...Object.entries(links).map(([name, n]) => [`${code}.link.${name}`, n]),
  ])
}

function logSummary(code: Code, result: Summary) {
  console.log(
    `${code} · ${result.active} articles en vigueur, ${result.versions} versions, ${result.sections} sections, profondeur ${result.depth}`,
  )
  console.log(
    `  ${result.unplaced} articles en vigueur hors arbre, ${result.rootArticles} à la racine, ${result.missingSections + result.missingArticles} références actives sans XML, ${result.duplicatePlacements} placements répétés`,
  )
  logLinkTypes(result.links)
}

function logLinkTypes(counts: Record<string, number>) {
  const links = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))
  console.log(`  Liens : ${links.map(([type, n]) => `${type}=${n}`).join(', ') || 'aucun'}`)
}

async function writeArchive(
  db: Db,
  codes: Code[],
  archive: Archive,
  asOf: string,
  previousSha256?: string,
): Promise<Map<Code, Summary>> {
  const scope = codes.map((code) => CODES[code].id)
  return journalArchive(db, { archive, asOf, scope }, async (runId, recordHash) => {
    const { path, sha256 } = previousSha256
      ? { sha256: previousSha256, path: undefined }
      : await openArchive(archive)
    await recordHash(sha256)
    if (path) console.log(`  SHA-256 ${sha256}`)
    const stageDir = path && (await mkdtemp(join(tmpdir(), 'bugdeloi-legi-')))
    try {
      const selected = path
        ? await readArchive(path, codes, console.log, stageDir)
        : new Map<string, CodeFiles>()
      const input: ArchiveInput = { archive, asOf, sha256 }
      const result = new Map<Code, Summary>()
      for (const code of codes) {
        console.log(`  ${code} · transaction et projection au ${asOf}`)
        const id = CODES[code].id
        result.set(code, await applyCode(db, id, selected.get(id) ?? emptyCodeFiles(), input, runId))
      }
      const stats = Object.assign({}, ...[...result].map(([code, summary]) => statFields(code, summary)))
      return { result, stats }
    } finally {
      if (stageDir) await rm(stageDir, { recursive: true, force: true })
    }
  })
}

async function applyPlan(db: Db, options: Options, plan: Archive[]) {
  const states = new Map(
    (
      await readStates(
        db,
        options.codes.map((code) => CODES[code].id),
      )
    ).map((state) => [state.textId, state]),
  )
  if (options.archive && plan.length === 1) {
    for (const code of options.codes) {
      const state = states.get(CODES[code].id)
      if (state && archiveFromName(state.archive).stamp > options.archive.stamp) {
        throw new Error(`${code} : lot demandé antérieur au dernier lot appliqué (${state.archive})`)
      }
      if (!state && options.archive.kind === 'increment') {
        throw new Error(`${code} : aucun stock initial pour appliquer l’incrément demandé`)
      }
    }
  }
  const results = new Map<Code, Summary>()
  for (const archive of plan) {
    const codes = options.codes.filter((code) => {
      const state = states.get(CODES[code].id)
      if (!state) return true
      const previous = archiveFromName(state.archive)
      // Une demande locale explicite peut contrôler l'empreinte du dernier lot appliqué.
      return previous.stamp < archive.stamp || (archive.path !== undefined && previous.name === archive.name)
    })
    if (!codes.length) continue
    console.log(`DILA · ${archive.name}`)
    const written = await writeArchive(db, codes, archive, options.asOf)
    for (const [code, result] of written) results.set(code, result)
  }

  // Sans nouveau lot, recalculer au besoin l'arbre à partir du dernier état de chaque code.
  for (const code of options.codes) {
    if (results.has(code)) continue
    const state = states.get(CODES[code].id)
    if (!state) throw new Error(`Aucun état LEGI pour ${code}`)
    const archive = archiveFromName(state.archive)
    console.log(`DILA · ${code} déjà à ${state.archive}`)
    const result =
      state.asOf === options.asOf
        ? await applyCode(
            db,
            CODES[code].id,
            emptyCodeFiles(),
            {
              archive,
              sha256: state.archiveSha256,
              asOf: options.asOf,
              reproject: options.reproject === true,
            },
            0,
          )
        : (await writeArchive(db, [code], archive, options.asOf, state.archiveSha256)).get(code)
    if (result) results.set(code, result)
  }
  return results
}

function mergePreview(base: CodeFiles, delta: CodeFiles, textId: string) {
  if (delta.text) base.text = delta.text
  else if (isDeleted(delta, documentPath(textId, 'text'))) delete base.text
  for (const id of base.articles.keys()) {
    if (isDeleted(delta, documentPath(id, 'article'))) base.articles.delete(id)
  }
  for (const id of base.structures.keys()) {
    if (isDeleted(delta, documentPath(id, 'structure'))) base.structures.delete(id)
  }
  for (const [id, item] of delta.articles) base.articles.set(id, item)
  for (const [id, item] of delta.structures) base.structures.set(id, item)
}

async function dryRun(options: Options, plan: Archive[]) {
  let corpus: Map<string, CodeFiles> | undefined
  for (const archive of plan) {
    console.log(`DILA · ${archive.name} · simulation`)
    const { path, sha256 } = await openArchive(archive)
    console.log(`  SHA-256 ${sha256}`)
    const selected = await readArchive(path, options.codes, console.log)
    if (!corpus) corpus = selected
    else {
      for (const [id, delta] of selected) {
        const base = corpus.get(id)
        if (base) mergePreview(base, delta, id)
      }
    }
  }
  const result = new Map<Code, Summary>()
  for (const code of options.codes) {
    const id = CODES[code].id
    const files = corpus?.get(id)
    if (!files) continue
    const counts = new Map<string, number>()
    for (const entry of files.articles.values()) {
      for (const [type, count] of Object.entries(entry.linkTypes)) {
        counts.set(type, (counts.get(type) ?? 0) + count)
      }
    }
    const links = Object.fromEntries(counts)
    if (plan[0]?.kind === 'increment') {
      console.log(
        `${code} · delta seul : ${files.articles.size} versions, ${files.structures.size} documents de structure, ${files.deletedFiles.size} fichiers et ${files.deletedDirectories.size} dossiers à retirer`,
      )
      logLinkTypes(links)
      continue
    }
    if (!files.text || !files.articles.size) throw new Error(`Stock LEGI incomplet pour ${code}`)
    const tree = projectTree(id, files.structures, new Set(files.articles.keys()), options.asOf)
    const articles = [...files.articles.values()]
    result.set(code, summarize(tree, articles, options.asOf, links))
  }
  return result
}

async function main() {
  const options = argumentsFrom(process.argv.slice(2))
  if (!options) {
    console.log(usage)
    return
  }
  const plan = await archivePlan(options)
  const result = options.dryRun
    ? await dryRun(options, plan)
    : await withIngestDatabase((db) => applyPlan(db, options, plan))
  if (result.size) {
    console.log(`Résumé au ${options.asOf}`)
    for (const code of options.codes) {
      const summary = result.get(code)
      if (summary) logSummary(code, summary)
    }
  }
}

if (import.meta.main) {
  try {
    await main()
  } catch (error) {
    console.error(describeError(error))
    process.exitCode = 1
  }
}
