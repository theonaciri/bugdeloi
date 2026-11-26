import { legifranceArticleUrl } from '@bugdeloi/core/legi'
import { C03_CASE_CONTEXT } from '#lib/c03-overview.ts'
import type { EuroCase } from '#lib/components/viz/C03EuroBars.svelte'
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

const euroCases: EuroCase[] = summary.cases
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
    contextLabel: C03_CASE_CONTEXT[row.name]?.replaceAll(' \u2014 ', ' · '),
  }))

const articles = {
  Test3: {
    label: 'Article D755-5, II, alinéa 2, du code de la sécurité sociale',
    id: 'LEGIARTI000006738575',
    version: '1998-12-30',
    question: 'La majoration d’âge s’applique-t-elle à un enfant unique en Guyane ?',
    territory: 'Guyane · un enfant unique de 13 ans',
    inriaWhy:
      'Le programme Inria applique une règle générale qui exclut l’enfant unique de la majoration d’âge.',
    lawWhy:
      'Notre programme applique la règle propre à la Guyane de l’article D755-5. Elle prévoit un supplément lié à l’âge pour un enfant unique.',
  },
  Test12: {
    label: 'Article 7, alinéa 5, de l’ordonnance du 7 février 2002',
    id: 'LEGIARTI000034109930',
    version: '2018-01-01',
    question:
      'À Mayotte, dans quelles conditions l’ancien montant reste-t-il applicable quand plusieurs enfants sont à charge ?',
    territory: 'Mayotte · quatre enfants à charge',
    inriaWhy:
      'Le programme Inria ajoute au montant pour quatre enfants un ancien montant maintenu et un supplément lié à l’âge.',
    lawWhy:
      'L’article 7 réserve le maintien de l’ancien montant aux foyers où cet enfant reste seul à charge. Notre programme applique le barème de Mayotte à la date du cas.',
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
  euroCases,
  scores: summary.scores,
  disagreements,
  audit,
  method: `${audit}#comptage`,
  source: `${submission}/Calcul.catala_fr`,
  declaration: `${submission}/DECLARATION.md`,
  inria: `https://github.com/CatalaLang/catala-examples/commit/${summary.inriaCommit}`,
})
