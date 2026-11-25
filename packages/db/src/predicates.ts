/**
 * Prédicats SQL partagés. Doivent rester équivalents aux règles JS de @bugdeloi/core.
 */
import { LEGI_OPEN_END, NEVER_IN_FORCE_ETATS } from '@bugdeloi/core/legi'
import { type SQL, sql } from 'drizzle-orm'
import { legalArticle, legiState } from './schema.ts'

/**
 * « Article en vigueur » (équivalent de `isInForce` de @bugdeloi/core/legi), évalué à la date de
 * projection de son code (`legi_state.as_of`, celle de l'arbre des sections), ou à `asOf` si fourni.
 * À utiliser dans toute requête sur `legal_article` non aliasée.
 */
export function articleInForce(asOf?: string): SQL {
  const date = asOf
    ? sql`${asOf}::date`
    : sql`coalesce((select ${legiState.asOf} from ${legiState} where ${legiState.textId} = ${legalArticle.textId}), current_date)`
  const excluded = sql.join(
    NEVER_IN_FORCE_ETATS.map((e) => sql`${e}`),
    sql`, `,
  )
  const openEnd = sql`(${legalArticle.dateFin} is null or ${legalArticle.dateFin} = ${LEGI_OPEN_END}::date)`
  return sql`(coalesce(${legalArticle.etat}, '') not in (${excluded})
    and not (coalesce(${legalArticle.etat}, '') = 'MODIFIE' and ${openEnd})
    and ${legalArticle.dateDebut} <= ${date}
    and (${legalArticle.dateFin} is null or ${legalArticle.dateFin} = ${LEGI_OPEN_END}::date or ${date} < ${legalArticle.dateFin}))`
}
