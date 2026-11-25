import { legifranceArticleUrl } from '@bugdeloi/core/legi'
import { readVerifications } from '#lib/server/c03-verifications.ts'
import summary from '../../../../../../replications/c0.3/summary.json'
import type { PageServerLoad } from './$types'

const repo = 'https://github.com/theonaciri/bugdeloi/blob'
const audit = `${repo}/41575d8/docs/audits/2026-11-25-c0.3-evaluation.md`
const submission = `${repo}/${summary.submissionCommit}/replications/c0.3/submission/${summary.handle}`

const reports = import.meta.glob<string>('../../../../../../docs/audits/verifications/2026-11-25-c0.3-*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
})
const reportsUrl = `${repo}/j0-fondations/docs/audits/verifications`

const articles = {
  Test3: {
    label: 'Article D755-5, II, alinéa 2, du code de la sécurité sociale',
    id: 'LEGIARTI000006738575',
    version: '1998-12-30',
    question: 'La majoration d’âge s’applique-t-elle à un enfant unique en Guyane ?',
  },
  Test12: {
    label: 'Article 7, alinéa 5, de l’ordonnance du 7 février 2002',
    id: 'LEGIARTI000034109930',
    version: '2018-01-01',
    question:
      'À Mayotte, dans quelles conditions l’ancien montant reste-t-il applicable quand plusieurs enfants sont à charge ?',
  },
} as const

const disagreements = (['Test3', 'Test12'] as const).map((name) => {
  const result = summary.cases.find((test) => test.name === name)
  if (!result) throw new Error(`Cas C0.3 absent : ${name}.`)
  const article = articles[name]
  const url =
    name === 'Test3'
      ? legifranceArticleUrl(article.id)
      : `https://www.legifrance.gouv.fr/loda/article_lc/${article.id}`
  return {
    result,
    article: { ...article, url },
    verifications: readVerifications(name, reports, reportsUrl),
  }
})

export const load: PageServerLoad = () => ({
  cases: summary.cases,
  scores: summary.scores,
  disagreements,
  audit,
  method: `${audit}#comptage`,
  source: `${submission}/Calcul.catala_fr`,
  declaration: `${submission}/DECLARATION.md`,
  inria: `https://github.com/CatalaLang/catala-examples/commit/${summary.inriaCommit}`,
})
