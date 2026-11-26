import { json } from '@sveltejs/kit'
import { db } from '#lib/server/db.ts'
import { claimTask } from '#lib/server/desk.ts'
import { deskError } from '#lib/server/desk-http.ts'
import { deskInput, parseDeskInput } from '#lib/server/desk-input.ts'
import { notifyDeskUpdate } from '#lib/server/stream.ts'
import type { RequestHandler } from './$types'

export const trailingSlash = 'ignore'

export const GET: RequestHandler = async ({ url }) => {
  const input = parseDeskInput(url.searchParams, deskInput.next)
  if (!input) return deskError(400, 'invalid_parameters')

  const claim = await claimTask(db(), input)
  if (claim) notifyDeskUpdate()
  return claim ? json(claim) : new Response(null, { status: 204 })
}

// SvelteKit appelle normalement GET pour HEAD. HEAD ne doit jamais prendre de bail.
export const HEAD: RequestHandler = () => new Response(null, { headers: { allow: 'GET, HEAD' } })
