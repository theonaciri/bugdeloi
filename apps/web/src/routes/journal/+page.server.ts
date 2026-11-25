import { error } from '@sveltejs/kit'
import { CACHE } from '#lib/server/http.ts'
import { journalEntries } from '#lib/server/queries.ts'
import type { PageServerLoad } from './$types'

const pageSize = 30

export const load: PageServerLoad = async ({ url, setHeaders }) => {
  const cursor = url.searchParams.get('avant')
  const before = cursor === null ? undefined : Number(cursor)
  if (cursor !== null && (!/^[1-9]\d*$/.test(cursor) || !Number.isSafeInteger(before))) {
    error(400, 'Page de journal invalide')
  }

  const entries = await journalEntries(pageSize + 1, before)
  const page = entries.slice(0, pageSize)
  setHeaders({ 'cache-control': CACHE.live })
  return { entries: page, older: entries.length > pageSize ? page.at(-1)?.id : null, before }
}
