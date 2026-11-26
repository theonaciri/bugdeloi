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
  FINDING_STATUSES,
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
  DESK_ROLES,
  deskTask,
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
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, or, type SQL, sql } from 'drizzle-orm'
import { journalGroupLabels } from '../events.ts'
import { asLevel, countAtLeast, emptyLevelCounts, type Level } from '../levels.ts'
import { MAP_WINDOW, type MapArticleRow, type MapCountRow, type MapSectionRow } from '../map-tree.ts'
import { sanitizeLegalHtml } from '../sanitize.ts'
import type {
  CodeProgress,
  DeskPublicStats,
  FindingPreview,
  JournalEntry,
  PipelineStats,
  PublicEvent,
  ReferenceExample,
  RunInfo,
  Snapshot,
  SuiteInfo,
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
  return value !== null && Object.hasOwn(CODES, value)
}

const ISO = (d: Date | string | null | undefined): string | null =>
  d == null ? null : d instanceof Date ? d.toISOString() : new Date(d).toISOString()

// ---------------------------------------------------------------------------
// Journal public
// ---------------------------------------------------------------------------

/** Filtre des événements publiables : tout sauf les anomalies non encore qualifiées. */
const publicEventFilter: SQL = sql`(${event.type} NOT LIKE 'finding.%' OR ${event.type} IN ('finding.qualified', 'finding.published'))`

const frInt = new Intl.NumberFormat('fr-FR')

function formatEventCopy(r: typeof event.$inferSelect): { headline: string; detail: string } {
  const p = r.payload
  const num = (k: string): number | null => (typeof p[k] === 'number' ? p[k] : null)

  if (r.type === 'reference.promoted') {
    const promoted = num('promoted')
    const demoted = num('demoted')
    if (promoted !== null && demoted !== null && demoted > 0) {
      return {
        headline: `Audit des étoiles ★ : ${frInt.format(promoted)} articles confirmés, ${frInt.format(demoted)} retirés`,
        detail: `${frInt.format(demoted)} articles cités par Inria mais sans code effectif ont été retirés ; ${frInt.format(promoted)} articles en vigueur restent couverts par des tests réussis.`,
      }
    }
    if (promoted !== null) {
      return {
        headline: `${frInt.format(promoted)} articles en vigueur reliés aux programmes Inria`,
        detail:
          'Chaque étoile ★ indique un article couvert par un programme de recherche dont les tests passent chez nous.',
      }
    }
  }

  if (r.type === 'reproduction.finished') {
    const confirmed = num('confirmé')
    const refuted = num('infirmé')
    const undetermined = num('indéterminé')
    const isDila = r.subject?.startsWith('c0.2-dila-xml')
    const isTricoteuses = r.subject?.startsWith('c0.2-independent')
    if (confirmed !== null && refuted !== null) {
      if (isDila) {
        return {
          headline: `${frInt.format(confirmed)} renvois vers des articles abrogés confirmés sur les archives officielles`,
          detail: `Vérification croisée sur les fichiers XML bruts de Légifrance : ${frInt.format(confirmed)} confirmés, ${frInt.format(refuted)} infirmé${refuted > 1 ? 's' : ''}${undetermined ? `, ${frInt.format(undetermined)} indéterminés` : ''}.`,
        }
      }
      if (isTricoteuses) {
        return {
          headline: `${frInt.format(confirmed)} fautes de ponctuation confirmées, ${frInt.format(refuted)} faux signalements écartés`,
          detail: `Vérification croisée sur « La loi sous git » : les ${frInt.format(confirmed)} défauts typographiques sont confirmés et ${frInt.format(refuted)} erreurs de nos détecteurs ont été retirées.`,
        }
      }
      return {
        headline: `Vérification indépendante : ${frInt.format(confirmed)} confirmés, ${frInt.format(refuted)} écartés`,
        detail: undetermined
          ? `${frInt.format(undetermined)} cas restent indéterminés sur cette source.`
          : 'Contrôle croisé terminé sur des données traitées séparément.',
      }
    }
  }

  if (r.type === 'sweep.finished') {
    const checked = p.articlesChecked
    if (checked && typeof checked === 'object' && !Array.isArray(checked)) {
      const rec = checked as Record<string, unknown>
      const cgi = typeof rec.CGI === 'number' ? rec.CGI : null
      const css = typeof rec.CSS === 'number' ? rec.CSS : null
      const cch = typeof rec.CCH === 'number' ? rec.CCH : null
      const total = [cgi, css, cch].reduce<number>((sum, v) => sum + (v ?? 0), 0)
      if (total > 0) {
        const parts = [
          cgi !== null ? `Impôts (${frInt.format(cgi)})` : null,
          css !== null ? `Sécurité sociale (${frInt.format(css)})` : null,
          cch !== null ? `Logement (${frInt.format(cch)})` : null,
        ].filter(Boolean)
        return {
          headline: `${frInt.format(total)} articles en vigueur passés au crible`,
          detail: `Contrôle automatique des renvois abrogés et de la typographie : ${parts.join(', ')}.`,
        }
      }
    }
  }

  if (r.type === 'replication.finished') {
    const runs = Array.isArray(p.runs) ? p.runs : []
    const passed = runs.filter(
      (item) => item && typeof item === 'object' && (item as Record<string, unknown>).status === 'passed',
    ).length
    if (runs.length > 0) {
      return {
        headline: `Programmes Inria vérifiés : ${frInt.format(passed)} suites exécutées avec succès`,
        detail: 'Exécution des suites de tests officielles dans notre environnement Catala 1.3.2.',
      }
    }
  }

  if (r.type === 'ingest.finished') {
    const archive = typeof p.archive === 'string' ? p.archive : null
    return {
      headline: 'Mise à jour des textes officiels de loi',
      detail: archive
        ? `Lot officiel Légifrance chargé (${archive}).`
        : 'Nouvelles versions d’articles chargées depuis la base officielle.',
    }
  }

  if (r.type === 'finding.qualified' && r.subject) {
    return {
      headline: `Anomalie ${r.subject} validée par un juriste`,
      detail: 'Verdict motivé enregistré et consultable dans le registre public.',
    }
  }

  if (r.type === 'finding.published' && r.subject) {
    return {
      headline: `Anomalie ${r.subject} publiée au registre`,
      detail: 'Constat reproduit, validé par un humain et accompagné de son certificat.',
    }
  }

  return {
    headline:
      r.type !== 'reproduction.finished' && typeof p.summary === 'string'
        ? p.summary
        : 'Mise à jour enregistrée dans le journal',
    detail: 'Consultez la fiche pour voir les données et la provenance complète.',
  }
}

