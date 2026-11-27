import { CACHE } from '#lib/server/http.ts'
import { corpusRounding, ROUNDING_KINDS, type RoundingKind } from '#lib/server/rounding.ts'
import c08Summary from '../../../../../../replications/c0.8-openfisca/summary.json'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = ({ setHeaders }) => {
  setHeaders({ 'cache-control': CACHE.data })
  const files = corpusRounding()
  const byKind = Object.fromEntries(ROUNDING_KINDS.map((kind) => [kind, 0])) as Record<RoundingKind, number>
  for (const file of files) for (const point of file.points) byKind[point.kind] += 1
  // Candidats ARRONDI issus de la comparaison avec OpenFisca (replications/c0.8-openfisca) : non qualifiés.
  const candidates = c08Summary.groupes
    .filter((group) => /ARRONDI/.test(group.motif))
    .map((group) => ({
      domaine: group.domaine,
      motif: group.motif,
      nombre: group.nombre,
      ecartMaximal: group.ecartMaximal,
      exemples: group.exemples.slice(0, 3).map((example) => ({
        revenu: example.entree.revenuEuros,
        situation: example.entree.situationFamiliale,
        bugdeloi: example.bugdeloi,
        openfisca: example.openfisca,
      })),
    }))
  return {
    files,
    byKind,
    candidates,
    openfiscaVersion: c08Summary.versions.openfisca_france,
  }
}
