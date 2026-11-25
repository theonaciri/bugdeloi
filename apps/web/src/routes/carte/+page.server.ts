import { CODES } from '@bugdeloi/core/legi'
import { error } from '@sveltejs/kit'
import { CACHE } from '#lib/server/http.ts'
import { CODE_KEYS, type CodeKey, isCodeKey, mapData, sectionCode } from '#lib/server/queries.ts'
import type { PageServerLoad } from './$types'

/**
 * /carte?code=CGI[&s=LEGISCTA…] — la fenêtre de la carte est calculée côté serveur ;
 * la disposition (treemap) est refaite côté navigateur à la largeur de l'écran.
 */
export const load: PageServerLoad = async ({ url, setHeaders }) => {
  const s = url.searchParams.get('s')
  const requested = url.searchParams.get('code')?.toUpperCase() ?? null
  let code: CodeKey = isCodeKey(requested) ? requested : 'CGI'
  if (s) {
    const owner = await sectionCode(s)
    if (!owner) error(404, 'Section introuvable')
    code = owner
  }
  const map = await mapData(code, s)
  if (!map) error(404, 'Section introuvable')
  setHeaders({ 'cache-control': CACHE.data })
  return { map, codes: CODE_KEYS.map((key) => ({ key, title: CODES[key].title })) }
}
