/**
 * Schéma Postgres de BugDeLoi — contrat partagé entre ingestion, worker et web.
 * Postgres est l'établi de travail et un index dérivé : tout doit pouvoir être reconstruit
 * depuis DILA + Git (docs/PLAN.md §5). Les tables `event` et `finding` sont publiques et
 * append-only dans l'esprit (on ajoute, on ne réécrit pas l'historique).
 */
import { sql } from 'drizzle-orm'
import {
  bigserial,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/** Type `ltree` (extension Postgres) : chemin hiérarchique code › livre › titre › … */
export const ltree = customType<{ data: string }>({
  dataType: () => 'ltree',
})

/** Type `tsvector` pour la recherche plein texte (configuration `french`). */
const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
})

// ---------------------------------------------------------------------------
// Ingestion DILA
// ---------------------------------------------------------------------------

export const ingestRun = pgTable('ingest_run', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  source: text('source').notNull(), // ex. 'LEGI'
  archive: text('archive').notNull(), // ex. 'Freemium_legi_global_20261108-140000.tar.gz'
  archiveSha256: text('archive_sha256'),
  scope: text('scope').array().notNull().default(sql`'{}'::text[]`), // LEGITEXT ingérés
  asOf: date('as_of'), // date de projection de l’arbre LEGI
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: text('status').notNull().default('running'), // running | success | failed
  stats: jsonb('stats').$type<Record<string, number>>().notNull().default({}),
  error: text('error'),
})

