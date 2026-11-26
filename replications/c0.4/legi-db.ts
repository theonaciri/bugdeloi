import { createDb, legalArticle, legalText } from '@bugdeloi/db'
import { eq, inArray } from 'drizzle-orm'
import { CODES, sha256Hex } from '../../packages/core/src/legi.ts'
import type { BlindArticle } from './packet.ts'

export async function readLegiArticles(ids: Iterable<string>): Promise<BlindArticle[]> {
  const unique = [...new Set(ids)].sort()
  if (unique.length === 0) return []

  const { db, sql } = createDb()
  try {
    const rows = await db.transaction(
      (tx) =>
        tx
          .select({
            legiarti: legalArticle.id,
            code: legalText.shortTitle,
            article: legalArticle.num,
            dateDebut: legalArticle.dateDebut,
            dateFin: legalArticle.dateFin,
            textSha256: legalArticle.textSha256,
            text: legalArticle.contentText,
          })
          .from(legalArticle)
          .innerJoin(legalText, eq(legalArticle.textId, legalText.id))
          .where(inArray(legalArticle.id, unique))
          .orderBy(legalArticle.id),
      { accessMode: 'read only' },
    )
    return rows.map(({ code, ...row }) => {
      if (code !== CODES.CGI.short && code !== CODES.CSS.short && code !== CODES.CCH.short) {
        throw new Error(`Code hors périmètre pour ${row.legiarti}.`)
      }
      if (!row.text.trim() || sha256Hex(row.text) !== row.textSha256) {
        throw new Error(`Texte LEGI absent ou empreinte incohérente pour ${row.legiarti}.`)
      }
      return { ...row, code }
    })
  } finally {
    await sql.end()
  }
}
