/** Reconstitue la réserve d'analyses et inscrit les traductions aux interfaces figées. */
import { legifranceArticleUrl, sha256Hex } from '@bugdeloi/core/legi'
import { articleInForce, articleStatus, createDb, deskTask, legalArticle, legalText } from '@bugdeloi/db'
import {
  and,
  asc,
  count,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  notExists,
  notInArray,
  or,
  sql,
} from 'drizzle-orm'
import { translations } from './desk-translations.ts'

const analysisReserve = 24
const args = process.argv.slice(2)
if (args.length > 1 || (args.length === 1 && args[0] !== '--dry-run')) {
  throw new Error('Usage : DATABASE_URL=… bun apps/web/scripts/seed-desk.ts [--dry-run]')
}
const dryRun = args[0] === '--dry-run'
const url = process.env.DATABASE_URL
if (!url) throw new Error('Indique explicitement la base cible via DATABASE_URL.')

const { db, sql: client } = createDb(url)
const columns = {
  id: legalArticle.id,
  dateDebut: legalArticle.dateDebut,
  dateFin: legalArticle.dateFin,
  text: legalArticle.contentText,
  hash: legalArticle.textSha256,
  articleNumber: legalArticle.num,
  codeTitle: legalText.title,
}

try {
  await db.transaction(
    async (tx) => {
      if (!dryRun) await tx.execute(sql`select pg_advisory_xact_lock(hashtext('bugdeloi.desk.refill'))`)
      const [{ available = 0 } = {}] = await tx
        .select({ available: count() })
        .from(deskTask)
        .where(
          and(
            eq(deskTask.role, 'analyst'),
            isNull(deskTask.completedAt),
            or(isNull(deskTask.leaseExpiresAt), lte(deskTask.leaseExpiresAt, sql`statement_timestamp()`)),
          ),
        )

      const analysisRows = await tx
        .select(columns)
        .from(legalArticle)
        .innerJoin(legalText, eq(legalText.id, legalArticle.textId))
        .where(
          and(
            articleInForce(),
            isNotNull(legalArticle.sectionId),
            isNotNull(legalArticle.num),
            eq(legalArticle.type, 'AUTONOME'),
            ne(legalArticle.contentText, ''),
            sql`${legalArticle.contentText} !~* '^(article )?réservé[. ]*$'`,
            notInArray(
              legalArticle.id,
              translations.map((spec) => spec.legiarti),
            ),
            notExists(
              tx
                .select({ id: deskTask.id })
                .from(deskTask)
                .where(sql`${deskTask.payload}->>'node' = ${legalArticle.id}`),
            ),
            notExists(
              tx
                .select({ id: articleStatus.articleId })
                .from(articleStatus)
                .where(and(eq(articleStatus.articleId, legalArticle.id), ne(articleStatus.level, 'N0'))),
            ),
          ),
        )
        .orderBy(asc(sql`length(${legalArticle.contentText})`), asc(legalArticle.id))
        .limit(Math.max(0, analysisReserve - available))

      const translationRows = await tx
        .select(columns)
        .from(legalArticle)
        .innerJoin(legalText, eq(legalText.id, legalArticle.textId))
        .where(
          and(
            articleInForce(),
            inArray(
              legalArticle.id,
              translations.map((spec) => spec.legiarti),
            ),
          ),
        )

      type Task = typeof deskTask.$inferInsert
      function task(
        row: (typeof analysisRows)[number],
        role: Task['role'],
        id: string,
        path: string,
        objective: string,
        scope: string | null,
      ): Task {
        if (!row.dateDebut || sha256Hex(row.text) !== row.hash) {
          throw new Error(`Version ou empreinte incohérente pour ${row.id}`)
        }
        return {
          id,
          role,
          payload: {
            node: row.id,
            legal_units: [
              {
                legiarti: row.id,
                date_debut: row.dateDebut,
                date_fin: row.dateFin,
                text: row.text,
                text_sha256: row.hash,
                source_url: legifranceArticleUrl(row.id),
              },
            ],
            interface: scope,
            context_pack: { objective, code_title: row.codeTitle, article_number: row.articleNumber },
            blind_to: [],
            allowed_paths: [path],
          },
        }
      }

      const tasks = analysisRows.map((row) =>
        task(
          row,
          'analyst',
          `analyst-${row.id}`,
          `analyses/${row.id}.md`,
          'Proposer une interface typée et classer chaque alinéa : calculable, entrée d’appréciation ou hors périmètre motivé.',
          null,
        ),
      )
      for (const spec of translations) {
        const row = translationRows.find((article) => article.id === spec.legiarti)
        if (!row || row.hash !== spec.hash) {
          console.warn(`Interface ignorée : ${spec.interface}, version LEGI absente ou différente.`)
          continue
        }
        tasks.push(
          task(
            row,
            'translate',
            `translate-${row.id}-${spec.interface.split('@')[1]}`,
            spec.path,
            spec.signature,
            spec.interface,
          ),
        )
      }

      if (dryRun) {
        console.log(JSON.stringify(tasks, null, 2))
      } else if (tasks.length > 0) {
        const added = await tx
          .insert(deskTask)
          .values(tasks)
          .onConflictDoNothing()
          .returning({ role: deskTask.role })
        console.log(
          `Guichet : ${added.filter(({ role }) => role === 'analyst').length} analyses et ${added.filter(({ role }) => role === 'translate').length} traductions ajoutées.`,
        )
      }
    },
    { accessMode: dryRun ? 'read only' : 'read write' },
  )
} finally {
  await client.end()
}
