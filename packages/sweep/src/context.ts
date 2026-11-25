/**
 * Contexte de balayage : tout ce que lisent les détecteurs, chargé une fois depuis Postgres.
 * `buildContext` est pure (testable sans base) ; `loadContext` l'alimente depuis `bugdeloi`.
 *
 * Règle « en vigueur » : `isInForce` de @bugdeloi/core, à la date de projection (`legi_state.as_of`)
 * du code de la version — jamais `etat = 'VIGUEUR'` seul. `loadContext` contrôle qu'elle retient
 * exactement les mêmes versions que `articleInForce()` (SQL) et s'arrête sinon.
 */
import { CODES, isInForce, NEVER_IN_FORCE_ETATS } from '@bugdeloi/core/legi'
import { articleInForce, type Db, legalArticle, legalLink, legalText, legiState } from '@bugdeloi/db'
import { and, inArray, or, sql } from 'drizzle-orm'
import { normalizeNum } from './citations.ts'
import { paragraphsOf } from './text.ts'
import type { CodeState, Lineage, LinkRow, SweepContext, Version } from './types.ts'

export interface ArticleRow {
  id: string
  textId: string
  num: string | null
  etat: string | null
  dateDebut: string | null
  dateFin: string | null
  versionIds: string[]
  textSha256: string
}

export interface ContentRow {
  id: string
  contentText: string
  contentHtml: string
}

export interface ContextInput {
  codes: CodeState[]
  articles: ArticleRow[]
  contents: ContentRow[]
  citations: LinkRow[]
  endOfLife: LinkRow[]
}

/** Types de liens qui décrivent la fin de vie d'une version (cible = texte ou article de remplacement). */
export const END_OF_LIFE_LINKS = [
  'ABROGE',
  'ABROGATION',
  'TRANSFERE',
  'TRANSFERT',
  'DEPLACE',
  'DEPLACEMENT',
  'PERIME',
  'PEREMPTION',
  'DISJOINT',
  'DISJONCTION',
  'ANNULATION',
] as const

class UnionFind {
  private parent = new Map<string, string>()
  find(x: string): string {
    let p = this.parent.get(x)
    if (p === undefined) {
      this.parent.set(x, x)
      return x
    }
    let root = x
    while (p !== undefined && p !== root) {
      root = p
      p = this.parent.get(root)
    }
    // compression de chemin
    let cur = x
    while (cur !== root) {
      const next = this.parent.get(cur) as string
      this.parent.set(cur, root)
      cur = next
    }
    return root
  }
  union(a: string, b: string) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra === rb) return
    const [lo, hi] = ra < rb ? [ra, rb] : [rb, ra] // la racine est le plus petit identifiant
    this.parent.set(hi as string, lo as string)
  }
}

const byStart = (a: Version, b: Version) =>
  (a.dateDebut ?? '').localeCompare(b.dateDebut ?? '') ||
  (a.dateFin ?? '').localeCompare(b.dateFin ?? '') ||
  a.id.localeCompare(b.id)

export function buildContext(input: ContextInput): SweepContext {
  const asOfByText = new Map(input.codes.map((c) => [c.textId, c.asOf]))
  const codeByText = new Map(input.codes.map((c) => [c.textId, c.code]))
  const contents = new Map(input.contents.map((c) => [c.id, c]))

  const versions = new Map<string, Version>()
  for (const a of input.articles) {
    const asOf = asOfByText.get(a.textId)
    const inForce = asOf ? isInForce(a, asOf) : false
    const content = inForce ? contents.get(a.id) : undefined
    versions.set(a.id, {
      id: a.id,
      textId: a.textId,
      code: codeByText.get(a.textId) ?? a.textId,
      num: a.num,
      etat: a.etat,
      dateDebut: a.dateDebut,
      dateFin: a.dateFin,
      versionIds: a.versionIds,
      textSha256: a.textSha256,
      inForce,
      contentText: content?.contentText ?? '',
      paragraphs: content ? paragraphsOf(content.contentHtml) : [],
    })
  }

  // Lignées : composantes connexes des blocs VERSIONS. Les blocs des anciennes versions sont
  // incomplets, d'où l'union de tous (voir docs/notes/sweep.md).
  const uf = new UnionFind()
  for (const v of versions.values()) {
    uf.find(v.id)
    for (const other of v.versionIds) uf.union(v.id, other)
  }
  const groups = new Map<string, Version[]>()
  for (const v of versions.values()) {
    const root = uf.find(v.id)
    const list = groups.get(root)
    if (list) list.push(v)
    else groups.set(root, [v])
  }

  const lineageOf = new Map<string, Lineage>()
  const lineages: Lineage[] = []
  const lineagesByNum = new Map<string, Lineage[]>()
  for (const members of groups.values()) {
    members.sort(byStart)
    const first = members[0] as Version
    const asOf = asOfByText.get(first.textId) ?? ''
    const nums = [...new Set(members.map((m) => (m.num ? normalizeNum(m.num) : '')).filter(Boolean))].sort()
    const lineage: Lineage = {
      id: members.map((m) => m.id).sort()[0] as string,
      textId: first.textId,
      code: first.code,
      versions: members,
      nums,
      inForce: members.filter((m) => m.inForce),
      upcoming: members.some(
        (m) =>
          Boolean(m.dateDebut && m.dateDebut > asOf) &&
          !(NEVER_IN_FORCE_ETATS as readonly string[]).includes(m.etat ?? ''),
      ),
      // Une version « mort-née » (jamais entrée en vigueur) ne dit rien de la fin de vie de l'article.
      last: (members.filter((m) => m.etat !== 'MODIFIE_MORT_NE').at(-1) ??
        members[members.length - 1]) as Version,
    }
    lineages.push(lineage)
    for (const m of members) lineageOf.set(m.id, lineage)
    // Identifiants cités par un bloc VERSIONS mais absents de la base : rattachés à la lignée.
    for (const m of members)
      for (const other of m.versionIds) if (!versions.has(other)) lineageOf.set(other, lineage)
    for (const n of nums) {
      const key = `${lineage.textId}|${n}`
      const list = lineagesByNum.get(key)
      if (list) list.push(lineage)
      else lineagesByNum.set(key, [lineage])
    }
  }
  lineages.sort((a, b) => a.id.localeCompare(b.id))

  const group = (rows: LinkRow[]) => {
    const m = new Map<string, LinkRow[]>()
    for (const r of rows) {
      const list = m.get(r.articleId)
      if (list) list.push(r)
      else m.set(r.articleId, [r])
    }
    return m
  }

  return {
    codes: input.codes,
    versions,
    lineageOf,
    lineages,
    lineagesByNum,
    inForce: [...versions.values()].filter((v) => v.inForce).sort((a, b) => a.id.localeCompare(b.id)),
    citations: group(input.citations),
    endOfLife: group(input.endOfLife),
  }
}

