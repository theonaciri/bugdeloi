import { CACHE } from '#lib/server/http.ts'
import { FINDINGS_OFFSET_MAX, publicFindings, workingFindings } from '#lib/server/queries.ts'
import type { PageServerLoad } from './$types'

const pendingTypes = ['REF_MORTE', 'SYNTAXE'] as const
const pageSize = 20

export const load: PageServerLoad = async ({ url, setHeaders }) => {
  const requestedType = url.searchParams.get('type')
  const type = pendingTypes.find((value) => value === requestedType)
  const requestedPage = url.searchParams.get('page') ?? ''
  const pageNumber = Number(requestedPage)
  const page =
    /^[0-9]+$/u.test(requestedPage) &&
    Number.isSafeInteger(pageNumber) &&
    pageNumber >= 1 &&
    pageNumber <= Math.floor(FINDINGS_OFFSET_MAX / pageSize) + 1
      ? pageNumber
      : 1
  const offset = (page - 1) * pageSize

  setHeaders({ 'cache-control': CACHE.live })
  const [findings, activeList, refMorte, syntaxe, candidates] = await Promise.all([
    publicFindings(),
    workingFindings({ status: 'reproduced', type, limit: pageSize, offset }),
    workingFindings({ status: 'reproduced', type: 'REF_MORTE', limit: 1 }),
    workingFindings({ status: 'reproduced', type: 'SYNTAXE', limit: 1 }),
    workingFindings({ status: 'candidate', limit: 1 }),
  ])

  return {
    findings,
    pending: {
      total: activeList.total,
      items: activeList.items,
      refMorteCount: refMorte.total,
      syntaxeCount: syntaxe.total,
      candidateCount: candidates.total,
      activeType: type ?? null,
      page,
      pageSize,
    },
  }
}
