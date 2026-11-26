import { calculIR2026, type Foyer } from '../c0.6/ir2026.ts'

/**
 * Moteur combiné Revenu disponible réel (Impôt sur le revenu 2026 + Allocations familiales)
 * et simulateur d'amendement parlementaire (diff d'impact en euros).
 *
 * Sources légales :
 * - Impôt sur le revenu : CGI art. 193, 194, 197 (2026) et 1657 1 bis (seuil 61 €).
 * - Allocations familiales : CSS art. L521-1, D521-1, R521-1 (modulation par tranches
 *   de ressources et complément dégressif) avec barème de référence BMAF 2025/2026.
 */

export interface BaremeAF {
  /** Base mensuelle de calcul des allocations familiales (en euros). */
  bmafMensuelleEuros: number
  /** Premier plafond annuel hors enfants (CSS R521-1). */
  plafond1BaseEuros: number
  /** Second plafond annuel hors enfants (CSS R521-1). */
  plafond2BaseEuros: number
  /** Majoration de plafond par enfant à charge. */
  majorationPlafondParEnfantEuros: number
}

// Paramètres publics CSS (barème en vigueur 2025-2026, métropole).
export const BAREME_AF_METROPOLE: BaremeAF = {
  bmafMensuelleEuros: 466.44,
  plafond1BaseEuros: 69567,
  plafond2BaseEuros: 97367,
  majorationPlafondParEnfantEuros: 6957,
}

export interface ResultatRevenuDisponible {
  revenuNetImposableEuros: number
  impotMisEnRecouvrementEuros: number
  impotBrutAvant1657Euros: number
  allocationsFamilialesAnnuellesEuros: number
  trancheAF: 'taux_plein' | 'taux_reduit_50' | 'taux_reduit_25' | 'non_eligible'
  revenuDisponibleEuros: number
  nombreDeParts: number
}

/**
 * Calcule les allocations familiales annuelles en métropole (CSS L521-1 / D521-1)
 * pour un foyer avec `enfants` enfants à charge (dont `enfantsPlus14` de 14 ans ou plus).
 */
export function calculAllocationsFamilialesAnnuelles(
  revenuAnnuelEuros: number,
  enfants: number,
  enfantsPlus14 = 0,
  bareme: BaremeAF = BAREME_AF_METROPOLE,
): { annuelEuros: number; tranche: ResultatRevenuDisponible['trancheAF'] } {
  if (enfants < 2) {
    return { annuelEuros: 0, tranche: 'non_eligible' }
  }

  // CSS D521-1 : 32 % de la BMAF pour 2 enfants + 41 % par enfant supplémentaire.
  const tauxBase = 0.32 + (enfants - 2) * 0.41
  // CSS L521-3 / D521-1 : majoration de 16 % par enfant >= 14 ans (sauf l'aîné si exactement 2 enfants).
  const nbMajorations =
    enfants === 2 ? Math.max(0, Math.min(enfantsPlus14, 1) - 1) : Math.min(enfantsPlus14, enfants)
  const mensuelPlein = bareme.bmafMensuelleEuros * (tauxBase + nbMajorations * 0.16)
  const annuelPlein = mensuelPlein * 12

  const plafond1 = bareme.plafond1BaseEuros + enfants * bareme.majorationPlafondParEnfantEuros
  const plafond2 = bareme.plafond2BaseEuros + enfants * bareme.majorationPlafondParEnfantEuros

  let annuel: number
  let tranche: ResultatRevenuDisponible['trancheAF']

  if (revenuAnnuelEuros <= plafond1) {
    annuel = annuelPlein
    tranche = 'taux_plein'
  } else if (revenuAnnuelEuros <= plafond2) {
    // Complément dégressif CSS L521-1 al. 5 : lissage quand le dépassement est inférieur à la perte d'allocation.
    const demi = annuelPlein / 2
    const depassement = revenuAnnuelEuros - plafond1
    const degressif = depassement < demi ? demi - depassement : 0
    annuel = demi + degressif
    tranche = 'taux_reduit_50'
  } else {
    const quart = annuelPlein / 4
    const depassement = revenuAnnuelEuros - plafond2
    const degressif = depassement < quart ? quart - depassement : 0
    annuel = quart + degressif
    tranche = 'taux_reduit_25'
  }

  return {
    annuelEuros: Math.round(annuel * 100) / 100,
    tranche,
  }
}

