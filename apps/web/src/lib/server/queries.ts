/**
 * Toutes les requêtes du site public, au même endroit (AGENTS.md §9.3 : « chaque nombre affiché
 * au public est calculé par une requête documentée »). Chaque fonction dit ce qu'elle compte ;
 * la page /methode#compteurs reprend ces définitions en français.
 *
 * Conventions :
 * - « en vigueur » = `articleInForce()` (@bugdeloi/db/predicates) : intervalle de dates DILA qui contient
 *   la date de projection du code et état non exclu — même règle que l'arbre de la carte (ingestion) ;
 *   inclut `ABROGE_DIFF` (abrogation programmée, pas encore effective) ;
 * - un article sans ligne dans `article_status` est au niveau N0 (ingéré = N0 par définition) ;
 * - les anomalies ne sont comptées qu'aux statuts publics (`qualified`, `published`), jamais
 *   au stade `candidate` ou `reproduced` (AGENTS.md §4.4) ;
 * - le journal public exclut les événements d'anomalies non qualifiées (`finding.*` sauf
 *   `finding.qualified` / `finding.published`).
 *
 * SQL via Drizzle uniquement (paramètres liés, jamais de concaténation). La connexion est en
 * lecture seule (voir `db.ts`).
 */

import { findingArticle, findingEvidence } from '@bugdeloi/core/finding-certificate'
import {
  FINDING_ID_RE,
  FINDING_TYPE_LABEL,
  FINDING_TYPES,
  findingQualification,
  PUBLIC_FINDING_STATUSES,
  qualifiedStatus,
  REJECTED_VERDICTS,
} from '@bugdeloi/core/findings'
import { CODES, LEGIARTI_RE, LEGISCTA_RE, legifranceArticleUrl } from '@bugdeloi/core/legi'
import { articleInForce } from '@bugdeloi/db/predicates'
import {
  articleStatus,
  event,
  finding,
  ingestRun,
  legalArticle,
  legalLink,
  legalSection,
  legalText,
  referenceCoverage,
  replicationRun,
  sweepRun,
} from '@bugdeloi/db/schema'
import { and, asc, count, desc, eq, inArray, isNull, or, type SQL, sql } from 'drizzle-orm'
import { journalGroupLabels } from '../events.ts'
import { asLevel, countAtLeast, emptyLevelCounts, type Level } from '../levels.ts'
import { MAP_WINDOW, type MapArticleRow, type MapCountRow, type MapSectionRow } from '../map-tree.ts'
import { sanitizeLegalHtml } from '../sanitize.ts'
import type {
  CodeProgress,
  JournalEntry,
  PublicEvent,
  ReferenceExample,
  RunInfo,
  Snapshot,
} from '../snapshot.ts'
import { db } from './db.ts'

const publicFindingFilter = inArray(finding.status, PUBLIC_FINDING_STATUSES)
const rejectedFindingFilter = and(
  eq(finding.status, 'rejected'),
  inArray(sql<string>`${finding.certificate}->'qualification'->>'verdict'`, REJECTED_VERDICTS),
)

/** Valeur de `ingest_run.source` écrite par `scripts/seed-dev.ts` : signale des données fictives. */
export const FICTIONAL_SOURCE = 'FICTIF-DEV'

export type CodeKey = keyof typeof CODES
export const CODE_KEYS = Object.keys(CODES) as CodeKey[]

export function isCodeKey(value: string | null): value is CodeKey {
  return value !== null && value in CODES
}

const ISO = (d: Date | string | null | undefined): string | null =>
  d == null ? null : d instanceof Date ? d.toISOString() : new Date(d).toISOString()

// ---------------------------------------------------------------------------
// Journal public
// ---------------------------------------------------------------------------

/** Filtre des événements publiables : tout sauf les anomalies non encore qualifiées. */
const publicEventFilter: SQL = sql`(${event.type} NOT LIKE 'finding.%' OR ${event.type} IN ('finding.qualified', 'finding.published'))`

function publicEvent(r: typeof event.$inferSelect): PublicEvent {
  return {
    id: r.id,
    ts: r.ts.toISOString(),
    type: r.type,
    actor: r.actor,
    subject: r.subject,
    summary:
      r.type !== 'reproduction.finished' && typeof r.payload.summary === 'string' ? r.payload.summary : null,
  }
}

/** Les `limit` derniers événements publics, du plus récent au plus ancien. */
export async function latestEvents(limit = 10): Promise<PublicEvent[]> {
  const rows = await db().select().from(event).where(publicEventFilter).orderBy(desc(event.id)).limit(limit)
  return rows.map(publicEvent)
}

