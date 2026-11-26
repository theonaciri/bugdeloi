import { legifranceArticleUrl } from '@bugdeloi/core/legi'
import { C03_CASE_CONTEXT } from '#lib/c03-overview.ts'
import type { CodeMapPreview, EuroCase } from '#lib/components/viz/index.ts'
import { readVerifications } from '#lib/server/c03-verifications.ts'
import { CACHE } from '#lib/server/http.ts'
import { CODE_KEYS, mapData, snapshot } from '#lib/server/queries.ts'
import summary from '../../../../replications/c0.3/summary.json'
import type { PageServerLoad } from './$types'

const reports = import.meta.glob<string>('../../../../docs/audits/verifications/2026-11-25-c0.3-*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
})
const reportsUrl = 'https://github.com/theonaciri/bugdeloi/blob/j0-fondations/docs/audits/verifications'

const c03EuroCases: EuroCase[] = summary.cases
  .filter(
    (row): row is typeof row & { expected: number; actual: number } =>
      typeof row.expected === 'number' && typeof row.actual === 'number',
  )
  .map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status === 'passed' ? 'passed' : row.status === 'failed' ? 'failed' : 'error',
    expected: row.expected,
    actual: row.actual,
    classification: row.classification,
    contextLabel: C03_CASE_CONTEXT[row.name],
  }))

const c03Spotlights = [
  {
    name: 'Test3',
    territory: 'Guyane · enfant unique de 13 ans',
    articleLabel: 'CSS art. D755-5, II, alinéa 2',
    articleId: 'LEGIARTI000006738575',
    articleUrl: legifranceArticleUrl('LEGIARTI000006738575'),
    expectedCents: 2437,
    actualCents: 3966,
    summary:
      'Le barème spécial fixe une majoration de 3,69 % à partir de 11 ans ; le filtre Inria applique la règle métropolitaine qui exclut l’aîné.',
    verifications: readVerifications('Test3', reports, reportsUrl),
  },
  {
    name: 'Test12',
    territory: 'Mayotte · 4 enfants à charge',
    articleLabel: 'Ordonnance du 7 fév. 2002, art. 7, al. 5',
    articleId: 'LEGIARTI000034109930',
    articleUrl: 'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000034109930',
    expectedCents: 31584,
    actualCents: 19245,
    summary:
      'Le texte limite le maintien de l’ancien montant à un enfant resté seul à charge ; le témoin Inria cumule 57,28 € de maintien et la majoration d’âge au barème 4 enfants.',
    verifications: readVerifications('Test12', reports, reportsUrl),
  },
]

export const load: PageServerLoad = async ({ setHeaders, url }) => {
  try {
    const [snap, ...maps] = await Promise.all([snapshot(), ...CODE_KEYS.map((code) => mapData(code, null))])
    const mapPreviews: CodeMapPreview[] = maps
      .filter((m): m is NonNullable<typeof m> => Boolean(m?.ingested))
      .map((m) => {
        const progress = snap.codes.find((c) => c.short === m.code)
        return {
          code: m.code,
          codeTitle: m.codeTitle,
          inForce: progress?.inForce ?? 0,
          refCount: progress?.byLevel.REF ?? 0,
          focus: m.focus,
          sections: m.sections,
          counts: m.counts,
          articles: m.articles,
        }
      })

    setHeaders({ 'cache-control': CACHE.live })
    return {
      snapshot: snap,
      mapPreviews,
      c03: {
        scores: summary.scores,
        cases: c03EuroCases,
        spotlights: c03Spotlights,
      },
      origin: url.origin,
      dbError: false,
    }
  } catch (e) {
    console.error('[accueil] base injoignable', e)
    setHeaders({ 'cache-control': 'no-store' })
    return {
      snapshot: null,
      mapPreviews: [] as CodeMapPreview[],
      c03: {
        scores: summary.scores,
        cases: c03EuroCases,
        spotlights: c03Spotlights,
      },
      origin: url.origin,
      dbError: true,
    }
  }
}
