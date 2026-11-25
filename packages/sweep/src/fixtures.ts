/** Petits contextes construits à la main pour les tests (aucune base requise). */
import { normalizeLegalText } from '@bugdeloi/core/legi'
import { type ArticleRow, buildContext, type ContentRow } from './context.ts'
import type { CodeState, LinkRow, SweepContext } from './types.ts'

export const AS_OF = '2026-11-25'
export const TEXT_A = 'LEGITEXT000006073189' // CSS
export const TEXT_B = 'LEGITEXT000006069577' // CGI

export const CODES_FIXTURE: CodeState[] = [
  {
    textId: TEXT_A,
    code: 'CSS',
    title: 'Code de la sécurité sociale',
    asOf: AS_OF,
    archive: 'test.tar.gz',
    archiveSha256: 'a'.repeat(64),
  },
  {
    textId: TEXT_B,
    code: 'CGI',
    title: 'Code général des impôts',
    asOf: AS_OF,
    archive: 'test.tar.gz',
    archiveSha256: 'a'.repeat(64),
  },
]

export interface ArtSpec {
  id: string
  num: string
  etat: string
  debut: string
  fin?: string | null
  html?: string
  textId?: string
  versionIds?: string[]
}

export function art(spec: ArtSpec): { row: ArticleRow; content: ContentRow } {
  const html = spec.html ?? ''
  return {
    row: {
      id: spec.id,
      textId: spec.textId ?? TEXT_A,
      num: spec.num,
      etat: spec.etat,
      dateDebut: spec.debut,
      dateFin: spec.fin === undefined ? '2999-01-01' : spec.fin,
      versionIds: spec.versionIds ?? [spec.id],
      textSha256: `sha-${spec.id}`,
    },
    content: { id: spec.id, contentText: normalizeLegalText(html), contentHtml: html },
  }
}

export function link(
  articleId: string,
  targetId: string | null,
  targetNum: string | null,
  extra: Partial<LinkRow> = {},
): LinkRow {
  return {
    articleId,
    typeLien: 'CITATION',
    sens: 'source',
    targetId,
    targetCid: targetId?.startsWith('LEGIARTI') ? TEXT_A : null,
    targetNum,
    targetNature: 'CODE',
    label: targetNum ? `Code de la sécurité sociale. - art. ${targetNum}` : null,
    ...extra,
  }
}

export function ctxOf(specs: ArtSpec[], links: LinkRow[] = [], endOfLife: LinkRow[] = []): SweepContext {
  const arts = specs.map(art)
  return buildContext({
    codes: CODES_FIXTURE,
    articles: arts.map((a) => a.row),
    contents: arts.map((a) => a.content),
    citations: links,
    endOfLife,
  })
}
