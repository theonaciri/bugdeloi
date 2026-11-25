import { permanentRedirect } from '#lib/server/http.ts'
import type { RequestHandler } from './$types'

/** Alias anglais permanent de /registre. */
export const GET: RequestHandler = ({ url }) => permanentRedirect(url, '/registre')
