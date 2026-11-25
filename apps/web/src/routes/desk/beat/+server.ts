import { json } from '@sveltejs/kit'
import { db } from '#lib/server/db.ts'
import { updateLease } from '#lib/server/desk.ts'
import { deskError } from '#lib/server/desk-http.ts'
import { deskInput, parseDeskInput } from '#lib/server/desk-input.ts'
import type { RequestHandler } from './$types'

export const trailingSlash = 'ignore'

export const POST: RequestHandler = async ({ url }) => {
  const input = parseDeskInput(url.searchParams, deskInput.beat)
  if (!input) return deskError(400, 'invalid_parameters')

  const lease = await updateLease(db(), input.lease)
  return lease ? json(lease) : deskError(410, 'lease_gone')
}
