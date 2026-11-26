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
    territory: 'Guyane · famille avec 1 enfant de 13 ans',
    articleLabel: 'Code de la sécurité sociale, art. D755-5, II, al. 2',
    articleId: 'LEGIARTI000006738575',
    articleUrl: legifranceArticleUrl('LEGIARTI000006738575'),
    expectedCents: 2437,
    actualCents: 3966,
    inriaWhy: 'Applique le filtre de métropole qui exclut l’enfant unique de la majoration d’âge.',
    lawWhy: 'L’article D755-5 en vigueur prévoit une majoration de 3,69 % dès 11 ans en Guyane.',
    summary:
      'Deux lectures du texte s’opposent : le renvoi général excluant l’aîné (24,37 €) face à la règle spéciale Guyane pour enfant unique dès 11 ans (39,66 €). Un juriste doit trancher.',
    verifications: readVerifications('Test3', reports, reportsUrl),
  },
  {
    name: 'Test12',
    territory: 'Mayotte · famille avec 4 enfants à charge',
    articleLabel: 'Ordonnance du 7 février 2002, art. 7, al. 5',
    articleId: 'LEGIARTI000034109930',
    articleUrl: 'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000034109930',
    expectedCents: 31584,
    actualCents: 19245,
    inriaWhy:
      'Cumule un ancien montant maintenu (57,28 €) et une majoration d’âge métropolitaine avec le barème 4 enfants.',
    lawWhy: 'L’ordonnance en vigueur réserve ce maintien au cas d’un enfant resté seul à charge.',
    summary:
      'Les deux relectures indépendantes confirment que la loi en vigueur ne prévoit pas ce cumul pour 4 enfants. En attente d’arbitrage par un juriste.',
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
