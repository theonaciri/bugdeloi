import { json } from '@sveltejs/kit'
import { db } from '#lib/server/db.ts'
import { claimTasks } from '#lib/server/desk.ts'
import { deskError } from '#lib/server/desk-http.ts'
import { parseDeskNextInput } from '#lib/server/desk-input.ts'
import { notifyDeskUpdate } from '#lib/server/stream.ts'
import type { RequestHandler } from './$types'

export const trailingSlash = 'ignore'

export const GET: RequestHandler = async ({ url }) => {
  const input = parseDeskNextInput(url.searchParams)
  if (!input) return deskError(400, 'invalid_parameters')

  const claims = await claimTasks(db(), input)
  if (claims.length === 0) return new Response(null, { status: 204 })

  notifyDeskUpdate()
  if (claims.length === 1 && claims[0]) {
    return json({ ...claims[0], count: 1, tasks: claims })
  }
  return json({ count: claims.length, tasks: claims })
}

// SvelteKit appelle normalement GET pour HEAD. HEAD ne doit jamais prendre de bail.
export const HEAD: RequestHandler = () => new Response(null, { headers: { allow: 'GET, HEAD' } })
