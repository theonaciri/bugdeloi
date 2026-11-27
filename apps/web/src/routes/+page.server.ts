import { legifranceArticleUrl } from '@bugdeloi/core/legi'
import { articleStatus } from '@bugdeloi/db'
import { eq } from 'drizzle-orm'
import { C03_CASE_CONTEXT } from '#lib/c03-overview.ts'
import type { EuroCase } from '#lib/components/viz/index.ts'
import { asLevel } from '#lib/levels.ts'
import { readVerifications } from '#lib/server/c03-verifications.ts'
import { db } from '#lib/server/db.ts'
import { CACHE } from '#lib/server/http.ts'
import { snapshot } from '#lib/server/queries.ts'
import summary from '../../../../replications/c0.3/summary.json'
import type { PageServerLoad } from './$types'

const reports = import.meta.glob<string>('../../../../docs/audits/verifications/2026-11-25-c0.3-*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
})
const reportsUrl = 'https://github.com/theonaciri/bugdeloi/blob/main/docs/audits/verifications'

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

/**
 * Exemple réel pour l'accueil : un article traduit du corpus, lu tel quel dans son fichier.
 * Rien n'est recopié à la main : texte, interface, code et test viennent du fichier versionné.
 */
const specimenFiles = import.meta.glob<string>(
  '../../../../corpus/cgi/livre1/partie1/titre2/chapitre1/section5/i/a/article_278.catala_fr',
  { eager: true, query: '?raw', import: 'default' },
)
const SPECIMEN_PATH = 'corpus/cgi/livre1/partie1/titre2/chapitre1/section5/i/a/article_278.catala_fr'

function parseSpecimen(raw: string | undefined) {
  if (!raw) return null
  const head = /^####\s+Article\s+([^|]+)\|(LEGIARTI\d{12})/m.exec(raw)
  const code = /```catala\n([\s\S]*?)```/.exec(raw)?.[1]
  if (!head || !code) return null
  const afterTitle = raw.slice((head.index ?? 0) + head[0].length).trim()
  const lawText = afterTitle.split(/\n\s*\n/)[0]?.trim() ?? ''
  const [main = '', test = ''] = code.split('#[test]')
  const fields = [...main.matchAll(/^\s*(entrée|résultat)\s+(\S+)\s+contenu\s+(\S+)/gm)].map((m) => ({
    kind: m[1] as 'entrée' | 'résultat',
    name: m[2] ?? '',
    type: m[3] ?? '',
  }))
  const scope = main.slice(main.indexOf("champ d'application", main.indexOf('\n\n'))).trim()
  return {
    num: head[1]?.trim() ?? '',
    legiarti: head[2] ?? '',
    lawText,
    interfaceName: /Interface `([^`]+)`/.exec(raw)?.[1] ?? null,
    fields,
    scope,
    test: `#[test]${test}`.trim(),
    path: SPECIMEN_PATH,
  }
}

const specimen = parseSpecimen(Object.values(specimenFiles)[0])

async function specimenLevel(legiarti: string) {
  const [row] = await db()
    .select({ level: articleStatus.level })
    .from(articleStatus)
    .where(eq(articleStatus.articleId, legiarti))
    .limit(1)
  return asLevel(row?.level)
}

export const load: PageServerLoad = async ({ setHeaders, url }) => {
  const c03 = { scores: summary.scores, cases: c03EuroCases, spotlights: c03Spotlights }
  try {
    const [snap, level] = await Promise.all([
      snapshot(),
      specimen ? specimenLevel(specimen.legiarti) : Promise.resolve(null),
    ])
    setHeaders({ 'cache-control': CACHE.live })
    return {
      snapshot: snap,
      c03,
      specimen: specimen ? { ...specimen, level } : null,
      origin: url.origin,
      dbError: false,
    }
  } catch (e) {
    console.error('[accueil] base injoignable', e)
    setHeaders({ 'cache-control': 'no-store' })
    return {
      snapshot: null,
      c03,
      specimen: specimen ? { ...specimen, level: null } : null,
      origin: url.origin,
      dbError: true,
    }
  }
}