/** Opérations répétitives regroupées par type et par jour à Paris, par dernier événement. */
export async function journalEntries(limit: number, before?: number): Promise<JournalEntry[]> {
  const repeatable = inArray(event.type, Object.keys(journalGroupLabels))
  return db()
    .select({
      id: sql<number>`max(${event.id})`.mapWith(Number),
      type: event.type,
      events: sql<
        JournalEntry['events']
      >`jsonb_agg(jsonb_build_object('id', ${event.id}, 'ts', ${event.ts}) order by ${event.ts} desc, ${event.id} desc)`,
    })
    .from(event)
    .where(publicEventFilter)
    .groupBy(
      event.type,
      sql`case when ${repeatable} then (${event.ts} at time zone 'Europe/Paris')::date end`,
      sql`case when not ${repeatable} then ${event.id} end`,
    )
    .having(before === undefined ? undefined : sql`max(${event.id}) < ${before}`)
    .orderBy(sql`max(${event.id}) desc`)
    .limit(limit)
}

/** Le détail applique le filtre du journal et ne transmet pas le payload brut. */
export async function eventDetail(id: number, database = db()) {
  const [row] = await database
    .select()
    .from(event)
    .where(and(eq(event.id, id), publicEventFilter))
    .limit(1)
  if (!row) return null
  const { payload, subject, type } = row
  const asOf = payload.asOf
  const stats = payload.stats
  const articlesChecked = payload.articlesChecked
  const runs = Array.isArray(payload.runs) ? payload.runs : []
  const [article] =
    subject && LEGIARTI_RE.test(subject)
      ? await database
          .select({ num: legalArticle.num })
          .from(legalArticle)
          .where(eq(legalArticle.id, subject))
      : []
  const findingHref =
    subject && (type === 'finding.qualified' || type === 'finding.published') && FINDING_ID_RE.test(subject)
      ? `/anomalies/${subject}`
      : null
  return {
    ...publicEvent(row),
    archive: type.startsWith('ingest.') && typeof payload.archive === 'string' ? payload.archive : null,
    projectionDate: type.startsWith('ingest.') && typeof asOf === 'string' ? asOf : null,
    scopes: CODE_KEYS.flatMap((code) => {
      const total =
        type === 'ingest.finished'
          ? field(stats, `${code}.versions`)
          : type === 'sweep.finished'
            ? field(articlesChecked, code)
            : undefined
      const date = field(asOf, code)
      return typeof total === 'number' ? [{ code, total, date: typeof date === 'string' ? date : null }] : []
    }),
    reference:
      type === 'reference.promoted' && typeof payload.promoted === 'number' ? payload.promoted : null,
    replayStatuses:
      type === 'replication.finished'
        ? runs.flatMap((run: unknown) => {
            const status = field(run, 'status')
            return typeof status === 'string' ? [status] : []
          })
        : [],
    article: article && subject ? { id: subject, num: article.num } : null,
    findingHref,
  }
}

function field(record: unknown, key: string): unknown {
  return record && typeof record === 'object' && Object.hasOwn(record, key)
    ? (record as Record<string, unknown>)[key]
    : undefined
}

// ---------------------------------------------------------------------------
// Compteurs de l'accueil
// ---------------------------------------------------------------------------

/**
 * Avancement par code du périmètre (CGI, CSS, CCH) :
 * - `versions` : nombre de lignes `legal_article` du code (chaque LEGIARTI est une version datée) ;
 * - `inForce` : versions en vigueur à la date de projection (`articleInForce()`) ;
 * - `byLevel` : articles en vigueur groupés par `article_status.level` (absent = N0) ;
 * - `atLeastN2` : articles en vigueur au niveau N2, N3, N4, N5 ou ★.
 */
export async function codeProgress(): Promise<CodeProgress[]> {
  const ids = CODE_KEYS.map((k) => CODES[k].id)
  const [versions, levels, texts] = await Promise.all([
    db()
      .select({ textId: legalArticle.textId, n: count() })
      .from(legalArticle)
      .where(inArray(legalArticle.textId, ids))
      .groupBy(legalArticle.textId),
    db()
      .select({
        textId: legalArticle.textId,
        level: sql<string>`coalesce(${articleStatus.level}, 'N0')`,
        n: count(),
      })
      .from(legalArticle)
      .leftJoin(articleStatus, eq(articleStatus.articleId, legalArticle.id))
      .where(and(inArray(legalArticle.textId, ids), articleInForce()))
      .groupBy(legalArticle.textId, sql`2`),
    db()
      .select({ id: legalText.id, title: legalText.title })
      .from(legalText)
      .where(inArray(legalText.id, ids)),
  ])
  return CODE_KEYS.map((key) => {
    const code = CODES[key]
    const byLevel = emptyLevelCounts()
    for (const r of levels) if (r.textId === code.id) byLevel[asLevel(r.level)] += Number(r.n)
    const v = Number(versions.find((r) => r.textId === code.id)?.n ?? 0)
    const inForce = Object.values(byLevel).reduce((a, b) => a + b, 0)
    return {
      id: code.id,
      short: code.short,
      title: texts.find((t) => t.id === code.id)?.title ?? code.title,
      ingested: v > 0,
      versions: v,
      inForce,
      byLevel,
      atLeastN2: countAtLeast(byLevel, 'N2'),
    }
  })
}

