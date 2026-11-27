/**
 * Le travail sur le corpus, vu depuis le guichet : tâches à prendre, parcours d'une tâche,
 * tableau par étape. Lecture seule ; chaque compte est documenté sur /methode#compteurs.
 *
 * Règles (AGENTS.md §6) :
 * - une tâche = un rôle × un article ; son identifiant est `analyst-<LEGIARTI>` ou
 *   `translate-<LEGIARTI>-<vN>` ;
 * - **à prendre** : le guichet la donnerait maintenant (jamais réservée, ou rendue, ou bail expiré,
 *   et texte toujours identique à LEGI) ;
 * - **en cours** : bail actif ;
 * - **en relecture** : déposée (`submitted`) mais l'article n'a pas encore atteint le niveau visé ;
 * - **intégrée** : l'article a atteint le niveau visé.
 * L'historique vient du journal `event` (`desk.claimed`, `desk.released`) et, pour les tâches
 * antérieures à ce journal, du dernier bail conservé dans `desk_task`.
 */
import { legifranceArticleUrl } from '@bugdeloi/core/legi'
import { LEVEL_RANK, LEVELS, type Level } from '@bugdeloi/core/levels'
import { articleStatus, deskTask, event, legalArticle, legalText } from '@bugdeloi/db'
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, lt, type SQL, sql } from 'drizzle-orm'
import { asLevel, type LevelCounts } from '../levels.ts'
import {
  type AvailableTask,
  type BoardCard,
  type BoardLane,
  type Column,
  STAGE_INFO,
  STAGES,
  type Stage,
  stageOfRole,
  type TaskJourney,
  type TaskStep,
  type WorkBoard,
  type WorkMove,
} from '../work.ts'
import { db } from './db.ts'
import { articleLabel, codeShort, currentDeskTask, newDeskTaskFilter, taskLabel } from './desk-catalog.ts'
import {
  catalaPath,
  frozenInterfaces,
  translationTaskId as frozenTaskId,
  sectionTitles,
} from './interfaces.ts'
import { getLevelCounts } from './level-counts.ts'

export type DeskRole = 'analyst' | 'translate' | 'oracle'
export const OPEN_ROLES: DeskRole[] = ['analyst', 'translate', 'oracle']

const now = sql`statement_timestamp()`
const leaseActive = sql`coalesce(${deskTask.leaseExpiresAt} > ${now}, false)`
const taskNode = sql`${deskTask.payload}->>'node'`

/** Inscrite, ni terminée ni réservée, texte toujours courant : le guichet la redonnerait. */
function inscribedOpen(role: DeskRole) {
  return and(eq(deskTask.role, role), isNull(deskTask.completedAt), sql`not ${leaseActive}`, currentDeskTask)
}

/** Niveaux qui comptent comme « étape faite » pour une cible (★ exclu : ce n'est pas notre travail). */
function levelsAtLeast(target: Level): Level[] {
  return LEVELS.filter((l) => l !== 'REF' && LEVEL_RANK[l] >= LEVEL_RANK[target])
}

function reachedTarget(target: Level): SQL {
  return sql`exists (select 1 from ${articleStatus} where ${articleStatus.articleId} = ${taskNode}
    and ${inArray(articleStatus.level, levelsAtLeast(target))})`
}

const ROLE_TARGET: Record<DeskRole, Level> = { analyst: 'N1', translate: 'N2', oracle: 'N3' }

function translationTaskId(legiarti: string): string | null {
  const spec = frozenInterfaces().get(legiarti)
  return spec ? frozenTaskId(spec) : null
}

function virtualTaskId(role: DeskRole, legiarti: string): string {
  if (role === 'analyst') return `analyst-${legiarti}`
  if (role === 'oracle') return `oracle-${legiarti}`
  return translationTaskId(legiarti) ?? `translate-${legiarti}`
}

