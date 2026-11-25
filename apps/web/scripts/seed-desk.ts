/** Sélectionne trois versions en vigueur marquées ★ et prépare une analyse par version. */
import { legifranceArticleUrl, sha256Hex } from '@bugdeloi/core/legi'
import { articleInForce, articleStatus, createDb, deskTask, legalArticle, legalText } from '@bugdeloi/db'
import { and, asc, eq, isNotNull, ne, sql } from 'drizzle-orm'

const args = process.argv.slice(2)
if (args.length > 1 || (args.length === 1 && args[0] !== '--dry-run')) {
  throw new Error('Usage : DATABASE_URL=… bun apps/web/scripts/seed-desk.ts [--dry-run]')
}
const dryRun = args[0] === '--dry-run'
const url = process.env.DATABASE_URL
if (!url) throw new Error('Indique explicitement la base cible via DATABASE_URL.')

const { db, sql: client } = createDb(url)
try {
  await db.transaction(
    async (tx) => {
      const rows = await tx
        .select({
          id: legalArticle.id,
          dateDebut: legalArticle.dateDebut,
          dateFin: legalArticle.dateFin,
          text: legalArticle.contentText,
          hash: legalArticle.textSha256,
          articleNumber: legalArticle.num,
          codeTitle: legalText.title,
        })
        .from(legalArticle)
        .innerJoin(legalText, eq(legalText.id, legalArticle.textId))
        .innerJoin(articleStatus, eq(articleStatus.articleId, legalArticle.id))
        .where(
          and(
            eq(articleStatus.level, 'REF'),
            articleInForce(),
            isNotNull(legalArticle.dateDebut),
            ne(legalArticle.contentText, ''),
          ),
        )
        .orderBy(asc(sql`length(${legalArticle.contentText})`), asc(legalArticle.id))
        .limit(3)

      const tasks = rows.map((row): typeof deskTask.$inferInsert => {
        if (!row.dateDebut || sha256Hex(row.text) !== row.hash) {
          throw new Error(`Version ou empreinte incohérente pour ${row.id}`)
        }
        return {
          id: `analyst-${row.id}`,
          role: 'analyst',
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
            interface: null,
            context_pack: {
              objective:
                'Proposer une interface typée et classer chaque alinéa : calculable, entrée d’appréciation ou hors périmètre motivé.',
              code_title: row.codeTitle,
              article_number: row.articleNumber,
            },
            blind_to: [],
            allowed_paths: [`analyses/${row.id}.md`],
          },
        }
      })
      if (dryRun) {
        console.log(JSON.stringify(tasks, null, 2))
      } else {
        const added = tasks.length
          ? await tx.insert(deskTask).values(tasks).onConflictDoNothing().returning({ id: deskTask.id })
          : []
        console.log(`${added.length} tâche(s) ajoutée(s) sur ${tasks.length} sélectionnée(s).`)
      }
    },
    { accessMode: dryRun ? 'read only' : 'read write' },
  )
} finally {
  await client.end()
}