/** Anomalies publiques : statut `qualified` ou `published` (jamais les candidats). */
export async function publicFindingCount(): Promise<number> {
  const [r] = await db().select({ n: count() }).from(finding).where(publicFindingFilter)
  return Number(r?.n ?? 0)
}

/** Charge de relecture : signalements encore candidats ou reproduits, sans identifier les cas. */
async function pendingReviewCount(): Promise<number> {
  const [r] = await db()
    .select({ n: count() })
    .from(finding)
    .where(inArray(finding.status, ['candidate', 'reproduced']))
  return r?.n ?? 0
}

const referenceCommit = '9e251b932288cf5f4a74af072d203144a057494b'
// Les explications portent sur les versions datées et le code du commit ci-dessus.
// Une citation seule dans reference_coverage ne suffit pas à expliquer ce que le programme fait.
const referenceExplanations = [
  {
    id: 'LEGIARTI000038814858',
    title: 'Une allocation de logement pour devenir propriétaire ?',
    description:
      'Le programme lit la date de signature du prêt immobilier et écarte la demande si le prêt a été signé après la date limite fixée par l’article.',
  },
  {
    id: 'LEGIARTI000038878698',
    title: 'Pendant combien de temps cette allocation de logement est-elle due ?',
    description:
      'Le programme utilise la durée de cinq ans fixée par cet article pour déterminer si le foyer peut encore toucher l’allocation dans le cas prévu par l’article L. 841-1.',
  },
]

const referenceArticleFilter = and(
  eq(articleStatus.level, 'REF'),
  articleInForce(),
  inArray(
    legalArticle.textId,
    CODE_KEYS.map((key) => CODES[key].id),
  ),
)

export function referenceArticles(exclude?: string) {
  return db()
    .select({ id: legalArticle.id, num: legalArticle.num, code: legalText.title })
    .from(articleStatus)
    .innerJoin(legalArticle, eq(legalArticle.id, articleStatus.articleId))
    .innerJoin(legalText, eq(legalText.id, legalArticle.textId))
    .where(and(referenceArticleFilter, exclude ? sql`${legalArticle.id} <> ${exclude}` : undefined))
    .orderBy(legalText.title, legalArticle.num, legalArticle.id)
}

/** Un article ★ bien documenté, couvert par une suite dont le dernier rejeu a réussi. */
async function referenceExample(): Promise<ReferenceExample | null> {
  const latest = db()
    .selectDistinctOn([replicationRun.subject], {
      subject: replicationRun.subject,
      status: replicationRun.status,
      finishedAt: replicationRun.finishedAt,
      summary: replicationRun.summary,
    })
    .from(replicationRun)
    .where(and(eq(replicationRun.kind, 'C0.1-inria-replay'), sql`${replicationRun.status} <> 'running'`))
    .orderBy(replicationRun.subject, desc(replicationRun.startedAt), desc(replicationRun.id))
    .as('example_latest')

  const rows = await db()
    .select({
      id: legalArticle.id,
      num: legalArticle.num,
      codeTitle: legalText.title,
      versionDate: legalArticle.dateDebut,
      contentHtml: legalArticle.contentHtml,
      file: referenceCoverage.file,
      line: referenceCoverage.line,
      tests: sql<unknown>`${latest.summary}->'tests'`,
      finishedAt: latest.finishedAt,
    })
    .from(articleStatus)
    .innerJoin(legalArticle, eq(legalArticle.id, articleStatus.articleId))
    .innerJoin(legalText, eq(legalText.id, legalArticle.textId))
    .innerJoin(referenceCoverage, eq(referenceCoverage.legiarti, legalArticle.id))
    .innerJoin(latest, eq(latest.subject, `catala-examples@${referenceCommit}/aides_logement`))
    .where(
      and(
        referenceArticleFilter,
        inArray(
          legalArticle.id,
          referenceExplanations.map(({ id }) => id),
        ),
        eq(referenceCoverage.source, 'inria/catala-examples'),
        eq(referenceCoverage.sourceCommit, referenceCommit),
        sql`starts_with(${referenceCoverage.file}, 'aides_logement/')`,
        eq(latest.status, 'passed'),
      ),
    )
    .orderBy(referenceCoverage.file, referenceCoverage.line)

  for (const { id, title, description } of referenceExplanations) {
    const row = rows.find((candidate) => candidate.id === id)
    if (
      !row?.contentHtml ||
      !row.finishedAt ||
      typeof row.tests !== 'number' ||
      !Number.isSafeInteger(row.tests) ||
      row.tests < 1
    )
      continue
    const file = row.file.split('/').map(encodeURIComponent).join('/')
    return {
      id,
      num: row.num,
      codeTitle: row.codeTitle,
      versionDate: row.versionDate,
      textHtml: sanitizeLegalHtml(row.contentHtml)
        .trim()
        .replace(/^(<p>\s*)<br>\s*/, '$1'),
      legifranceUrl: legifranceArticleUrl(id),
      sourceUrl: `https://github.com/CatalaLang/catala-examples/blob/${referenceCommit}/${file}${row.line ? `#L${row.line}` : ''}`,
      title,
      description,
      tests: row.tests,
      replayDate: row.finishedAt.toISOString(),
    }
  }
  return null
}