function escapeLike(q: string): string {
  return q.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export interface AvailableFilter {
  role: DeskRole
  code?: string | null
  q?: string | null
}

function articleFilters({ code, q }: AvailableFilter): SQL[] {
  const filters: SQL[] = []
  if (code) filters.push(eq(legalArticle.textId, code))
  if (q) filters.push(ilike(legalArticle.num, `${escapeLike(q)}%`))
  return filters
}

/** Nombre de tâches à prendre pour un rôle : inscrites rendues + calculées à la volée. */
export async function availableCount(filter: AvailableFilter): Promise<{ returned: number; fresh: number }> {
  const filters = articleFilters(filter)
  const [[a], [b]] = await Promise.all([
    db()
      .select({ n: count() })
      .from(deskTask)
      .innerJoin(legalArticle, eq(legalArticle.id, taskNode))
      .where(and(inscribedOpen(filter.role), ...filters)),
    db()
      .select({ n: count() })
      .from(legalArticle)
      .where(and(newDeskTaskFilter(filter.role), ...filters)),
  ])
  return { returned: a?.n ?? 0, fresh: b?.n ?? 0 }
}

const excerpt = sql<string>`left(regexp_replace(${legalArticle.contentText}, '\\s+', ' ', 'g'), 240)`

/**
 * Tâches à prendre, dans l'ordre exact du guichet : d'abord les tâches rendues (par identifiant),
 * puis les tâches jamais distribuées (par LEGIARTI).
 */
export async function availableTasks(
  filter: AvailableFilter,
  page: number,
  size: number,
): Promise<{ items: AvailableTask[]; total: number }> {
  const { returned, fresh } = await availableCount(filter)
  const total = returned + fresh
  const offset = (page - 1) * size
  const filters = articleFilters(filter)
  const ranked = !filter.code && !filter.q

  const rows: Omit<AvailableTask, 'position'>[] = []
  if (offset < returned) {
    const a = await db()
      .select({
        taskId: deskTask.id,
        legiarti: legalArticle.id,
        num: legalArticle.num,
        textId: legalArticle.textId,
        excerpt,
        lastReason: deskTask.releaseReason,
      })
      .from(deskTask)
      .innerJoin(legalArticle, eq(legalArticle.id, taskNode))
      .where(and(inscribedOpen(filter.role), ...filters))
      .orderBy(asc(deskTask.id))
      .limit(size)
      .offset(offset)
    for (const r of a) {
      const code = codeShort(r.textId) ?? ''
      rows.push({
        taskId: r.taskId,
        role: filter.role,
        legiarti: r.legiarti,
        label: articleLabel(code, r.num, r.legiarti),
        code,
        articleNum: r.num,
        excerpt: r.excerpt,
        returned: true,
        lastReason: r.lastReason,
      })
    }
  }
  const remaining = size - rows.length
  if (remaining > 0 && offset + rows.length < total) {
    const b = await db()
      .select({ legiarti: legalArticle.id, num: legalArticle.num, textId: legalArticle.textId, excerpt })
      .from(legalArticle)
      .where(and(newDeskTaskFilter(filter.role), ...filters))
      .orderBy(asc(legalArticle.id))
      .limit(remaining)
      .offset(Math.max(0, offset - returned))
    for (const r of b) {
      const code = codeShort(r.textId) ?? ''
      rows.push({
        taskId: virtualTaskId(filter.role, r.legiarti),
        role: filter.role,
        legiarti: r.legiarti,
        label: articleLabel(code, r.num, r.legiarti),
        code,
        articleNum: r.num,
        excerpt: r.excerpt,
        returned: false,
        lastReason: null,
      })
    }
  }
  return {
    total,
    items: rows.map((r, i) => ({ ...r, position: ranked ? offset + i + 1 : 0 })),
  }
}

/** Les rôles ouverts au guichet, avec leur nombre de tâches à prendre. */
export async function availableByRole(): Promise<Record<DeskRole, number>> {
  const [a, t, o] = await Promise.all(OPEN_ROLES.map((role) => availableCount({ role })))
  return {
    analyst: (a?.returned ?? 0) + (a?.fresh ?? 0),
    translate: (t?.returned ?? 0) + (t?.fresh ?? 0),
    oracle: (o?.returned ?? 0) + (o?.fresh ?? 0),
  }
}

// ---------------------------------------------------------------------------
// Parcours d'une tâche
// ---------------------------------------------------------------------------

const TASK_ID_RE =
  /^(analyst)-(LEGIARTI\d{12})$|^(translate)-(LEGIARTI\d{12})(?:-(v\d+))?$|^(oracle)-(LEGIARTI\d{12})$/

export function parseTaskId(id: string): { role: DeskRole; legiarti: string } | null {
  const m = TASK_ID_RE.exec(id)
  if (!m) return null
  if (m[1] && m[2]) return { role: 'analyst', legiarti: m[2] }
  if (m[3] && m[4]) return { role: 'translate', legiarti: m[4] }
  if (m[6] && m[7]) return { role: 'oracle', legiarti: m[7] }
  return null
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

const fmtDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' })

export async function taskJourney(id: string): Promise<TaskJourney | null> {
  const parsed = parseTaskId(id)
  if (!parsed) return null
  const { role, legiarti } = parsed
  const canonicalId = virtualTaskId(role, legiarti)
  const stage = stageOfRole(role) as Stage
  const target = ROLE_TARGET[role]

  const [[art], [row], history] = await Promise.all([
    db()
      .select({
        id: legalArticle.id,
        num: legalArticle.num,
        textId: legalArticle.textId,
        sectionId: legalArticle.sectionId,
        codeTitle: legalText.title,
        dateDebut: legalArticle.dateDebut,
        text: legalArticle.contentText,
        hash: legalArticle.textSha256,
        level: articleStatus.level,
        levelAt: articleStatus.updatedAt,
        evidence: articleStatus.evidence,
      })
      .from(legalArticle)
      .innerJoin(legalText, eq(legalText.id, legalArticle.textId))
      .leftJoin(articleStatus, eq(articleStatus.articleId, legalArticle.id))
      .where(eq(legalArticle.id, legiarti))
      .limit(1),
    db()
      .select({
        payload: deskTask.payload,
        handle: deskTask.leaseHandle,
        family: deskTask.leaseFamily,
        startedAt: deskTask.leaseStartedAt,
        expiresAt: deskTask.leaseExpiresAt,
        reason: deskTask.releaseReason,
        completedAt: deskTask.completedAt,
        active: sql<boolean>`${leaseActive}`,
        current: sql<boolean>`${currentDeskTask}`,
      })
      .from(deskTask)
      .where(eq(deskTask.id, id))
      .limit(1),
    db()
      .select({ id: event.id, ts: event.ts, type: event.type, actor: event.actor, payload: event.payload })
      .from(event)
      .where(and(eq(event.subject, id), inArray(event.type, ['desk.claimed', 'desk.released'])))
      .orderBy(asc(event.ts), asc(event.id)),
  ])
  if (!art) return null
  // Une tâche d'une version antérieure de l'interface (translate-…-v1 après une fiche v2) reste
  // consultable si le guichet l'a inscrite ; un identifiant inventé ne l'est pas.
  if (role === 'translate' && canonicalId !== id && !row) return null

  const level = asLevel(art.level)
  const reached = level !== 'REF' && LEVEL_RANK[level] >= LEVEL_RANK[target]
  const code = codeShort(art.textId)
  const nowMs = Date.now()

  // Disponibilité au guichet (tâche jamais inscrite ou rendue).
  let position: number | null = null
  let blockedReason: string | null = null
  const [eligible] = row
    ? [undefined]
    : await db()
        .select({ n: count() })
        .from(legalArticle)
        .where(and(eq(legalArticle.id, legiarti), newDeskTaskFilter(role)))

  let column: Column
  if (row?.completedAt) column = reached ? 'done' : 'review'
  else if (row?.active) column = 'doing'
  else if (row) {
    column = 'todo'
    if (!row.current)
      blockedReason =
        'Le texte officiel a changé depuis l’inscription de la tâche : le guichet ne la redonnera pas sous cette forme.'
  } else {
    column = reached ? 'done' : 'todo'
    if (!reached && !eligible?.n) {
      blockedReason =
        role === 'oracle'
          ? 'Pas de tâche d’oracle disponible : l’article doit être au niveau N2 Compilé dans le corpus et ne pas encore avoir atteint le niveau N3.'
          : role === 'translate'
            ? 'Pas de traduction possible pour l’instant : il faut une fiche d’analyse fusionnée, classée « calculable » ou « mixte », sur le texte en vigueur (empreinte identique), et l’article ne doit pas déjà être au niveau N2.'
            : LEVEL_RANK[level] >= 1
              ? 'L’article est déjà analysé.'
              : 'Le guichet ne propose pas cet article : il n’est plus en vigueur, il est vide ou il n’est pas un article autonome.'
    }
  }

  if (column === 'todo' && !blockedReason) {
    const [[before], [beforeFresh]] = await Promise.all([
      db()
        .select({ n: count() })
        .from(deskTask)
        .where(and(inscribedOpen(role), row ? lt(deskTask.id, id) : sql`true`)),
      row
        ? Promise.resolve([{ n: 0 }])
        : db()
            .select({ n: count() })
            .from(legalArticle)
            .where(and(newDeskTaskFilter(role), lt(legalArticle.id, legiarti))),
    ])
    position = (before?.n ?? 0) + (beforeFresh?.n ?? 0) + 1
  }

  // Historique : version en vigueur, réservations, libérations, intégration.
  const steps: TaskStep[] = []
  if (art.dateDebut) {
    steps.push({
      ts: new Date(`${art.dateDebut}T00:00:00Z`).toISOString(),
      kind: 'in_force',
      title: 'Version du texte en vigueur',
      detail: `Cette version de l’article s’applique depuis le ${fmtDate.format(new Date(art.dateDebut))}.`,
      handle: null,
      family: null,
    })
  }
  let openClaim: { ts: Date; handle: string | null } | null = null
  const handleOf = (actor: string) => (actor.startsWith('github:') ? actor.slice(7) : null)
  for (const ev of history) {
    const p = ev.payload
    if (ev.type === 'desk.claimed') {
      if (openClaim) {
        steps.push({
          ts: ev.ts.toISOString(),
          kind: 'expired',
          title: 'Réservation expirée',
          detail:
            'La réservation n’a pas été renouvelée dans le délai imparti. La tâche est revenue dans la liste.',
          handle: openClaim.handle,
          family: null,
        })
      }
      openClaim = { ts: ev.ts, handle: handleOf(ev.actor) }
      steps.push({
        ts: ev.ts.toISOString(),
        kind: 'claimed',
        title: 'Réservée',
        detail: 'Le guichet a attribué la tâche à ce contributeur.',
        handle: handleOf(ev.actor),
        family: str(p.family),
      })
    } else {
      openClaim = null
      const reason = str(p.reason)
      steps.push({
        ts: ev.ts.toISOString(),
        kind: reason === 'submitted' ? 'submitted' : 'released',
        title: reason === 'submitted' ? 'Travail déposé' : 'Rendue',
        detail:
          reason === 'submitted'
            ? 'Le contributeur a déposé sa proposition. La tâche passe en relecture.'
            : `Le contributeur a rendu la tâche (motif : ${reason ?? 'non précisé'}). Elle revient dans la liste.`,
        handle: handleOf(ev.actor),
        family: str(p.family),
      })
    }
  }
  // Tâches antérieures au journal : on reconstitue le dernier bail.
  if (history.length === 0 && row?.startedAt) {
    steps.push({
      ts: row.startedAt.toISOString(),
      kind: 'claimed',
      title: 'Réservée',
      detail: 'Dernière réservation connue (antérieure au journal des tâches).',
      handle: row.handle,
      family: row.family,
    })
    if (row.completedAt) {
      steps.push({
        ts: row.completedAt.toISOString(),
        kind: 'submitted',
        title: 'Travail déposé',
        detail: 'Le contributeur a déposé sa proposition. La tâche passe en relecture.',
        handle: row.handle,
        family: row.family,
      })
    } else if (row.reason) {
      openClaim = null
      steps.push({
        ts: row.startedAt.toISOString(),
        kind: 'released',
        title: 'Rendue',
        detail: `Le contributeur a rendu la tâche (motif : ${row.reason}). Elle revient dans la liste.`,
        handle: row.handle,
        family: row.family,
      })
    } else {
      openClaim = { ts: row.startedAt, handle: row.handle }
    }
  }
  if (
    openClaim &&
    row &&
    !row.active &&
    !row.completedAt &&
    row.expiresAt &&
    row.expiresAt.getTime() < nowMs
  ) {
    steps.push({
      ts: row.expiresAt.toISOString(),
      kind: 'expired',
      title: 'Réservation expirée',
      detail:
        'La réservation n’a pas été renouvelée dans le délai imparti. La tâche est revenue dans la liste.',
      handle: openClaim.handle,
      family: null,
    })
  }
  const evidence = (art.evidence ?? {}) as Record<string, unknown>
  const analysis = evidence.analysis as Record<string, unknown> | undefined
  const corpusFile = str(analysis?.file) ?? null
  if (reached && art.levelAt) {
    steps.push({
      ts: art.levelAt.toISOString(),
      kind: 'integrated',
      title: `Intégrée · niveau ${target} atteint`,
      detail: corpusFile
        ? `Le travail est fusionné dans le corpus (${corpusFile}) et les contrôles mécaniques ont fait monter l’article.`
        : 'Le travail est fusionné dans le corpus et les contrôles mécaniques ont fait monter l’article.',
      handle: null,
      family: null,
    })
  }
  steps.sort((a, b) => a.ts.localeCompare(b.ts))

  const payload = row?.payload
  const spec = role === 'translate' ? frozenInterfaces().get(legiarti) : undefined
  const plannedPath =
    role === 'translate' && spec && !payload
      ? (spec.path ?? catalaPath(art.textId, await sectionTitles(db(), art.sectionId), art.num, legiarti))
      : null
  return {
    taskId: id,
    role,
    legiarti,
    label: articleLabel(code, art.num, legiarti),
    stage,
    column,
    virtual: !row,
    position,
    code,
    codeTitle: art.codeTitle,
    articleNum: art.num,
    articleLevel: level,
    dateDebut: art.dateDebut,
    text: art.text,
    sourceUrl: legifranceArticleUrl(legiarti),
    textSha256: art.hash,
    objective:
      payload?.context_pack.objective ??
      (spec
        ? `Traduire l’article en Catala selon l’interface figée ${spec.interface}. ${spec.signature}`
        : null),
    interfaceName: payload?.interface ?? spec?.interface ?? null,
    allowedPaths:
      payload?.allowed_paths ??
      (role === 'analyst' ? [`analyses/${legiarti}.md`] : plannedPath ? [plannedPath] : []),
    handle: row?.active ? row.handle : null,
    family: row?.active ? row.family : null,
    leaseExpiresAt: row?.active && row.expiresAt ? row.expiresAt.toISOString() : null,
    steps,
    corpusFile,
    blockedReason,
  }
}

// ---------------------------------------------------------------------------
// Tableau du travail (Kanban par étape)
// ---------------------------------------------------------------------------

const CARD_LIMIT = 8

const integratedAt = sql`(select ${articleStatus.updatedAt} from ${articleStatus} where ${articleStatus.articleId} = ${taskNode})`

async function cards(
  role: DeskRole,
  where: SQL,
  orderBy: SQL,
  limit = CARD_LIMIT,
  sinceExpr: SQL = sql`coalesce(${deskTask.completedAt}, ${deskTask.leaseStartedAt})`,
): Promise<BoardCard[]> {
  const rows = await db()
    .select({
      taskId: deskTask.id,
      payload: deskTask.payload,
      handle: deskTask.leaseHandle,
      family: deskTask.leaseFamily,
      since: sql<Date | null>`${sinceExpr}`,
    })
    .from(deskTask)
    .where(and(eq(deskTask.role, role), where))
    .orderBy(orderBy)
    .limit(limit)
  return rows.map((r) => ({
    taskId: r.taskId,
    role,
    legiarti: r.payload.legal_units[0]?.legiarti ?? r.payload.node ?? null,
    label: taskLabel(r.payload),
    handle: r.handle,
    family: r.family,
    since: r.since ? new Date(r.since).toISOString() : null,
  }))
}

async function deskLane(role: DeskRole, levels: LevelCounts): Promise<BoardLane> {
  const target = ROLE_TARGET[role]
  const stage = stageOfRole(role) as Stage
  const from = STAGE_INFO[stage].from
  const submitted = and(isNotNull(deskTask.completedAt), sql`not ${reachedTarget(target)}`) as SQL
  const integrated = and(isNotNull(deskTask.completedAt), reachedTarget(target)) as SQL
  const [[agg], avail, doing, review, done, next] = await Promise.all([
    db()
      .select({
        doing:
          sql<number>`count(*) filter (where ${deskTask.completedAt} is null and ${leaseActive})`.mapWith(
            Number,
          ),
        review: sql<number>`count(*) filter (where ${submitted})`.mapWith(Number),
      })
      .from(deskTask)
      .where(eq(deskTask.role, role)),
    availableCount({ role }),
    cards(role, and(isNull(deskTask.completedAt), leaseActive) as SQL, desc(deskTask.leaseStartedAt)),
    cards(role, submitted, desc(deskTask.completedAt)),
    cards(
      role,
      integrated,
      sql`${integratedAt} desc nulls last`,
      6,
      sql`coalesce(${integratedAt}, ${deskTask.completedAt})`,
    ),
    availableTasks({ role }, 1, 4),
  ])
  const todo = avail.returned + avail.fresh
  const doneCount = levelsAtLeast(target).reduce((n, l) => n + levels[l], 0)
  const atFrom = levels[from]
  const inFlight = todo + (agg?.doing ?? 0) + (agg?.review ?? 0)
  return {
    stage,
    counts: { todo, doing: agg?.doing ?? 0, review: agg?.review ?? 0, done: doneCount },
    waiting: Math.max(0, atFrom - inFlight),
    cards: {
      todo: next.items.map((t) => ({ ...t, handle: null, family: null, since: null })),
      doing,
      review,
      done,
    },
  }
}

function closedLane(stage: Stage, levels: LevelCounts): BoardLane {
  const info = STAGE_INFO[stage]
  return {
    stage,
    counts: { todo: 0, doing: 0, review: 0, done: levelsAtLeast(info.to).reduce((n, l) => n + levels[l], 0) },
    waiting: levels[info.from],
    cards: { todo: [], doing: [], review: [], done: [] },
  }
}

async function recentMoves(limit = 24): Promise<WorkMove[]> {
  const rows = await db()
    .select()
    .from(event)
    .where(inArray(event.type, ['desk.claimed', 'desk.released', 'article_promoted']))
    .orderBy(desc(event.id))
    .limit(limit)
  return rows.map((r) => {
    const p = r.payload
    const reason = str(p.reason)
    const kind: WorkMove['kind'] =
      r.type === 'desk.claimed'
        ? 'claimed'
        : r.type === 'article_promoted'
          ? 'promoted'
          : reason === 'submitted'
            ? 'submitted'
            : 'released'
    const handle = r.actor.startsWith('github:') ? r.actor.slice(7) : null
    return {
      id: r.id,
      ts: r.ts.toISOString(),
      kind,
      taskId: r.type === 'article_promoted' ? null : r.subject,
      label:
        str(p.label) ??
        (r.type === 'article_promoted' ? (str(p.summary) ?? 'Articles promus') : (r.subject ?? '')),
      handle,
      family: str(p.family),
      reason,
      level: str(p.level),
      count: typeof p.count === 'number' ? p.count : 1,
    }
  })
}

/** Le tableau complet : une ligne par étape, quatre colonnes, les dernières cartes et mouvements. */
export async function workBoard(): Promise<WorkBoard> {
  const levels = await getLevelCounts()
  const [analyse, traduction, oracles, moves] = await Promise.all([
    deskLane('analyst', levels),
    deskLane('translate', levels),
    deskLane('oracle', levels),
    recentMoves(),
  ])
  const lanes = STAGES.map((stage) =>
    stage === 'analyse'
      ? analyse
      : stage === 'traduction'
        ? traduction
        : stage === 'oracles'
          ? oracles
          : closedLane(stage, levels),
  )
  return { enabled: process.env.DESK_ENABLED === '1', lanes, moves }
}
