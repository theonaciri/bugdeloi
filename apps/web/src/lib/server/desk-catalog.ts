import { CODES, legifranceArticleUrl, sha256Hex } from '@bugdeloi/core/legi'
import { articleInForce, articleStatus, deskTask, legalArticle, legalText } from '@bugdeloi/db'
import { and, eq, isNotNull, ne, notInArray, sql } from 'drizzle-orm'
import { translations } from './desk-translations.ts'
import { frozenInterfaces, translationTaskId } from './interfaces.ts'

/**
 * Articles pour lesquels le guichet créerait une tâche au prochain appel.
 * Traduction : interface figée (fiche d'analyse fusionnée ou liste manuelle), texte inchangé depuis
 * l'analyse, aucune tâche de traduction déjà inscrite, article pas encore au niveau N2.
 */
export function newDeskTaskFilter(role: 'analyst' | 'translate') {
  if (role === 'translate') {
    const specs = [...frozenInterfaces().values()]
    if (specs.length === 0) return sql`false`
    const pairs = sql.join(
      specs.map((s) => sql`(${s.legiarti}, ${s.hash})`),
      sql`, `,
    )
    return and(
      articleInForce(),
      sql`(${legalArticle.id}, ${legalArticle.textSha256}) in (values ${pairs})`,
      sql`not exists (select 1 from ${deskTask}
        where ${deskTask.role} = 'translate' and ${deskTask.payload}->>'node' = ${legalArticle.id})`,
      sql`not exists (select 1 from ${articleStatus} where ${articleStatus.articleId} = ${legalArticle.id}
        and ${articleStatus.level} in ('N2', 'N3', 'N4', 'N5'))`,
    )
  }
  return and(
    articleInForce(),
    isNotNull(legalArticle.sectionId),
    isNotNull(legalArticle.num),
    eq(legalArticle.type, 'AUTONOME'),
    ne(legalArticle.contentText, ''),
    sql`case when octet_length(${legalArticle.contentText}) <= 32
      then ${legalArticle.contentText} !~* '^(article )?réservé[. ]*$' else true end`,
    notInArray(
      legalArticle.id,
      translations.map((spec) => spec.legiarti),
    ),
    sql`not exists (select 1 from ${deskTask} where ${deskTask.id} = 'analyst-' || ${legalArticle.id})`,
    sql`not exists (select 1 from ${articleStatus}
      where ${articleStatus.articleId} = ${legalArticle.id} and ${articleStatus.level} <> 'N0')`,
  )
}

/** Écarte les tâches dont une version ou une empreinte LEGI n'est plus courante. */
export const currentDeskTask = sql`not exists (
  select 1 from jsonb_array_elements(${deskTask.payload}->'legal_units') as units(unit)
  where not exists (
    select 1 from ${legalArticle}
    where ${legalArticle.id} = unit->>'legiarti'
      and ${legalArticle.textSha256} = unit->>'text_sha256'
      and ${legalArticle.dateDebut}::text = unit->>'date_debut'
      and ${articleInForce()}
  )
)`

export const taskArticle = {
  id: legalArticle.id,
  sectionId: legalArticle.sectionId,
  textId: legalArticle.textId,
  dateDebut: legalArticle.dateDebut,
  dateFin: legalArticle.dateFin,
  text: legalArticle.contentText,
  hash: legalArticle.textSha256,
  articleNumber: legalArticle.num,
  codeTitle: legalText.title,
}

type TaskArticle = Pick<typeof legalArticle.$inferSelect, 'id' | 'dateDebut' | 'dateFin'> & {
  text: string
  hash: string
  articleNumber: string | null
  codeTitle: string
}

/** `path` : chemin Catala calculé depuis l'arbre Légifrance quand l'interface n'en impose pas. */
export function newDeskTask(row: TaskArticle, role: 'analyst' | 'translate', path?: string) {
  const spec = role === 'translate' ? frozenInterfaces().get(row.id) : undefined
  if (role === 'translate' && !spec) throw new Error(`Aucune interface figée pour ${row.id}`)
  if (!row.dateDebut || sha256Hex(row.text) !== row.hash) {
    throw new Error(`Version ou empreinte incohérente pour ${row.id}`)
  }
  return {
    id: spec ? translationTaskId(spec) : `analyst-${row.id}`,
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
      interface: spec?.interface ?? null,
      context_pack: {
        objective: spec
          ? `Traduire l’article en Catala selon l’interface figée ${spec.interface}. ${spec.signature}${
              spec.analysisFile ? ` Fiche d’analyse : ${spec.analysisFile}.` : ''
            }`
          : 'Proposer une interface typée et classer chaque alinéa : calculable, entrée d’appréciation ou hors périmètre motivé.',
        code_title: row.codeTitle,
        article_number: row.articleNumber,
      },
      blind_to: [],
      allowed_paths: [spec ? (spec.path ?? path ?? `${row.id}.catala_fr`) : `analyses/${row.id}.md`],
    },
  } satisfies typeof deskTask.$inferInsert
}

const SHORT_BY_TITLE = new Map<string, string>(Object.values(CODES).map((c) => [c.title, c.short]))
const SHORT_BY_ID = new Map<string, string>(Object.values(CODES).map((c) => [c.id, c.short]))

/** Sigle d'un code (« CGI ») à partir de son titre ou de son identifiant LEGITEXT. */
export function codeShort(titleOrId: string | null | undefined): string | null {
  if (!titleOrId) return null
  return SHORT_BY_ID.get(titleOrId) ?? SHORT_BY_TITLE.get(titleOrId.replace(/'/g, '’')) ?? null
}

/** Libellé court et lisible d'un article : « CGI art. 1657 ». */
export function articleLabel(code: string | null, num: string | null, legiarti: string | null): string {
  if (num) return `${code ? `${code} ` : ''}art. ${num}`
  return legiarti ?? 'article inconnu'
}

/** Libellé d'une tâche à partir de son contenu, sans requête. */
export function taskLabel(payload: {
  node?: string
  context_pack?: { code_title?: string; article_number?: string | null }
}): string {
  return articleLabel(
    codeShort(payload.context_pack?.code_title),
    payload.context_pack?.article_number ?? null,
    payload.node ?? null,
  )
}