function toRunInfo(r: typeof replicationRun.$inferSelect | undefined): RunInfo | null {
  if (!r) return null
  return {
    id: r.id,
    kind: r.kind,
    subject: r.subject,
    status: r.status,
    startedAt: ISO(r.startedAt) as string,
    finishedAt: ISO(r.finishedAt),
  }
}

/**
 * Rejeux de référence : pour chaque suite (`subject`), on ne retient que son **dernier** rejeu terminé.
 * `passed` = suites dont le dernier rejeu est `passed` ; `total` = suites dont le dernier rejeu est
 * `passed`, `failed` ou `error`. Les suites sans aucun test (`no_tests`) ne sont comptées ni d'un côté
 * ni de l'autre : elles n'ont rien démontré.
 */
export async function replicationStats(): Promise<Snapshot['replications']> {
  const latest = db()
    .selectDistinctOn([replicationRun.subject], {
      subject: replicationRun.subject,
      status: replicationRun.status,
    })
    .from(replicationRun)
    .where(sql`${replicationRun.status} <> 'running'`)
    .orderBy(replicationRun.subject, desc(replicationRun.startedAt))
    .as('latest')
  const [agg, last] = await Promise.all([
    db()
      .select({
        passed: sql<number>`count(*) filter (where ${latest.status} = 'passed')`,
        total: sql<number>`count(*) filter (where ${latest.status} in ('passed', 'failed', 'error'))`,
      })
      .from(latest),
    db().select().from(replicationRun).orderBy(desc(replicationRun.startedAt)).limit(1),
  ])
  return { passed: Number(agg[0]?.passed ?? 0), total: Number(agg[0]?.total ?? 0), last: toRunInfo(last[0]) }
}

/**
 * Couverture par la recherche (`reference_coverage`) :
 * - `sources` : formalisations de référence distinctes (ex. `inria/catala-examples`) ;
 * - `cited` : identifiants LEGIARTI distincts cités par ces formalisations ;
 * - `matched` : parmi eux, ceux qui correspondent à une version d'article présente en base.
 * Couvrir un article ne vaut pas le niveau ★ : il faut aussi que la suite de tests soit rejouée.
 */
export async function coverageStats(): Promise<Snapshot['coverage']> {
  const [r] = await db()
    .select({
      sources: sql<number>`count(distinct ${referenceCoverage.source})`,
      cited: sql<number>`count(distinct ${referenceCoverage.legiarti})`,
      matched: sql<number>`count(distinct ${referenceCoverage.legiarti}) filter (where exists (select 1 from ${legalArticle} where ${legalArticle.id} = ${referenceCoverage.legiarti}))`,
    })
    .from(referenceCoverage)
  return { sources: Number(r?.sources ?? 0), cited: Number(r?.cited ?? 0), matched: Number(r?.matched ?? 0) }
}

/** Vrai si la base contient les données fictives de développement (voir `scripts/seed-dev.ts`). */
export async function hasFictionalData(): Promise<boolean> {
  const rows = await db()
    .select({ id: ingestRun.id })
    .from(ingestRun)
    .where(eq(ingestRun.source, FICTIONAL_SOURCE))
    .limit(1)
  return rows.length > 0
}