/** Un texte LEGI (un code, une loi). */
export const legalText = pgTable('legal_text', {
  id: text('id').primaryKey(), // LEGITEXT…
  title: text('title').notNull(),
  shortTitle: text('short_title'), // ex. 'CGI'
  nature: text('nature'), // CODE, LOI, DECRET…
  etat: text('etat'),
  dateDebut: date('date_debut'),
  dateFin: date('date_fin'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Dernier lot DILA appliqué par code, avancé dans la même transaction que son contenu. */
export const legiState = pgTable('legi_state', {
  textId: text('text_id')
    .primaryKey()
    .references(() => legalText.id),
  archive: text('archive').notNull(),
  archiveSha256: text('archive_sha256').notNull(),
  asOf: date('as_of').notNull(),
})

export type LegiChild = {
  kind: 'article' | 'section'
  id: string
  etat: string | null
  dateDebut: string | null
  dateFin: string | null
  title: string | null
}

/** Documents de structure LEGI, y compris les sections hors de l'arbre projeté. */
export const legiStructure = pgTable(
  'legi_structure',
  {
    textId: text('text_id')
      .notNull()
      .references(() => legalText.id),
    id: text('id').notNull(), // LEGITEXT pour le document racine, LEGISCTA pour une section
    title: text('title'),
    children: jsonb('children').$type<LegiChild[]>().notNull().default([]),
  },
  (t) => [primaryKey({ columns: [t.textId, t.id] })],
)

/**
 * Section (LEGISCTA) dans l'arbre en vigueur à la date d'ingestion.
 * `path` = <LEGITEXT>.<LEGISCTA>.<LEGISCTA>… (labels ltree valides : alphanumériques).
 */
export const legalSection = pgTable(
  'legal_section',
  {
    id: text('id').primaryKey(), // LEGISCTA…
    textId: text('text_id')
      .notNull()
      .references(() => legalText.id),
    parentId: text('parent_id'), // null = racine du texte
    path: ltree('path').notNull(),
    depth: integer('depth').notNull(),
    position: integer('position').notNull().default(0), // ordre parmi les frères
    title: text('title').notNull(),
    etat: text('etat'),
    dateDebut: date('date_debut'),
    dateFin: date('date_fin'),
    lastRunId: integer('last_run_id'),
  },
  (t) => [
    index('legal_section_path_gist').using('gist', t.path),
    index('legal_section_text_idx').on(t.textId),
    index('legal_section_parent_idx').on(t.parentId),
  ],
)

/** Une version d'article (chaque LEGIARTI est une version datée). */
export const legalArticle = pgTable(
  'legal_article',
  {
    id: text('id').primaryKey(), // LEGIARTI…
    textId: text('text_id')
      .notNull()
      .references(() => legalText.id),
    sectionId: text('section_id'), // section parente dans l'arbre en vigueur (null si hors arbre)
    num: text('num'), // ex. '197', 'L521-1'
    /** Regroupe les versions d'un même article : `<LEGITEXT>:<num>`. */
    articleKey: text('article_key'),
    etat: text('etat'), // VIGUEUR, ABROGE, MODIFIE, VIGUEUR_DIFF, …
    type: text('type'), // AUTONOME, ENTIEREMENT_MODIF, …
    dateDebut: date('date_debut'),
    dateFin: date('date_fin'), // 2999-01-01 = sans fin connue (convention DILA)
    position: integer('position').notNull().default(0),
    contentHtml: text('content_html').notNull().default(''),
    /** Texte normalisé par `normalizeLegalText` (@bugdeloi/core). */
    contentText: text('content_text').notNull().default(''),
    /** sha256 de `contentText` : base du contrôle N1. */
    textSha256: text('text_sha256').notNull(),
    notaHtml: text('nota_html'),
    /** Identifiants LEGIARTI de toutes les versions connues de cet article (bloc VERSIONS). */
    versionIds: text('version_ids').array().notNull().default(sql`'{}'::text[]`),
    search: tsvector('search').generatedAlwaysAs(
      sql`to_tsvector('french', coalesce(num, '') || ' ' || content_text)`,
    ),
    lastRunId: integer('last_run_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('legal_article_text_num_idx').on(t.textId, t.num),
    index('legal_article_section_idx').on(t.sectionId),
    index('legal_article_key_idx').on(t.articleKey),
    index('legal_article_etat_idx').on(t.etat),
    index('legal_article_search_gin').using('gin', t.search),
  ],
)

/** Lien LEGI d'un article vers un autre texte/article (bloc LIENS). */
export const legalLink = pgTable(
  'legal_link',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    articleId: text('article_id')
      .notNull()
      .references(() => legalArticle.id, { onDelete: 'cascade' }),
    typeLien: text('type_lien').notNull(), // CITATION, MODIFIE, CREE, ABROGE, CODIFIE, …
    sens: text('sens').notNull(), // 'source' | 'cible'
    targetId: text('target_id'), // LEGIARTI / LEGITEXT / JORFTEXT / …
    targetCid: text('target_cid'), // cidtexte
    targetNum: text('target_num'), // numéro d'article cité
    targetTextNum: text('target_text_num'), // numtexte
    targetNature: text('target_nature'),
    targetNor: text('target_nor'), // nortexte
    targetDate: date('target_date'), // datesignatexte
    label: text('label'), // contenu textuel du lien
  },
  (t) => [index('legal_link_article_idx').on(t.articleId), index('legal_link_target_idx').on(t.targetId)],
)

// ---------------------------------------------------------------------------
// Formalisation et preuve
// ---------------------------------------------------------------------------

/**
 * Niveau de preuve courant d'un article (clé = LEGIARTI). Niveaux et drapeaux : @bugdeloi/core.
 * `evidence` résume les contrôles qui justifient le niveau (liens vers certificats et runs CI).
 */
export const articleStatus = pgTable(
  'article_status',
  {
    articleId: text('article_id')
      .primaryKey()
      .references(() => legalArticle.id, { onDelete: 'cascade' }),
    level: text('level').notNull().default('N0'),
    flags: text('flags').array().notNull().default(sql`'{}'::text[]`),
    evidence: jsonb('evidence').$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('article_status_level_idx').on(t.level)],
)

/**
 * Couverture par une formalisation de référence externe (ex. catala-examples d'Inria).
 * Distincte d'`article_status` : couvrir un article ne vaut ★ que si la suite de tests est rejouée.
 */
export const referenceCoverage = pgTable(
  'reference_coverage',
  {
    source: text('source').notNull(), // ex. 'inria/catala-examples'
    sourceCommit: text('source_commit').notNull(),
    legiarti: text('legiarti').notNull(), // tel que cité par la source (peut être une ancienne version)
    file: text('file').notNull(), // chemin dans la source
    line: integer('line'),
    heading: text('heading'),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.source, t.legiarti, t.file] }),
    index('reference_coverage_legiarti_idx').on(t.legiarti),
  ],
)

/** Rejeu d'une suite de tests de référence (C0.1) ou de tout harness d'étalonnage. */
export const replicationRun = pgTable('replication_run', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  kind: text('kind').notNull(), // 'C0.1-inria-replay', 'C0.3-blind-af', …
  subject: text('subject').notNull(), // ex. 'catala-examples@<sha>/allocations_familiales'
  catalaVersion: text('catala_version'),
  imageDigest: text('image_digest'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: text('status').notNull().default('running'), // running | passed | failed | error
  summary: jsonb('summary').$type<Record<string, unknown>>().notNull().default({}),
  logUrl: text('log_url'),
})

/**
 * Balayage mécanique (C0.2, `@bugdeloi/sweep`) : un lancement des détecteurs déterministes.
 * Distinct de `replication_run` (rejeux de référence) pour ne pas mêler deux natures de contrôle.
 * `stats` contient des dénombrements de candidats **non qualifiés** : le site public ne le lit jamais
 * (il n'affiche que date, détecteurs, périmètre et nombre d'articles contrôlés).
 */
