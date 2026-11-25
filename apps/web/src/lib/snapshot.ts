/**
 * Types partagés serveur/navigateur pour les compteurs publics (/, /api/snapshot.json, /api/stream).
 * Aucun nombre ici : tout est calculé par `lib/server/queries.ts`.
 */
import type { LevelCounts } from './levels.ts'

export interface CodeProgress {
  /** LEGITEXT du code. */
  id: string
  short: string
  title: string
  /** Vrai si au moins une version d'article de ce code est en base. */
  ingested: boolean
  /** Versions d'articles ingérées (toutes dates, tous états). */
  versions: number
  /** Articles en vigueur à la date de projection du code (`articleInForce()`). */
  inForce: number
  /** Répartition des articles en vigueur par niveau de preuve (sans statut = N0). */
  byLevel: LevelCounts
  /** Articles en vigueur au niveau N2 ou plus (★ compris). */
  atLeastN2: number
}

export interface PublicEvent {
  id: number
  ts: string
  type: string
  actor: string
  subject: string | null
  summary: string | null
}

export interface JournalEntry {
  id: number
  type: string
  events: { id: number; ts: string }[]
}

export interface ReferenceExample {
  id: string
  num: string | null
  codeTitle: string
  versionDate: string | null
  textHtml: string
  legifranceUrl: string
  sourceUrl: string
  title: string
  description: string
  tests: number
  replayDate: string
}

export interface RunInfo {
  id: number
  kind: string
  subject: string
  status: string
  startedAt: string
  finishedAt: string | null
}

export interface Snapshot {
  generatedAt: string
  /** Vrai si la base contient les données fictives de `scripts/seed-dev.ts`. */
  fictional: boolean
  codes: CodeProgress[]
  findings: { public: number; pendingReview: number }
  replications: { passed: number; total: number; last: RunInfo | null }
  coverage: { sources: number; cited: number; matched: number }
  events: PublicEvent[]
  journal: JournalEntry[]
  referenceExample: ReferenceExample | null
}