/** Instantané complet de l'accueil (servi aussi par /api/snapshot.json et /api/stream). */
export async function snapshot(): Promise<Snapshot> {
  const [codes, findings, pendingReview, replications, coverage, events, journal, example, fictional] =
    await Promise.all([
      codeProgress(),
      publicFindingCount(),
      pendingReviewCount(),
      replicationStats(),
      coverageStats(),
      latestEvents(10),
      journalEntries(3),
      referenceExample(),
      hasFictionalData(),
    ])
  return {
    generatedAt: new Date().toISOString(),
    fictional,
    codes,
    findings: { public: findings, pendingReview },
    replications,
    coverage,
    events,
    journal,
    referenceExample: example,
  }
}

// ---------------------------------------------------------------------------
// État du service
// ---------------------------------------------------------------------------

export interface IngestInfo {
  id: number
  source: string
  archive: string
  status: string
  startedAt: string
  finishedAt: string | null
  stats: Record<string, number>
}

/**
 * Dernier balayage mécanique (`sweep_run`). Volontairement **sans aucun nombre de candidats** : les
 * candidats ne sont pas qualifiés, donc absents de tout compteur public (AGENTS.md §4.4). Seules les
 * colonnes de périmètre sont lues (jamais `stats`).
 */
export interface SweepInfo {
  id: number
  status: string
  startedAt: string
  finishedAt: string | null
  codes: string[]
  detectors: Record<string, string>
  asOf: Record<string, string>
  articlesChecked: Record<string, number>
}

export interface Health {
  database: { ok: boolean; latencyMs: number | null; error: string | null }
  lastIngest: IngestInfo | null
  lastReplication: RunInfo | null
  lastSweep: SweepInfo | null
}

/** Santé : base joignable (SELECT 1 chronométré), dernier `ingest_run`, dernier `replication_run`. */
export async function health(): Promise<Health> {
  const t0 = performance.now()
  try {
    await db().execute(sql`select 1`)
  } catch (e) {
    console.error('[status] base injoignable', e)
    return {
      // Message générique : le détail (requête, hôte) reste dans les journaux du serveur.
      database: { ok: false, latencyMs: null, error: 'database_unavailable' },
      lastIngest: null,
      lastReplication: null,
      lastSweep: null,
    }
  }
  const latencyMs = Math.round((performance.now() - t0) * 10) / 10
  const [ing, rep, swp] = await Promise.all([
    db().select().from(ingestRun).orderBy(desc(ingestRun.startedAt)).limit(1),
    db().select().from(replicationRun).orderBy(desc(replicationRun.startedAt)).limit(1),
    db()
      .select({
        id: sweepRun.id,
        status: sweepRun.status,
        startedAt: sweepRun.startedAt,
        finishedAt: sweepRun.finishedAt,
        codes: sweepRun.codes,
        detectors: sweepRun.detectors,
        asOf: sweepRun.asOf,
        articlesChecked: sweepRun.articlesChecked,
      })
      .from(sweepRun)
      .orderBy(desc(sweepRun.startedAt))
      .limit(1),
  ])
  const w = swp[0]
  const i = ing[0]
  return {
    database: { ok: true, latencyMs, error: null },
    lastIngest: i
      ? {
          id: i.id,
          source: i.source,
          archive: i.archive,
          status: i.status,
          startedAt: ISO(i.startedAt) as string,
          finishedAt: ISO(i.finishedAt),
          stats: i.stats,
        }
      : null,
    lastReplication: toRunInfo(rep[0]),
    lastSweep: w
      ? {
          id: w.id,
          status: w.status,
          startedAt: ISO(w.startedAt) as string,
          finishedAt: ISO(w.finishedAt),
          codes: w.codes,
          detectors: w.detectors,
          asOf: w.asOf,
          articlesChecked: w.articlesChecked,
        }
      : null,
  }
}

// ---------------------------------------------------------------------------
// Carte
// ---------------------------------------------------------------------------

export interface Crumb {
  id: string
  title: string
}

export interface MapData {
  code: CodeKey
  codeTitle: string
  ingested: boolean
  focus: { id: string; path: string; title: string; isRoot: boolean }
  crumbs: Crumb[]
  sections: MapSectionRow[]
  counts: MapCountRow[]
  articles: MapArticleRow[]
  /** Vrai si la liste des articles directs a été tronquée à `MAX_DIRECT_ARTICLES`. */
  truncated: boolean
  /** Vue d'un code entier : articles en vigueur sans section (`section_id` nul), absents de la carte. */
  outsideTree: number
}

export const MAX_DIRECT_ARTICLES = 1500

/** Le code (CGI/CSS/CCH) auquel appartient une section, ou null si la section est inconnue. */
export async function sectionCode(sectionId: string): Promise<CodeKey | null> {
  if (!LEGISCTA_RE.test(sectionId)) return null
  const [s] = await db()
    .select({ textId: legalSection.textId })
    .from(legalSection)
    .where(eq(legalSection.id, sectionId))
  return CODE_KEYS.find((k) => CODES[k].id === s?.textId) ?? null
}

