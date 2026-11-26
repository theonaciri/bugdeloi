import c08Summary from '../../../../../../replications/c0.8-openfisca/summary.json'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = () => ({
  c08: c08Summary,
  arrondiGroup: c08Summary.groupes.find((g) => g.categorie === 'divergence_simulateur') ?? null,
  perimetreGroups: c08Summary.groupes.filter((g) => g.categorie === 'difference_de_perimetre'),
})
