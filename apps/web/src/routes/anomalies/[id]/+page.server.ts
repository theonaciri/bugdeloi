import { error } from '@sveltejs/kit'
import { CACHE } from '#lib/server/http.ts'
import { findingDetail } from '#lib/server/queries.ts'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, setHeaders }) => {
  const finding = await findingDetail(params.id)
  if (!finding) error(404, 'Anomalie introuvable')
  setHeaders({ 'cache-control': CACHE.data })
  return { finding }
}