/**
 * Fenêtre de la carte autour d'une section (ou du code entier si `sectionId` est nul) :
 * - `sections` : sections descendantes sur MAP_WINDOW niveaux (chemins ltree `path <@ focus`) ;
 * - `counts` : articles en vigueur sous le focus (hors articles propres au focus), groupés par
 *   ancêtre à la profondeur focus + MAP_WINDOW et par niveau ;
 * - `articles` : articles en vigueur rattachés directement à la section focus.
 * Retourne null si la section n'existe pas dans ce code.
 */
export async function mapData(code: CodeKey, sectionId: string | null): Promise<MapData | null> {
  const textId = CODES[code].id
  const [text] = await db().select({ title: legalText.title }).from(legalText).where(eq(legalText.id, textId))
  const codeTitle = text?.title ?? CODES[code].title

  let focus: MapData['focus'] = { id: textId, path: textId, title: codeTitle, isRoot: true }
  if (sectionId) {
    if (!LEGISCTA_RE.test(sectionId)) return null
    const [s] = await db()
      .select({
        id: legalSection.id,
        path: sql<string>`${legalSection.path}::text`,
        title: legalSection.title,
      })
      .from(legalSection)
      .where(and(eq(legalSection.id, sectionId), eq(legalSection.textId, textId)))
    if (!s) return null
    focus = { ...s, isRoot: false }
  }
  const focusPath = sql`${focus.path}::ltree`

  const [crumbs, sections, counts, articles, any, outside] = await Promise.all([
    focus.isRoot
      ? Promise.resolve([])
      : db()
          .select({ id: legalSection.id, title: legalSection.title })
          .from(legalSection)
          .where(and(sql`${legalSection.path} @> ${focusPath}`, sql`${legalSection.id} <> ${focus.id}`))
          .orderBy(sql`nlevel(${legalSection.path})`),
    db()
      .select({
        id: legalSection.id,
        path: sql<string>`${legalSection.path}::text`,
        title: legalSection.title,
        position: legalSection.position,
      })
      .from(legalSection)
      .where(
        and(
          eq(legalSection.textId, textId),
          sql`${legalSection.path} <@ ${focusPath}`,
          sql`nlevel(${legalSection.path}) between nlevel(${focusPath}) + 1 and nlevel(${focusPath}) + ${MAP_WINDOW}`,
        ),
      ),
    db()
      .select({
        anc: sql<string>`subpath(${legalSection.path}, 0, least(nlevel(${legalSection.path}), nlevel(${focusPath}) + ${MAP_WINDOW}))::text`,
        level: sql<string>`coalesce(${articleStatus.level}, 'N0')`,
        n: count(),
      })
      .from(legalArticle)
      .innerJoin(legalSection, eq(legalSection.id, legalArticle.sectionId))
      .leftJoin(articleStatus, eq(articleStatus.articleId, legalArticle.id))
      .where(
        and(
          eq(legalArticle.textId, textId),
          articleInForce(),
          sql`${legalSection.path} <@ ${focusPath}`,
          sql`nlevel(${legalSection.path}) > nlevel(${focusPath})`,
        ),
      )
      .groupBy(sql`1`, sql`2`),
    focus.isRoot
      ? Promise.resolve([])
      : db()
          .select({
            id: legalArticle.id,
            num: legalArticle.num,
            level: sql<string>`coalesce(${articleStatus.level}, 'N0')`,
            flags: sql<string[]>`coalesce(${articleStatus.flags}, '{}'::text[])`,
            position: legalArticle.position,
          })
          .from(legalArticle)
          .leftJoin(articleStatus, eq(articleStatus.articleId, legalArticle.id))
          .where(and(eq(legalArticle.sectionId, focus.id), articleInForce()))
          .orderBy(asc(legalArticle.position), asc(legalArticle.num))
          .limit(MAX_DIRECT_ARTICLES + 1),
    db().select({ id: legalArticle.id }).from(legalArticle).where(eq(legalArticle.textId, textId)).limit(1),
    focus.isRoot
      ? db()
          .select({ n: count() })
          .from(legalArticle)
          .where(and(eq(legalArticle.textId, textId), articleInForce(), isNull(legalArticle.sectionId)))
      : Promise.resolve([{ n: 0 }]),
  ])
  return {
    code,
    codeTitle,
    ingested: any.length > 0,
    focus,
    crumbs,
    sections,
    counts: counts.map((c) => ({ ...c, n: Number(c.n) })),
    articles: articles.slice(0, MAX_DIRECT_ARTICLES),
    truncated: articles.length > MAX_DIRECT_ARTICLES,
    outsideTree: Number(outside[0]?.n ?? 0),
  }
}