function publicEvent(r: typeof event.$inferSelect): PublicEvent {
  const { headline, detail } = formatEventCopy(r)
  return {
    id: r.id,
    ts: r.ts.toISOString(),
    type: r.type,
    actor: r.actor,
    subject: r.subject,
    summary:
      r.type !== 'reproduction.finished' && typeof r.payload.summary === 'string' ? r.payload.summary : null,
    headline,
    detail,
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
  const rows = await db()
    .select({
      id: sql<number>`max(${event.id})`.mapWith(Number),
      type: event.type,
      events: sql<
        { id: number; ts: string; subject: string | null; payload: Record<string, unknown> }[]
      >`jsonb_agg(jsonb_build_object('id', ${event.id}, 'ts', ${event.ts}, 'subject', ${event.subject}, 'payload', ${event.payload}) order by ${event.ts} desc, ${event.id} desc)`,
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

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    events: row.events.map((ev) => {
      const { headline, detail } = formatEventCopy({
        type: row.type,
        subject: ev.subject,
        payload: ev.payload ?? {},
      } as typeof event.$inferSelect)
      return { id: ev.id, ts: ev.ts, headline, detail }
    }),
  }))
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

// Le compte exact parcourt l’index entier. Les instantanés simultanés partagent le calcul.
let linkCount: { expiresAt: number; result: Promise<number> } | undefined

function legalLinkCount(): Promise<number> {
  if (linkCount && Date.now() < linkCount.expiresAt) return linkCount.result
  const result = db()
    .select({ total: count() })
    .from(legalLink)
    .then(([row]) => row?.total ?? 0)
    .catch((error: unknown) => {
      if (linkCount?.result === result) linkCount = undefined
      throw error
    })
  linkCount = { expiresAt: Date.now() + 5_000, result }
  return result
}

/** Dernier balayage abouti, inventaire des liens et état de chaque constat dans le registre de travail. */
async function pipelineStats(): Promise<PipelineStats> {
  const [runs, links, counts] = await Promise.all([
    db()
      .select({
        id: sweepRun.id,
        finishedAt: sweepRun.finishedAt,
        articlesChecked: sweepRun.articlesChecked,
        detectors: sweepRun.detectors,
      })
      .from(sweepRun)
      .where(eq(sweepRun.status, 'success'))
      .orderBy(desc(sweepRun.startedAt), desc(sweepRun.id))
      .limit(1),
    legalLinkCount(),
    db()
      .select({ status: finding.status, type: finding.type, total: count() })
      .from(finding)
      .groupBy(finding.status, finding.type),
  ])
  const latest = runs[0]
  const totalFor = (status: string) =>
    counts.reduce((total, row) => total + (row.status === status ? row.total : 0), 0)

  return {
    articlesChecked: Object.values(latest?.articlesChecked ?? {}).reduce((total, n) => total + n, 0),
    linksTotal: links,
    reproducedByType: Object.fromEntries(
      counts.filter(({ status }) => status === 'reproduced').map(({ type, total }) => [type, total]),
    ),
    candidateCount: totalFor('candidate'),
    reproducedCount: totalFor('reproduced'),
    withdrawnCount: totalFor('withdrawn'),
    rejectedCount: totalFor('rejected'),
    qualifiedCount: totalFor('qualified'),
    publishedCount: totalFor('published'),
    lastSweepAt: ISO(latest?.finishedAt),
    lastSweepId: latest?.id ?? null,
    detectors: latest?.detectors ?? {},
  }
}

function nonnegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

/** Dernier rejeu C0.1 terminé par sujet, y compris les suites sans test. */
async function referenceSuites(): Promise<SuiteInfo[]> {
  const rows = await db()
    .selectDistinctOn([replicationRun.subject], {
      subject: replicationRun.subject,
      status: replicationRun.status,
      summary: replicationRun.summary,
      catalaVersion: replicationRun.catalaVersion,
      imageDigest: replicationRun.imageDigest,
      finishedAt: replicationRun.finishedAt,
    })
    .from(replicationRun)
    .where(and(eq(replicationRun.kind, 'C0.1-inria-replay'), sql`${replicationRun.status} <> 'running'`))
    .orderBy(replicationRun.subject, desc(replicationRun.startedAt), desc(replicationRun.id))
  return rows.map(({ summary, finishedAt, ...row }) => ({
    ...row,
    folder:
      typeof summary?.folder === 'string' && summary.folder
        ? summary.folder
        : (row.subject.split('/').at(-1) ?? ''),
    tests: nonnegativeInteger(summary?.tests) ?? 0,
    passed: nonnegativeInteger(summary?.passed) ?? 0,
    failed: nonnegativeInteger(summary?.failed) ?? 0,
    durationMs: nonnegativeInteger(summary?.durationMs),
    finishedAt: ISO(finishedAt),
  }))
}

/** Une tâche est disponible si elle n'est ni terminée ni couverte par un bail actif. */
async function deskPublicStats(): Promise<DeskPublicStats> {
  const active = sql`(${deskTask.completedAt} is null and coalesce(${deskTask.leaseExpiresAt} > statement_timestamp(), false))`
  const [roles, recent] = await Promise.all([
    db()
      .select({
        role: deskTask.role,
        open: sql<number>`count(*) filter (where ${deskTask.completedAt} is null and not ${active})`.mapWith(
          Number,
        ),
        active: sql<number>`count(*) filter (where ${active})`.mapWith(Number),
        completed: sql<number>`count(${deskTask.completedAt})`.mapWith(Number),
      })
      .from(deskTask)
      .groupBy(deskTask.role),
    db()
      .select({
        taskId: deskTask.id,
        payload: deskTask.payload,
        role: deskTask.role,
        handle: deskTask.leaseHandle,
        family: deskTask.leaseFamily,
        startedAt: deskTask.leaseStartedAt,
        expiresAt: deskTask.leaseExpiresAt,
        active: sql<boolean>`${active}`,
      })
      .from(deskTask)
      .where(and(isNotNull(deskTask.leaseHandle), isNotNull(deskTask.leaseStartedAt)))
      .orderBy(desc(deskTask.leaseStartedAt), asc(deskTask.role), asc(deskTask.leaseHandle))
      .limit(20),
  ])
  return {
    enabled: process.env.DESK_ENABLED === '1',
    open: roles.reduce((total, row) => total + row.open, 0),
    activeLeases: roles.reduce((total, row) => total + row.active, 0),
    completed: roles.reduce((total, row) => total + row.completed, 0),
    byRole: Object.fromEntries(
      DESK_ROLES.map((role) => {
        const row = roles.find((row) => row.role === role)
        return [role, { open: row?.open ?? 0, active: row?.active ?? 0, completed: row?.completed ?? 0 }]
      }),
    ),
    recentHandles: recent.flatMap(({ handle, startedAt, expiresAt, payload, ...row }) => {
      if (!handle || !startedAt) return []
      const firstUnit = payload?.legal_units?.[0]
      const legiarti = typeof firstUnit?.legiarti === 'string' ? firstUnit.legiarti : null
      const node = typeof payload?.node === 'string' ? payload.node : null
      return [
        {
          ...row,
          node,
          legiarti,
          handle,
          startedAt: startedAt.toISOString(),
          expiresAt: expiresAt ? expiresAt.toISOString() : null,
        },
      ]
    }),
  }
}

/** Événements du journal pendant les 14 jours civils à Paris, jour courant compris. */
async function publicActivity(): Promise<Snapshot['activitySeries']> {
  const day = sql<string>`to_char(${event.ts} at time zone 'Europe/Paris', 'YYYY-MM-DD')`
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', dateStyle: 'short' }).format(
    new Date(),
  )
  const rows = await db()
    .select({ day, count: count() })
    .from(event)
    .where(
      and(
        publicEventFilter,
        sql`
      ${event.ts} >= ((${today}::date - 13)::timestamp at time zone 'Europe/Paris')
      and ${event.ts} < ((${today}::date + 1)::timestamp at time zone 'Europe/Paris')
    `,
      ),
    )
    .groupBy(day)
  const byDay = new Map(rows.map((row) => [row.day, row.count]))
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today)
    date.setUTCDate(date.getUTCDate() + index - 13)
    const day = date.toISOString().slice(0, 10)
    return { day, count: byDay.get(day) ?? 0 }
  })
}

