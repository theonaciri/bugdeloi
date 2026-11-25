#!/usr/bin/env bun
/** Actualise les marqueurs externes ★ depuis la source épinglée et le dernier rejeu terminé
 * de chaque dossier. Avec --dry-run, calcule le même résultat dans une transaction en lecture seule.
 */
import {
  articleInForce,
  articleStatus,
  createDb,
  event,
  legalArticle,
  legalText,
  replicationRun,
} from '@bugdeloi/db'
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm'
import { collectCoverage, syncCoverage } from './coverage.ts'
import { source, sourceCommit, withSource } from './source.ts'

const dryRun = process.argv.includes('--dry-run')
const subjectPrefix = `catala-examples@${sourceCommit}/`
const sourceStatus = sql`${articleStatus.evidence} -> 'reference' ->> 'source' = ${source}`
const withdrawable = and(eq(articleStatus.level, 'REF'), sourceStatus)
const promotable = or(eq(articleStatus.level, 'N0'), withdrawable)
const reasons = {
  no_code: 'Aucun bloc Catala avec une formalisation sous un titre de cette version dans la source épinglée.',
  no_replay: 'Aucun dossier couvrant cette version avec un dernier rejeu réussi et au moins un test.',
  not_in_force: 'Cette version ne satisfait plus la règle « en vigueur ».',
}

const { entries, summary } = await withSource(collectCoverage)
const { db, sql: client } = createDb()
try {
  const report = await db.transaction(
    async (tx) => {
      const runs = await tx
        .selectDistinctOn([replicationRun.subject], {
          id: replicationRun.id,
          subject: replicationRun.subject,
          status: replicationRun.status,
          summary: replicationRun.summary,
        })
        .from(replicationRun)
        .where(and(eq(replicationRun.kind, 'C0.1-inria-replay'), sql`${replicationRun.status} <> 'running'`))
        .orderBy(replicationRun.subject, desc(replicationRun.startedAt), desc(replicationRun.id))
      const folders = runs
        .filter((r) => r.subject.startsWith(subjectPrefix))
        .map((r) => ({ ...r, folder: r.subject.slice(subjectPrefix.length) }))
        .sort((a, b) => b.folder.length - a.folder.length)

      const candidates = new Map<string, { files: string[]; runIds: Set<number> }>()
      for (const row of entries) {
        const run = folders.find((r) => row.file.startsWith(`${r.folder}/`))
        if (run?.status !== 'passed' || typeof run.summary.tests !== 'number' || run.summary.tests < 1)
          continue
        const entry = candidates.get(row.legiarti) ?? { files: [], runIds: new Set<number>() }
        entry.files.push(`${row.file}:${row.line}`)
        entry.runIds.add(run.id)
        candidates.set(row.legiarti, entry)
      }

      const ids = [...candidates.keys()]
      const article = { id: legalArticle.id, code: legalText.shortTitle, num: legalArticle.num }
      const eligible = ids.length
        ? await tx
            .select(article)
            .from(legalArticle)
            .innerJoin(legalText, eq(legalText.id, legalArticle.textId))
            .leftJoin(articleStatus, eq(articleStatus.articleId, legalArticle.id))
            .where(
              and(
                inArray(legalArticle.id, ids),
                articleInForce(),
                or(sql`${articleStatus.articleId} is null`, promotable),
              ),
            )
        : []
      const current = await tx
        .select({ ...article, reference: sql<unknown>`${articleStatus.evidence} -> 'reference'` })
        .from(articleStatus)
        .innerJoin(legalArticle, eq(legalArticle.id, articleStatus.articleId))
        .innerJoin(legalText, eq(legalText.id, legalArticle.textId))
        .where(withdrawable)
        .orderBy(legalText.shortTitle, legalArticle.num, legalArticle.id)

      const coveredIds = new Set(entries.map((row) => row.legiarti))
      const eligibleIds = new Set(eligible.map((row) => row.id))
      const withdrawals = current
        .filter((row) => !eligibleIds.has(row.id))
        .map(({ reference, ...row }) => {
          const reason = !coveredIds.has(row.id)
            ? 'no_code'
            : candidates.has(row.id)
              ? 'not_in_force'
              : 'no_replay'
          return { ...row, reason, detail: reasons[reason], previousReference: reference }
        })

      if (!dryRun) {
        await syncCoverage(tx, entries)
        if (eligible.length) {
          await tx
            .insert(articleStatus)
            .values(
              eligible.map(({ id }) => {
                const candidate = candidates.get(id)
                if (!candidate) throw new Error(`Candidat absent : ${id}`)
                return {
                  articleId: id,
                  level: 'REF',
                  evidence: {
                    reference: {
                      source,
                      sourceCommit,
                      files: candidate.files.sort(),
                      replicationRunIds: [...candidate.runIds].sort((a, b) => a - b),
                      rule: 'version en vigueur formalisée sous son titre dans un dossier dont le dernier rejeu C0.1 est passed avec au moins un test',
                      promotedBy: 'replications/c0.1/promote.ts',
                    },
                  },
                }
              }),
            )
            .onConflictDoUpdate({
              target: articleStatus.articleId,
              set: {
                level: 'REF',
                evidence: sql`${articleStatus.evidence} || excluded.evidence`,
                updatedAt: sql`now()`,
              },
              setWhere: and(
                promotable,
                sql`(${articleStatus.level}, ${articleStatus.evidence} -> 'reference')
                is distinct from ('REF', excluded.evidence -> 'reference')`,
              ),
            })
        }
        if (withdrawals.length) {
          await tx
            .update(articleStatus)
            .set({
              level: 'N0',
              evidence: sql`${articleStatus.evidence} - 'reference'`,
              updatedAt: sql`now()`,
            })
            .where(
              and(
                inArray(
                  articleStatus.articleId,
                  withdrawals.map((row) => row.id),
                ),
                withdrawable,
              ),
            )
        }
        await tx.insert(event).values({
          type: 'reference.promoted',
          actor: 'system:c0.1',
          subject: `${source}@${sourceCommit}`,
          payload: {
            promoted: eligible.length,
            demoted: withdrawals.length,
            withdrawals,
            source,
            sourceCommit,
          },
        })
      }

      const codes = new Map<string, { before: number; after: number }>()
      for (const [rows, key] of [
        [current, 'before'],
        [eligible, 'after'],
      ] as const) {
        for (const { code } of rows) {
          const label = code ?? 'Autre'
          const totals = codes.get(label) ?? { before: 0, after: 0 }
          totals[key]++
          codes.set(label, totals)
        }
      }
      return {
        source,
        sourceCommit,
        coverage: summary.distinctLegiarti,
        before: current.length,
        after: eligible.length,
        byCode: Object.fromEntries([...codes].sort(([a], [b]) => a.localeCompare(b))),
        withdrawals,
      }
    },
    { isolationLevel: 'repeatable read', accessMode: dryRun ? 'read only' : 'read write' },
  )
  if (dryRun) console.log(JSON.stringify(report, null, 2))
  else
    console.log(
      `${report.after} articles ★ · ${report.withdrawals.length} retraits consignés dans le journal.`,
    )
} finally {
  await client.end()
}