// ---------------------------------------------------------------------------
// Article
// ---------------------------------------------------------------------------

export interface ArticleVersion {
  id: string
  etat: string | null
  dateDebut: string | null
  dateFin: string | null
  inDb: boolean
}

export interface ArticleLink {
  typeLien: string
  sens: string
  targetId: string | null
  targetNum: string | null
  targetTextNum: string | null
  targetNature: string | null
  targetDate: string | null
  label: string | null
  /** La cible est une version d'article présente en base (lien interne possible). */
  internal: boolean
}

export interface ArticleCoverage {
  source: string
  sourceCommit: string
  legiarti: string
  file: string
  line: number | null
  heading: string | null
}

export interface ArticleData {
  id: string
  num: string | null
  etat: string | null
  type: string | null
  dateDebut: string | null
  dateFin: string | null
  contentHtml: string
  notaHtml: string | null
  textSha256: string
  updatedAt: string
  text: { id: string; title: string; short: string | null; code: CodeKey | null }
  crumbs: Crumb[]
  level: Level
  flags: string[]
  levelUpdatedAt: string | null
  versions: ArticleVersion[]
  links: ArticleLink[]
  linksTruncated: boolean
  coverage: ArticleCoverage[]
}

const MAX_LINKS = 500

/** Fiche d'un article (une version LEGIARTI), ou null s'il n'est pas en base. */
export async function article(legiarti: string): Promise<ArticleData | null> {
  if (!LEGIARTI_RE.test(legiarti)) return null
  const [a] = await db()
    .select({
      article: legalArticle,
      textTitle: legalText.title,
      textShort: legalText.shortTitle,
      sectionPath: sql<string | null>`${legalSection.path}::text`,
      level: articleStatus.level,
      flags: articleStatus.flags,
      levelUpdatedAt: articleStatus.updatedAt,
    })
    .from(legalArticle)
    .innerJoin(legalText, eq(legalText.id, legalArticle.textId))
    .leftJoin(legalSection, eq(legalSection.id, legalArticle.sectionId))
    .leftJoin(articleStatus, eq(articleStatus.articleId, legalArticle.id))
    .where(eq(legalArticle.id, legiarti))
  if (!a) return null
  const art = a.article
  const versionIds = art.versionIds.filter((v) => LEGIARTI_RE.test(v))
  const sectionIds = (a.sectionPath ?? '').split('.').filter((l) => LEGISCTA_RE.test(l))

  const [crumbRows, versions, links, coverage] = await Promise.all([
    sectionIds.length
      ? db()
          .select({ id: legalSection.id, title: legalSection.title })
          .from(legalSection)
          .where(inArray(legalSection.id, sectionIds))
      : Promise.resolve([]),
    versionIds.length
      ? db()
          .select({
            id: legalArticle.id,
            etat: legalArticle.etat,
            dateDebut: legalArticle.dateDebut,
            dateFin: legalArticle.dateFin,
          })
          .from(legalArticle)
          .where(inArray(legalArticle.id, versionIds))
      : Promise.resolve([]),
    db()
      .select()
      .from(legalLink)
      .where(eq(legalLink.articleId, legiarti))
      .orderBy(asc(legalLink.id))
      .limit(MAX_LINKS + 1),
    db()
      .select()
      .from(referenceCoverage)
      .where(
        versionIds.length
          ? or(eq(referenceCoverage.legiarti, legiarti), inArray(referenceCoverage.legiarti, versionIds))
          : eq(referenceCoverage.legiarti, legiarti),
      )
      .orderBy(asc(referenceCoverage.source), asc(referenceCoverage.file)),
  ])

  const targetIds = [
    ...new Set(links.map((l) => l.targetId).filter((t): t is string => !!t && LEGIARTI_RE.test(t))),
  ]
  const known = targetIds.length
    ? new Set(
        (
          await db()
            .select({ id: legalArticle.id })
            .from(legalArticle)
            .where(inArray(legalArticle.id, targetIds))
        ).map((r) => r.id),
      )
    : new Set<string>()

  const byId = new Map(versions.map((v) => [v.id, v]))
  const allVersions: ArticleVersion[] = [...new Set([...versionIds, legiarti])].map((id) => {
    const v = byId.get(id) ?? (id === legiarti ? art : undefined)
    return {
      id,
      etat: v?.etat ?? null,
      dateDebut: v?.dateDebut ?? null,
      dateFin: v?.dateFin ?? null,
      inDb: !!v,
    }
  })
  allVersions.sort((x, y) => (y.dateDebut ?? '').localeCompare(x.dateDebut ?? '') || x.id.localeCompare(y.id))

  const crumbById = new Map(crumbRows.map((c) => [c.id, c]))
  return {
    id: art.id,
    num: art.num,
    etat: art.etat,
    type: art.type,
    dateDebut: art.dateDebut,
    dateFin: art.dateFin,
    contentHtml: art.contentHtml,
    notaHtml: art.notaHtml,
    textSha256: art.textSha256,
    updatedAt: ISO(art.updatedAt) as string,
    text: {
      id: art.textId,
      title: a.textTitle,
      short: a.textShort,
      code: CODE_KEYS.find((k) => CODES[k].id === art.textId) ?? null,
    },
    crumbs: sectionIds.map((id) => crumbById.get(id)).filter((c): c is Crumb => !!c),
    level: asLevel(a.level),
    flags: a.flags ?? [],
    levelUpdatedAt: ISO(a.levelUpdatedAt),
    versions: allVersions,
    links: links.slice(0, MAX_LINKS).map((l) => ({
      typeLien: l.typeLien,
      sens: l.sens,
      targetId: l.targetId,
      targetNum: l.targetNum,
      targetTextNum: l.targetTextNum,
      targetNature: l.targetNature,
      targetDate: l.targetDate,
      label: l.label,
      internal: !!l.targetId && known.has(l.targetId),
    })),
    linksTruncated: links.length > MAX_LINKS,
    coverage: coverage.map((c) => ({
      source: c.source,
      sourceCommit: c.sourceCommit,
      legiarti: c.legiarti,
      file: c.file,
      line: c.line,
      heading: c.heading,
    })),
  }
}