/** Instantané complet de l'accueil (servi aussi par /api/snapshot.json et /api/stream). */
export async function snapshot(): Promise<Snapshot> {
  const [
    codes,
    replications,
    coverage,
    events,
    journal,
    example,
    fictional,
    pipeline,
    suites,
    desk,
    activitySeries,
    reproducedPreview,
  ] = await Promise.all([
    codeProgress(),
    replicationStats(),
    coverageStats(),
    latestEvents(10),
    journalEntries(3),
    referenceExample(),
    hasFictionalData(),
    pipelineStats(),
    referenceSuites(),
    deskPublicStats(),
    publicActivity(),
    reproducedPreviews(),
  ])
  return {
    generatedAt: new Date().toISOString(),
    fictional,
    codes,
    findings: {
      public: pipeline.qualifiedCount + pipeline.publishedCount,
      pendingReview: pipeline.candidateCount + pipeline.reproducedCount,
    },
    replications,
    coverage,
    events,
    journal,
    referenceExample: example,
    pipeline,
    suites,
    desk,
    activitySeries,
    reproducedPreview,
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
  contentText: string
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
    contentText: art.contentText,
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

export const FINDINGS_NOTE = 'Les statuts candidate et reproduced ne sont pas qualifiés par un humain.'
export const SEARCH_QUERY_MAX = 200
export const SEARCH_LIMIT_MAX = 25
export const FINDINGS_LIMIT_MAX = 100
export const FINDINGS_OFFSET_MAX = 2_147_483_647

export function isSearchQuery(query: unknown): query is string {
  return (
    typeof query === 'string' &&
    query.length <= SEARCH_QUERY_MAX &&
    !!query.trim() &&
    !query.includes('\u0000')
  )
}

export function isFindingStatus(status: unknown) {
  return FINDING_STATUSES.some((value) => value === status)
}

export function isFindingType(type: unknown) {
  return FINDING_TYPES.some((value) => value === type)
}

const previewFields = {
  id: finding.id,
  type: finding.type,
  status: finding.status,
  claim: finding.claim,
  detector: finding.detector,
  legalUnits: finding.legalUnits,
  proof: sql<unknown>`${finding.certificate}->'proof'`,
  reproduction: sql<unknown>`${finding.certificate}->'independent_reproduction'`,
  reproductionDila: sql<unknown>`${finding.certificate}->'independent_reproduction_dila_xml'`,
  articleCode: legalText.shortTitle,
  articleNum: legalArticle.num,
}

const previewArticleId = sql<string>`split_part(${finding.legalUnits}[1], '@', 1)`
const previewSourceCode = sql<string>`coalesce(
  ${finding.certificate} #>> '{proof,source,code}',
  ${finding.certificate} #>> '{proof,versions,0,code}'
)`

function findingPreviewQuery(database = db()) {
  return database
    .select(previewFields)
    .from(finding)
    .leftJoin(legalArticle, eq(legalArticle.id, previewArticleId))
    .leftJoin(legalText, eq(legalText.id, legalArticle.textId))
}

type FindingPreviewRow = Awaited<ReturnType<typeof findingPreviewQuery>>[number]

/** La seconde reproduction C0.2, à partir des XML DILA, complète le premier contrôle. */
function workingEvidence(certificate: Record<string, unknown>) {
  const dila = findingEvidence({ independent_reproduction: certificate.independent_reproduction_dila_xml })
  const evidence = findingEvidence(certificate)
  return typeof dila.reproduction.verdict === 'string'
    ? { ...evidence, reproduction: dila.reproduction }
    : evidence
}

function findingPreview(row: FindingPreviewRow): FindingPreview {
  const type = FINDING_TYPES.find((type) => type === row.type)
  const { source, excerpts, reproduction } = workingEvidence({
    proof: row.proof,
    independent_reproduction: row.reproduction,
    independent_reproduction_dila_xml: row.reproductionDila,
  })
  const unit = findingArticle(row.legalUnits[0] ?? '')
  const firstArticle = source?.id === unit?.id || !source
  return {
    id: row.id,
    type: row.type,
    typeLabel: type ? FINDING_TYPE_LABEL[type] : row.type,
    status: row.status,
    claim: row.claim,
    detector: row.detector,
    articleId: source?.id ?? unit?.id ?? null,
    articleCode: source?.code ?? (firstArticle ? row.articleCode : null),
    articleNum: source?.num ?? (firstArticle ? row.articleNum : null),
    excerpt: excerpts[0] ?? null,
    reproductionSource: typeof reproduction.source === 'string' ? reproduction.source : null,
    reproductionVerdict: typeof reproduction.verdict === 'string' ? reproduction.verdict : null,
    humanQualified: PUBLIC_FINDING_STATUSES.some((status) => status === row.status),
  }
}

function findingCodeFilter(code: CodeKey | undefined) {
  if (!code) return undefined
  return or(eq(legalArticle.textId, CODES[code].id), eq(previewSourceCode, code))
}

async function reproducedPreviews(): Promise<FindingPreview[]> {
  const priority = ['SYNTAXE', 'REF_MORTE']
  const grouped = await Promise.all(
    priority.map((type) =>
      findingPreviewQuery()
        .where(and(eq(finding.status, 'reproduced'), eq(finding.type, type)))
        .orderBy(asc(finding.id))
        .limit(6),
    ),
  )
  const rows = grouped.flat()
  if (rows.length < 12) {
    const others = await findingPreviewQuery()
      .where(and(eq(finding.status, 'reproduced'), sql`not ${inArray(finding.type, priority)}`))
      .orderBy(asc(finding.id))
      .limit(12 - rows.length)
    rows.push(...others)
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id)).map(findingPreview)
}

export interface WorkingFindingsOptions {
  status?: string
  type?: string
  code?: string
  limit?: number
  offset?: number
}

/** Registre de travail. Les statuts exposés ici ne changent ni le registre public ni le cimetière. */
export async function workingFindings(
  { status = 'reproduced', type, code, limit = 20, offset = 0 }: WorkingFindingsOptions = {},
  database = db(),
): Promise<{ total: number; items: FindingPreview[] }> {
  if (
    !isFindingStatus(status) ||
    (type !== undefined && !isFindingType(type)) ||
    (code !== undefined && !isCodeKey(code)) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > FINDINGS_LIMIT_MAX ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > FINDINGS_OFFSET_MAX
  )
    throw new RangeError('Filtres de constats invalides')

  const filter = and(
    eq(finding.status, status),
    type === undefined ? undefined : eq(finding.type, type),
    findingCodeFilter(code && isCodeKey(code) ? code : undefined),
  )
  const [rows, totals] = await Promise.all([
    findingPreviewQuery(database).where(filter).orderBy(asc(finding.id)).limit(limit).offset(offset),
    database
      .select({ total: count() })
      .from(finding)
      .leftJoin(legalArticle, eq(legalArticle.id, previewArticleId))
      .where(filter),
  ])
  return { total: totals[0]?.total ?? 0, items: rows.map(findingPreview) }
}

/** Recherche de versions en vigueur et de constats reproduits ou qualifiés. Les extraits sont en texte brut. */
export async function searchCatalog(
  query: string,
  { code, limit = 10 }: { code?: CodeKey; limit?: number } = {},
) {
  if (
    !isSearchQuery(query) ||
    (code !== undefined && !isCodeKey(code)) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > SEARCH_LIMIT_MAX
  ) {
    throw new RangeError('Paramètres de recherche invalides')
  }
  query = query.trim()
  const term = sql`websearch_to_tsquery('french', ${query})`
  const exactId = eq(legalArticle.id, query.toUpperCase())
  const exactNum = sql`lower(${legalArticle.num}) = lower(${query})`
  const numPrefix = sql`starts_with(lower(${legalArticle.num}), lower(${query}))`
  const fullText = sql`${legalArticle.search} @@ ${term}`
  const exactFinding = eq(finding.id, query.toUpperCase())
  const claimPattern = `%${query.replace(/[\\%_]/gu, '\\$&')}%`
  const [articles, findings] = await Promise.all([
    db()
      .select({
        id: legalArticle.id,
        num: legalArticle.num,
        code: legalText.shortTitle,
        codeTitle: legalText.title,
        dateDebut: legalArticle.dateDebut,
        level: articleStatus.level,
        snippet: sql<string>`ts_headline('french', ${legalArticle.contentText}, ${term},
          'StartSel=«, StopSel=», MaxWords=32, MinWords=12, MaxFragments=1')`,
      })
      .from(legalArticle)
      .innerJoin(legalText, eq(legalText.id, legalArticle.textId))
      .leftJoin(articleStatus, eq(articleStatus.articleId, legalArticle.id))
      .where(
        and(
          articleInForce(),
          code ? eq(legalArticle.textId, CODES[code].id) : undefined,
          or(exactId, exactNum, numPrefix, fullText),
        ),
      )
      .orderBy(
        desc(sql`case when ${exactId} then 3 when ${exactNum} then 2 when ${numPrefix} then 1 else 0 end`),
        desc(sql`ts_rank(${legalArticle.search}, ${term})`),
        asc(legalArticle.id),
      )
      .limit(limit),
    findingPreviewQuery()
      .where(
        and(
          inArray(finding.status, ['reproduced', ...PUBLIC_FINDING_STATUSES]),
          findingCodeFilter(code),
          or(exactFinding, ilike(finding.claim, claimPattern)),
        ),
      )
      .orderBy(desc(exactFinding), asc(finding.id))
      .limit(limit),
  ])

  return {
    query,
    articles: articles.map((row) => ({
      ...row,
      level: asLevel(row.level),
      url: legifranceArticleUrl(row.id),
    })),
    findings: findings.map(findingPreview),
  }
}

/** Certificat de travail, constat qualifié ou rejet humain documenté. */
export async function findingDetail(id: string, database = db()) {
  if (!FINDING_ID_RE.test(id)) return null
  const [row] = await database
    .select()
    .from(finding)
    .where(
      and(
        eq(finding.id, id),
        or(inArray(finding.status, ['candidate', 'reproduced']), publicFindingFilter, rejectedFindingFilter),
      ),
    )
    .limit(1)
  if (!row) return null

  const preQualification = row.status === 'candidate' || row.status === 'reproduced'
  const summary = findingSummary(row, preQualification ? null : row.certificate.qualification)
  const q = summary.qualification
  if (row.status === 'rejected' && (!q || qualifiedStatus(q.verdict) !== 'rejected')) return null

  return {
    ...summary,
    type: row.type,
    humanQualified: PUBLIC_FINDING_STATUSES.some((status) => status === row.status),
    ...workingEvidence(row.certificate),
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