export const sweepRun = pgTable(
  'sweep_run',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    status: text('status').notNull().default('running'), // running | success | failed
    codes: text('codes').array().notNull().default(sql`'{}'::text[]`), // sigles balayés (CGI, CSS, CCH)
    detectors: jsonb('detectors').$type<Record<string, string>>().notNull().default({}), // nom → version
    /** code → date de projection (`legi_state.as_of`) au moment du balayage. */
    asOf: jsonb('as_of').$type<Record<string, string>>().notNull().default({}),
    /** code → { archive, sha256 } : dernier lot DILA appliqué au moment du balayage. */
    archives: jsonb('archives')
      .$type<Record<string, { archive: string; sha256: string }>>()
      .notNull()
      .default({}),
    /** code → nombre de versions en vigueur contrôlées. */
    articlesChecked: jsonb('articles_checked').$type<Record<string, number>>().notNull().default({}),
    stats: jsonb('stats').$type<Record<string, unknown>>().notNull().default({}),
    durationMs: integer('duration_ms'),
    error: text('error'),
  },
  (t) => [index('sweep_run_started_idx').on(t.startedAt)],
)

/** Anomalie (finding). Types et statuts : @bugdeloi/core, définitions AGENTS.md §4.4. */
export const finding = pgTable(
  'finding',
  {
    id: text('id').primaryKey(), // F-2026-0001
    type: text('type').notNull(),
    status: text('status').notNull().default('candidate'),
    claim: text('claim').notNull(),
    legalUnits: text('legal_units').array().notNull().default(sql`'{}'::text[]`),
    certificate: jsonb('certificate').$type<Record<string, unknown>>().notNull(),
    detector: text('detector').notNull(), // nom@version du détecteur
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('finding_type_status_idx').on(t.type, t.status)],
)

/** Journal public append-only : alimente le flux temps réel, les histogrammes et /feed.atom. */
export const event = pgTable(
  'event',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
    type: text('type').notNull(), // ex. 'ingest.finished', 'replication.passed', 'finding.candidate'
    actor: text('actor').notNull(), // 'system:ingest', 'github:<handle>', …
    subject: text('subject'), // id concerné (LEGIARTI, finding, run…)
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index('event_ts_brin').using('brin', t.ts), index('event_type_idx').on(t.type)],
)

/** Clé de dédoublonnage pour les findings détectés automatiquement. */
export const findingFingerprint = pgTable(
  'finding_fingerprint',
  {
    fingerprint: text('fingerprint').notNull(),
    findingId: text('finding_id')
      .notNull()
      .references(() => finding.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('finding_fingerprint_uq').on(t.fingerprint)],
)

export const DESK_ROLES = [
  'analyst',
  'translate',
  'oracle',
  'redteam',
  'backtranslate',
  'judge',
  'doctrine',
  'reduce',
] as const

export const DESK_FAMILIES = [
  'anthropic',
  'openai',
  'google',
  'mistral',
  'meta',
  'deepseek',
  'qwen',
  'local-autre',
  'humain',
] as const

export const DESK_RELEASE_REASONS = [
  'submitted',
  'text_mismatch',
  'ambiguous_text',
  'missing_dependency',
  'interface_too_weak',
  'needs_reduction',
  'out_of_time',
  'other',
] as const

export type DeskTaskPayload = {
  node: string
  legal_units: {
    legiarti: string
    date_debut: string
    date_fin: string | null
    text: string
    text_sha256: string
    source_url: string
  }[]
  interface: string | null
  context_pack: { objective: string; code_title: string; article_number: string | null }
  blind_to: string[]
  allowed_paths: string[]
}

/** Une ligne par tâche et au plus un bail actif. Le client seul reçoit l'identifiant brut du bail. */
export const deskTask = pgTable(
  'desk_task',
  {
    id: text('id').primaryKey(),
    role: text('role', { enum: DESK_ROLES }).notNull(),
    payload: jsonb('payload').$type<DeskTaskPayload>().notNull(),
    leaseDigest: text('lease_digest').unique(),
    leaseHandle: text('lease_handle'),
    leaseFamily: text('lease_family', { enum: DESK_FAMILIES }),
    leaseStartedAt: timestamp('lease_started_at', { withTimezone: true }),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
    releaseReason: text('release_reason', { enum: DESK_RELEASE_REASONS }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [index('desk_task_open_idx').on(t.role, t.id).where(sql`${t.completedAt} is null`)],
)
