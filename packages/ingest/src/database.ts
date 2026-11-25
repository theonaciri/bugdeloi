import { createSql, type Db, schema } from '@bugdeloi/db'
import { and, DrizzleQueryError, eq, getTableColumns, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/postgres-js'
import {
  type Archive,
  archiveFromName,
  type CodeFiles,
  documentPath,
  isDeleted,
  stagedArticles,
} from './archive.ts'
import { type Placement, projectTree, type Summary, summarize } from './project.ts'
import type { Link } from './xml.ts'

const {
  articleStatus,
  event,
  ingestRun,
  legalArticle,
  legalLink,
  legalSection,
  legalText,
  legiState,
  legiStructure,
} = schema

export async function withIngestDatabase<T>(run: (db: Db) => Promise<T>, url?: string): Promise<T> {
  // Une connexion dédiée garde le verrou entre les transactions par code.
  const client = createSql(url, { max: 1, idle_timeout: 0, max_lifetime: 0 })
  const db = drizzle(client, { schema })
  try {
    await db.execute(sql`select pg_advisory_lock(hashtext('bugdeloi.ingest.legi'))`)
    await db.transaction(async (tx) => {
      const abandoned = await tx
        .update(ingestRun)
        .set({ status: 'failed', error: 'Ingestion interrompue avant la fin du run', finishedAt: new Date() })
        .where(and(eq(ingestRun.source, 'LEGI'), eq(ingestRun.status, 'running')))
        .returning()
      if (abandoned.length) {
        await tx.insert(event).values(
          abandoned.map((row) => ({
            type: 'ingest.failed',
            actor: 'system:ingest',
            subject: String(row.id),
            payload: {
              archive: row.archive,
              archiveSha256: row.archiveSha256,
              scope: row.scope,
              asOf: row.asOf,
              stats: row.stats,
            },
          })),
        )
      }
    })
    return await run(db)
  } finally {
    await client.end()
  }
}

function* batches<T>(values: Iterable<T>, size = 250): Generator<T[]> {
  let batch: T[] = []
  for (const value of values) {
    batch.push(value)
    if (batch.length === size) {
      yield batch
      batch = []
    }
  }
  if (batch.length) yield batch
}

async function* articleBatches(path: string | undefined) {
  let batch = []
  for await (const document of stagedArticles(path)) {
    batch.push(document)
    if (batch.length === 250) {
      yield batch
      batch = []
    }
  }
  if (batch.length) yield batch
}

function excluded<T extends Record<string, AnyPgColumn>>(columns: T, keys: (keyof T)[]) {
  return Object.fromEntries(
    keys.map((key) => [key, sql`excluded.${sql.identifier(columns[key]?.name ?? '')}`]),
  )
}

export function readStates(db: Db, scope: string[]) {
  return db.select().from(legiState).where(inArray(legiState.textId, scope))
}

export type ArchiveInput = { archive: Archive; sha256: string; asOf: string }
type JournalRun = Omit<ArchiveInput, 'sha256'> & { scope: string[] }

export function describeError(error: unknown): string {
  if (error instanceof DrizzleQueryError && error.cause) return describeError(error.cause)
  return error instanceof Error ? error.message : String(error)
}

export async function journalArchive<T>(
  db: Db,
  input: JournalRun,
  run: (
    runId: number,
    recordHash: (sha256: string) => Promise<void>,
  ) => Promise<{ stats: Record<string, number>; result: T }>,
): Promise<T> {
  const [row] = await db
    .insert(ingestRun)
    .values({
      source: 'LEGI',
      archive: input.archive.name,
      asOf: input.asOf,
      scope: input.scope,
    })
    .returning({ id: ingestRun.id })
  if (!row) throw new Error('Création du run LEGI impossible')
  const { id } = row
  let archiveSha256: string | null = null
  let status = 'success'
  let problem: string | null = null
  let stats: Record<string, number> = {}
  try {
    const outcome = await run(id, async (sha256) => {
      archiveSha256 = sha256
      await db.update(ingestRun).set({ archiveSha256 }).where(eq(ingestRun.id, id))
    })
    stats = outcome.stats
    return outcome.result
  } catch (error) {
    status = 'failed'
    problem = describeError(error)
    throw error
  } finally {
    await db.transaction(async (tx) => {
      await tx
        .update(ingestRun)
        .set({ status, error: problem, stats, finishedAt: new Date() })
        .where(eq(ingestRun.id, id))
      await tx.insert(event).values({
        type: status === 'success' ? 'ingest.finished' : 'ingest.failed',
        actor: 'system:ingest',
        subject: String(id),
        payload: {
          archive: input.archive.name,
          archiveSha256,
          scope: input.scope,
          asOf: input.asOf,
          stats,
        },
      })
    })
  }
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
const articleColumns = getTableColumns(legalArticle)
const sourceColumns = getTableColumns(legiStructure)
const sectionColumns = getTableColumns(legalSection)

async function writePlacements(tx: Tx, textId: string, placements: Iterable<Placement>) {
  for (const batch of batches(placements)) {
    const values = batch.map(
      ({ id, sectionId, position }) => sql`(${id}::text, ${sectionId}::text, ${position}::integer)`,
    )
    await tx.execute(sql`
      update ${legalArticle}
      set section_id = placement.section_id, position = placement.position
      from (values ${sql.join(values, sql`, `)}) as placement(id, section_id, position)
      where ${legalArticle.id} = placement.id and ${legalArticle.textId} = ${textId}
    `)
  }
}

export async function applyCode(
  db: Db,
  textId: string,
  files: CodeFiles,
  input: ArchiveInput,
  runId: number,
): Promise<Summary> {
  return db.transaction(async (tx) => {
    const [state] = await tx.select().from(legiState).where(eq(legiState.textId, textId))
    if (state && state.archive === input.archive.name && state.archiveSha256 !== input.sha256) {
      throw new Error(`Archive déjà appliquée avec une autre empreinte : ${input.archive.name}`)
    }
    const alreadyApplied = state && archiveFromName(state.archive).stamp >= input.archive.stamp
    if (alreadyApplied) {
      return projectAndSummarize(tx, textId, input.asOf, runId, state.asOf !== input.asOf)
    }

    const global = input.archive.kind === 'global'
    if (!global && !state) throw new Error(`Aucun stock LEGI initial pour ${textId}`)
    if (global && (!files.text || !files.structures.has(textId) || files.articles.size === 0)) {
      throw new Error(`Stock LEGI incomplet pour ${textId}`)
    }
    if (!files.text && isDeleted(files, documentPath(textId, 'text'))) {
      throw new Error(`La DILA retire les métadonnées du code ciblé ${textId}`)
    }
    if (files.text) {
      await tx
        .insert(legalText)
        .values(files.text)
        .onConflictDoUpdate({ target: legalText.id, set: { ...files.text, updatedAt: new Date() } })
    }

    const previousStructures = await tx
      .select({ id: legiStructure.id })
      .from(legiStructure)
      .where(eq(legiStructure.textId, textId))
    for (const batch of batches(
      previousStructures
        .map(({ id }) => id)
        .filter(
          (id) => !files.structures.has(id) && (global || isDeleted(files, documentPath(id, 'structure'))),
        ),
    )) {
      await tx
        .delete(legiStructure)
        .where(and(eq(legiStructure.textId, textId), inArray(legiStructure.id, batch)))
    }
    for (const batch of batches(files.structures.values())) {
      await tx
        .insert(legiStructure)
        .values(batch.map((doc) => ({ ...doc, textId })))
        .onConflictDoUpdate({
          target: [legiStructure.textId, legiStructure.id],
          set: excluded(sourceColumns, ['title', 'children']),
        })
    }

    const previous = await tx
      .select({ id: legalArticle.id })
      .from(legalArticle)
      .where(eq(legalArticle.textId, textId))
    const removed = previous
      .map(({ id }) => id)
      .filter((id) => !files.articles.has(id) && (global || isDeleted(files, documentPath(id, 'article'))))
    for (const batch of batches(removed)) {
      const statuses = await tx
        .select()
        .from(articleStatus)
        .where(inArray(articleStatus.articleId, batch))
        .for('update')
      const advanced = statuses.filter(
        ({ level, flags, evidence }) =>
          level !== 'N0' || flags.length > 0 || Object.keys(evidence).length > 0,
      )
      if (advanced.length)
        throw new Error(
          `Retrait DILA avec niveau de preuve existant : ${advanced.map(({ articleId }) => articleId).join(', ')}`,
        )
      await tx
        .delete(legalArticle)
        .where(and(eq(legalArticle.textId, textId), inArray(legalArticle.id, batch)))
    }
    for await (const batch of articleBatches(files.articleFile)) {
      const ids = batch.map(({ article }) => article.id)
      await tx
        .insert(legalArticle)
        .values(batch.map(({ article }) => ({ ...article, lastRunId: runId })))
        .onConflictDoUpdate({
          target: legalArticle.id,
          set: {
            ...excluded(articleColumns, [
              'textId',
              'num',
              'articleKey',
              'etat',
              'type',
              'dateDebut',
              'dateFin',
              'contentHtml',
              'contentText',
              'textSha256',
              'notaHtml',
              'versionIds',
              'lastRunId',
            ]),
            updatedAt: new Date(),
          },
        })
      await tx
        .insert(articleStatus)
        .values(ids.map((articleId) => ({ articleId })))
        .onConflictDoNothing()
      await tx.delete(legalLink).where(inArray(legalLink.articleId, ids))
      for (const links of batches<Link>(
        batch.flatMap(({ links }) => links),
        750,
      )) {
        await tx.insert(legalLink).values(links)
      }
    }

    const refresh =
      global ||
      files.structures.size > 0 ||
      files.articles.size > 0 ||
      removed.length > 0 ||
      files.deletedFiles.size > 0 ||
      files.deletedDirectories.size > 0 ||
      state?.asOf !== input.asOf
    const summary = await projectAndSummarize(tx, textId, input.asOf, runId, refresh)
    const next = { archive: input.archive.name, archiveSha256: input.sha256, asOf: input.asOf }
    await tx
      .insert(legiState)
      .values({ textId, ...next })
      .onConflictDoUpdate({ target: legiState.textId, set: next })
    return summary
  })
}

async function projectAndSummarize(tx: Tx, textId: string, asOf: string, runId: number, refresh: boolean) {
  const articles = await tx
    .select({
      id: legalArticle.id,
      etat: legalArticle.etat,
      sectionId: legalArticle.sectionId,
      position: legalArticle.position,
      dateDebut: legalArticle.dateDebut,
      dateFin: legalArticle.dateFin,
    })
    .from(legalArticle)
    .where(eq(legalArticle.textId, textId))
  const structures = await tx.select().from(legiStructure).where(eq(legiStructure.textId, textId))
  const tree = projectTree(
    textId,
    new Map(structures.map((entry) => [entry.id, entry])),
    new Set(articles.map(({ id }) => id)),
    asOf,
  )
  if (refresh) {
    for (const batch of batches(tree.sections.values())) {
      await tx
        .insert(legalSection)
        .values(batch.map((section) => ({ ...section, lastRunId: runId })))
        .onConflictDoUpdate({
          target: legalSection.id,
          set: excluded(sectionColumns, [
            'textId',
            'parentId',
            'path',
            'depth',
            'position',
            'title',
            'etat',
            'dateDebut',
            'dateFin',
            'lastRunId',
          ]),
        })
    }
    const changes = articles.flatMap(({ id, sectionId, position }) => {
      const placement = tree.placements.get(id) ?? { id, sectionId: null, position: 0 }
      return placement.sectionId !== sectionId || placement.position !== position ? [placement] : []
    })
    await writePlacements(tx, textId, changes)
    await tx
      .delete(legalSection)
      .where(
        and(
          eq(legalSection.textId, textId),
          or(ne(legalSection.lastRunId, runId), isNull(legalSection.lastRunId)),
        ),
      )
    await tx.update(legiState).set({ asOf }).where(eq(legiState.textId, textId))
  }
  const links = await tx
    .select({
      type: legalLink.typeLien,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(legalLink)
    .innerJoin(legalArticle, eq(legalLink.articleId, legalArticle.id))
    .where(eq(legalArticle.textId, textId))
    .groupBy(legalLink.typeLien)
  return summarize(tree, articles, asOf, Object.fromEntries(links.map(({ type, count }) => [type, count])))
}
