import { error } from '@sveltejs/kit'
import { CACHE } from '#lib/server/http.ts'
import { eventDetail } from '#lib/server/queries.ts'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params, setHeaders }) => {
  const id = Number(params.id)
  if (!/^[1-9]\d*$/.test(params.id) || !Number.isSafeInteger(id)) error(404, 'Événement introuvable')
  const entry = await eventDetail(id)
  if (!entry) error(404, 'Événement introuvable')
  setHeaders({ 'cache-control': CACHE.data })
  return { entry }
}
