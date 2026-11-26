import { legifranceArticleUrl } from '@bugdeloi/core/legi'
import c06Summary from '../../../../../../replications/c0.6/summary.json'
import type { PageServerLoad } from './$types'

const repo = 'https://github.com/theonaciri/bugdeloi/blob/j0-fondations'

export const load: PageServerLoad = () => ({
  c06: c06Summary,
  articles: [
    {
      num: 'Article 193',
      id: 'LEGIARTI000054373592',
      role: 'Division par le nombre de parts et arrondi à l’euro',
      url: legifranceArticleUrl('LEGIARTI000054373592'),
    },
    {
      num: 'Article 194',
      id: 'LEGIARTI000033817781',
      role: 'Calcul du nombre de parts et majoration parent isolé',
      url: legifranceArticleUrl('LEGIARTI000033817781'),
    },
    {
      num: 'Article 197',
      id: 'LEGIARTI000053542636',
      role: 'Barème 2026, plafonnement du quotient familial, outre-mer et décote',
      url: legifranceArticleUrl('LEGIARTI000053542636'),
    },
  ],
  links: {
    catala: `${repo}/corpus/cgi/livre1/partie1/titre1/chapitre1/section5/noyau_ir.catala_fr`,
    oracles: `${repo}/corpus/oracles/noyau_ir/cgi_197_2026.yaml`,
    report: `${repo}/replications/c0.6/REPORT.md`,
  },
})
