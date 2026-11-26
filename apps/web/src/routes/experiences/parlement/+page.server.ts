import sampleFixture from '../../../../../../packages/parlement/src/fixtures/plf2026-sample.json'
import { calculImpact } from '../../../../../../packages/parlement/src/impact.ts'
import { articlesSuivis, veille } from '../../../../../../packages/parlement/src/tricoteuses.ts'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = () => {
  const suivis = veille(sampleFixture)
  const resultats = suivis.map((suivi) => ({
    amendement: suivi.amendement,
    correspondances: suivi.correspondances,
    extraction: suivi.extraction,
    impact: calculImpact(suivi),
  }))

  return {
    articlesSuivis,
    resultats,
  }
}