// ---------------------------------------------------------------------------
// Anomalies
// ---------------------------------------------------------------------------

const findingSummaryFields = {
  id: finding.id,
  type: finding.type,
  status: finding.status,
  claim: finding.claim,
  legalUnits: finding.legalUnits,
  qualification: sql<unknown>`${finding.certificate}->'qualification'`,
}

function findingSummary(
  row: Pick<typeof finding.$inferSelect, 'id' | 'type' | 'status' | 'claim' | 'legalUnits'>,
  stamp: unknown,
) {
  const type = FINDING_TYPES.find((t) => t === row.type)
  const qualification = findingQualification({ qualification: stamp })
  return {
    id: row.id,
    typeLabel: type ? FINDING_TYPE_LABEL[type] : row.type,
    status: row.status,
    claim: row.claim,
    articles: row.legalUnits.flatMap((unit) => {
      const article = findingArticle(unit)
      return article ? [article] : []
    }),
    qualification,
  }
}

/** Registre public, même filtre que le compteur d’accueil. */
export async function publicFindings(database = db()) {
  const rows = await database
    .select(findingSummaryFields)
    .from(finding)
    .where(publicFindingFilter)
    .orderBy(desc(sql<string>`${finding.certificate}->'qualification'->>'qualified_at'`), asc(finding.id))
  return rows.map((row) => findingSummary(row, row.qualification))
}

/** Cimetière : requête limitée aux rejets, puis contrôle du verdict et de sa provenance Git. */
export async function rejectedFindings(database = db()) {
  const rows = await database
    .select(findingSummaryFields)
    .from(finding)
    .where(rejectedFindingFilter)
    .orderBy(desc(sql<string>`${finding.certificate}->'qualification'->>'qualified_at'`), asc(finding.id))
  return rows.flatMap((row) => {
    const summary = findingSummary(row, row.qualification)
    return summary.qualification ? [{ ...summary, qualification: summary.qualification }] : []
  })
}

/** Certificat public ou rejet humain documenté. Les autres statuts sont traités comme absents. */
export async function findingDetail(id: string, database = db()) {
  if (!FINDING_ID_RE.test(id)) return null
  const [row] = await database
    .select()
    .from(finding)
    .where(and(eq(finding.id, id), or(publicFindingFilter, rejectedFindingFilter)))
    .limit(1)
  if (!row) return null

  const summary = findingSummary(row, row.certificate.qualification)
  const q = summary.qualification
  if (row.status === 'rejected' && (!q || qualifiedStatus(q.verdict) !== 'rejected')) return null

  return {
    ...summary,
    type: row.type,
    ...findingEvidence(row.certificate),
    certificate: JSON.stringify(row.certificate, null, 2),
    replay: typeof row.certificate.replay === 'string' ? row.certificate.replay : null,
  }
}

// ---------------------------------------------------------------------------
// Flux Atom
// ---------------------------------------------------------------------------

/** Événements publics pour /feed.atom (mêmes règles que le journal de l'accueil). */
export async function feedEvents(limit = 50): Promise<PublicEvent[]> {
  return latestEvents(limit)
}
