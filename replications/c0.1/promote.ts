#!/usr/bin/env bun
/**
 * Attribue le niveau ★ Référence (AGENTS.md §4.1) aux articles dont la version EN VIGUEUR est
 * formalisée dans catala-examples ET dont la suite de tests correspondante a réussi lors de son
 * dernier rejeu C0.1 (au moins un test, commit source épinglé identique).
 *
 *   bun replications/c0.1/promote.ts [--dry-run]
 *
 * Règles (volontairement strictes) :
 * - la LEGIARTI citée par Inria doit être exactement la version en vigueur (`articleInForce()`) :
 *   une formalisation d'une version antérieure ne couvre pas le texte actuel ;
 * - le fichier qui la cite doit appartenir à un dossier dont le dernier rejeu est `passed`
 *   (`no_tests`, `failed`, `error` ne donnent rien) ;
 * - on ne touche qu'aux articles au niveau N0 (jamais de rétrogradation d'un niveau BugDeLoi) ;
 * - idempotent ; un article qui ne remplit plus les conditions redescend à N0.
 */
import { articleInForce, articleStatus, createDb, event, legalArticle, referenceCoverage, replicationRun } from '@bugdeloi/db'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { source, sourceCommit } from './source.ts'

const dryRun = process.argv.includes('--dry-run')
const SUBJECT_PREFIX = `catala-examples@${sourceCommit}/`

const { db, sql: client } = createDb()
try {
  // Dernier rejeu terminé de chaque dossier, pour le commit source épinglé.
  const runs = await db
    .selectDistinctOn([replicationRun.subject], {
      id: replicationRun.id,
      subject: replicationRun.subject,
      status: replicationRun.status,
      summary: replicationRun.summary,
    })
    .from(replicationRun)
    .where(and(eq(replicationRun.kind, 'C0.1-inria-replay'), sql`${replicationRun.status} <> 'running'`))
    .orderBy(replicationRun.subject, desc(replicationRun.startedAt))
  const passedFolders = runs
    .filter((r) => r.subject.startsWith(SUBJECT_PREFIX) && r.status === 'passed')
    .map((r) => ({ folder: r.subject.slice(SUBJECT_PREFIX.length), runId: r.id }))
    .sort((a, b) => b.folder.length - a.folder.length) // dossier le plus spécifique d'abord (asp/bcae7 avant asp)

  const folderOf = (file: string) => passedFolders.find((f) => file === f.folder || file.startsWith(`${f.folder}/`))

  const coverage = await db
    .select({ legiarti: referenceCoverage.legiarti, file: referenceCoverage.file, line: referenceCoverage.line })
    .from(referenceCoverage)
    .where(and(eq(referenceCoverage.source, source), eq(referenceCoverage.sourceCommit, sourceCommit)))

  const candidates = new Map<string, { files: string[]; runIds: Set<number> }>()
  for (const row of coverage) {
    const folder = folderOf(row.file)
    if (!folder) continue
    const entry = candidates.get(row.legiarti) ?? { files: [], runIds: new Set<number>() }
    entry.files.push(`${row.file}:${row.line ?? '?'}`)
    entry.runIds.add(folder.runId)
    candidates.set(row.legiarti, entry)
  }

  const ids = [...candidates.keys()]
  const inForce = ids.length
    ? await db
        .select({ id: legalArticle.id, level: sql<string>`coalesce(${articleStatus.level}, 'N0')` })
        .from(legalArticle)
        .leftJoin(articleStatus, eq(articleStatus.articleId, legalArticle.id))
        .where(and(inArray(legalArticle.id, ids), articleInForce()))
    : []
  const eligible = inForce.filter((a) => a.level === 'N0' || a.level === 'REF')

  // Articles actuellement ★ via cette source qui ne remplissent plus les conditions.
  const eligibleIds = new Set(eligible.map((a) => a.id))
  const current = await db
    .select({ id: articleStatus.articleId })
    .from(articleStatus)
    .where(and(eq(articleStatus.level, 'REF'), sql`${articleStatus.evidence} -> 'reference' ->> 'source' = ${source}`))
  const toDemote = current.map((c) => c.id).filter((id) => !eligibleIds.has(id))

  console.log(
    `${coverage.length} mentions Inria · ${candidates.size} LEGIARTI dans des dossiers rejoués avec succès · ` +
      `${inForce.length} sont la version en vigueur · ${eligible.length} éligibles ★ · ${toDemote.length} à retirer`,
  )
  if (dryRun) process.exit(0)

  const now = new Date()
  await db.transaction(async (tx) => {
    for (const a of eligible) {
      const c = candidates.get(a.id)
      if (!c) continue
      const evidence = {
        reference: {
          source,
          sourceCommit,
          files: c.files.sort(),
          replicationRunIds: [...c.runIds].sort((x, y) => x - y),
          rule: 'version en vigueur citée par un titre « Article …|LEGIARTI » d’un dossier dont le dernier rejeu C0.1 est passed',
          promotedBy: 'replications/c0.1/promote.ts',
        },
      }
      await tx
        .insert(articleStatus)
        .values({ articleId: a.id, level: 'REF', evidence, updatedAt: now })
        .onConflictDoUpdate({
          target: articleStatus.articleId,
          set: { level: 'REF', evidence, updatedAt: now },
          where: sql`${articleStatus.level} in ('N0', 'REF')`,
        })
    }
    if (toDemote.length) {
      await tx
        .update(articleStatus)
        .set({ level: 'N0', evidence: {}, updatedAt: now })
        .where(and(inArray(articleStatus.articleId, toDemote), eq(articleStatus.level, 'REF')))
    }
    await tx.insert(event).values({
      type: 'reference.promoted',
      actor: 'system:c0.1',
      subject: `${source}@${sourceCommit}`,
      payload: { promoted: eligible.length, demoted: toDemote.length, source, sourceCommit },
    })
  })
  console.log(`★ attribué à ${eligible.length} articles, retiré à ${toDemote.length}.`)
} finally {
  await client.end()
}
