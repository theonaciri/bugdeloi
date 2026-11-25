import { hasFictionalData } from '#lib/server/queries.ts'
import type { LayoutServerLoad } from './$types'

/** Seule donnée commune à toutes les pages : la base contient-elle des données fictives ? */
export const load: LayoutServerLoad = async () => {
  let fictional = false
  try {
    fictional = await hasFictionalData()
  } catch {
    // base injoignable : la page concernée l'affichera ; on ne casse pas la mise en page.
  }
  return { fictional }
}
