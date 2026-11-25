import { permanentRedirect } from '#lib/server/http.ts'
import type { RequestHandler } from './$types'

/** Alias anglais permanent de /methode. */
export const GET: RequestHandler = ({ url }) => permanentRedirect(url, '/methode')