const shortOf = (textId: string) => Object.values(CODES).find((c) => c.id === textId)?.short ?? textId

/** Charge le contexte depuis Postgres. Ne lit jamais plus que ce qu'il faut du contenu. */
export async function loadContext(db: Db): Promise<SweepContext> {
  const stateRows = await db
    .select({
      textId: legiState.textId,
      title: legalText.title,
      asOf: legiState.asOf,
      archive: legiState.archive,
      archiveSha256: legiState.archiveSha256,
    })
    .from(legiState)
    .innerJoin(legalText, sql`${legalText.id} = ${legiState.textId}`)
  const codes: CodeState[] = stateRows
    .map((r) => ({
      textId: r.textId,
      code: shortOf(r.textId),
      title: r.title,
      asOf: r.asOf,
      archive: r.archive,
      archiveSha256: r.archiveSha256,
    }))
    .sort((a, b) => a.code.localeCompare(b.code))
  if (codes.length === 0) throw new Error('Aucun code ingéré (table legi_state vide).')

  const articles: ArticleRow[] = await db
    .select({
      id: legalArticle.id,
      textId: legalArticle.textId,
      num: legalArticle.num,
      etat: legalArticle.etat,
      dateDebut: legalArticle.dateDebut,
      dateFin: legalArticle.dateFin,
      versionIds: legalArticle.versionIds,
      textSha256: legalArticle.textSha256,
    })
    .from(legalArticle)

  // Contenu : uniquement les versions en vigueur selon le prédicat SQL commun.
  const contents: ContentRow[] = await db
    .select({
      id: legalArticle.id,
      contentText: legalArticle.contentText,
      contentHtml: legalArticle.contentHtml,
    })
    .from(legalArticle)
    .where(articleInForce())

  const citationRows = await db
    .select({
      articleId: legalLink.articleId,
      typeLien: legalLink.typeLien,
      sens: legalLink.sens,
      targetId: legalLink.targetId,
      targetCid: legalLink.targetCid,
      targetNum: legalLink.targetNum,
      targetNature: legalLink.targetNature,
      label: legalLink.label,
      id: legalLink.id,
    })
    .from(legalLink)
    .innerJoin(legalArticle, sql`${legalArticle.id} = ${legalLink.articleId}`)
    .where(and(sql`${legalLink.typeLien} = 'CITATION'`, sql`${legalLink.sens} = 'source'`, articleInForce()))
    .orderBy(legalLink.id)
  const endRows = await db
    .select({
      articleId: legalLink.articleId,
      typeLien: legalLink.typeLien,
      sens: legalLink.sens,
      targetId: legalLink.targetId,
      targetCid: legalLink.targetCid,
      targetNum: legalLink.targetNum,
      targetNature: legalLink.targetNature,
      label: legalLink.label,
      id: legalLink.id,
    })
    .from(legalLink)
    .where(or(inArray(legalLink.typeLien, [...END_OF_LIFE_LINKS])))
    .orderBy(legalLink.id)

  const strip = ({ id: _id, ...row }: (typeof citationRows)[number]): LinkRow => row
  const ctx = buildContext({
    codes,
    articles,
    contents,
    citations: citationRows.map(strip),
    endOfLife: endRows.map(strip),
  })

  const sqlInForce = new Set(contents.map((c) => c.id))
  const jsInForce = new Set(ctx.inForce.map((v) => v.id))
  const diff =
    [...sqlInForce].filter((id) => !jsInForce.has(id)).length +
    [...jsInForce].filter((id) => !sqlInForce.has(id)).length
  if (diff !== 0) {
    throw new Error(
      `La règle « en vigueur » diverge : SQL ${sqlInForce.size} versions, JS ${jsInForce.size} (${diff} différences). Balayage interrompu.`,
    )
  }
  return ctx
}