export function calculRevenuDisponible(
  revenuNetImposableEuros: number,
  foyer: Foyer,
  enfantsPlus14 = 0,
): ResultatRevenuDisponible {
  const ir = calculIR2026({
    dateDeCalcul: '2026-07-01',
    revenuNetImposableCentimes: Math.max(0, Math.round(revenuNetImposableEuros)) * 100,
    ...foyer,
  })
  const af = calculAllocationsFamilialesAnnuelles(
    revenuNetImposableEuros,
    foyer.enfantsAChargeExclusiveOuPrincipale,
    enfantsPlus14,
  )
  const impotMisEnRecouvrementEuros = ir.impotMisEnRecouvrement / 100
  const revenuDisponibleEuros =
    Math.round((revenuNetImposableEuros - impotMisEnRecouvrementEuros + af.annuelEuros) * 100) / 100

  return {
    revenuNetImposableEuros,
    impotMisEnRecouvrementEuros,
    impotBrutAvant1657Euros: ir.impotNetAvantCredits / 100,
    allocationsFamilialesAnnuellesEuros: af.annuelEuros,
    trancheAF: af.tranche,
    revenuDisponibleEuros,
    nombreDeParts: ir.nombreDeParts,
  }
}

export interface PropositionAmendement {
  id: string
  titre: string
  description: string
  /** Ex. +2 pour indexer les seuils du barème de +2 % (simulation illustrative). */
  indexationBaremePct?: number
  /** Si vrai, supprime la falaise de 61 € (CGI art. 1657 1 bis) en appliquant un prélèvement dès 1 €. */
  supprimerSeuil61?: boolean
  /** Si vrai, supprime la décote (CGI art. 197 I.4.a). */
  supprimerDecote?: boolean
}

export const AMENDEMENTS_EXEMPLES: PropositionAmendement[] = [
  {
    id: 'indexation-2pct',
    titre: 'Indexer les seuils du barème de +2 %',
    description: 'Revalorise de 2 % toutes les tranches du barème 2026 (simulation type PLF).',
    indexationBaremePct: 2,
  },
  {
    id: 'supprimer-seuil-61',
    titre: 'Supprimer le seuil de recouvrement de 61 €',
    description: 'Supprime la falaise de l’article 1657 1 bis : l’impôt est prélevé dès 1 €.',
    supprimerSeuil61: true,
  },
  {
    id: 'supprimer-decote',
    titre: 'Supprimer la décote (art. 197 I.4.a)',
    description:
      'Supprime le pic marginal à 43,58 % et le taux de 15,98 %, au prix d’une hausse d’impôt pour les foyers modestes.',
    supprimerDecote: true,
  },
]

export function simulerAmendementIR(
  revenuNetImposableEuros: number,
  foyer: Foyer,
  amendement: PropositionAmendement,
): { loiEnVigueurEuros: number; apresAmendementEuros: number; ecartEuros: number } {
  const base = calculIR2026({
    dateDeCalcul: '2026-07-01',
    revenuNetImposableCentimes: Math.max(0, Math.round(revenuNetImposableEuros)) * 100,
    ...foyer,
  })
  const loiEnVigueurEuros = base.impotMisEnRecouvrement / 100

  const apres = base
  if (amendement.indexationBaremePct && amendement.indexationBaremePct !== 0) {
    // Équivalent mathématique d'une indexation uniforme des seuils de +p% :
    // diviser le revenu par (1 + p/100) puis multiplier l'impôt brut par (1 + p/100).
    const factor = 1 + amendement.indexationBaremePct / 100
    const scaled = calculIR2026({
      dateDeCalcul: '2026-07-01',
      revenuNetImposableCentimes: Math.round((revenuNetImposableEuros / factor) * 100),
      ...foyer,
    })
    const impotAjuste = Math.round((scaled.impotMisEnRecouvrement / 100) * factor)
    return {
      loiEnVigueurEuros,
      apresAmendementEuros: impotAjuste,
      ecartEuros: Math.round((impotAjuste - loiEnVigueurEuros) * 100) / 100,
    }
  }

  if (amendement.supprimerDecote) {
    const sansDecote = Math.round((base.impotApresPlafondQf - base.refactionOutreMer) / 100)
    const misEnRecouvrement = sansDecote < 61 ? 0 : sansDecote
    return {
      loiEnVigueurEuros,
      apresAmendementEuros: misEnRecouvrement,
      ecartEuros: Math.round((misEnRecouvrement - loiEnVigueurEuros) * 100) / 100,
    }
  }

  if (amendement.supprimerSeuil61) {
    const apresAmendementEuros = apres.impotArrondiEuro / 100
    return {
      loiEnVigueurEuros,
      apresAmendementEuros,
      ecartEuros: Math.round((apresAmendementEuros - loiEnVigueurEuros) * 100) / 100,
    }
  }

  return { loiEnVigueurEuros, apresAmendementEuros: loiEnVigueurEuros, ecartEuros: 0 }
}
