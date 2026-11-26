/**
 * Écart en euros entre la loi en vigueur (millésime 2026) et un amendement aux art. 197 et 1657 du CGI,
 * sur quatre foyers types.
 *
 * La loi en vigueur vient de `calculIR2026` (replications/c0.6). Le calcul après amendement réutilise
 * `calculExact` ; seuls le barème et la décote, que ce moteur ne paramètre pas, sont recalculés ici.
 * Un test de parité compare les deux calculs aux paramètres en vigueur.
 */
import {
  aLEuroEnCentimes,
  calculExact,
  calculIR2026,
  type Foyer,
  nombreDeDemiParts,
  unitesParCentime,
  unitesParEuro,
} from '../../../replications/c0.6/ir2026.ts'
import type { AmendementSuivi, Parametre } from './tricoteuses.ts'

const celibataire: Foyer = {
  situationFamiliale: 'Célibataire',
  enfantsAChargeExclusiveOuPrincipale: 0,
  appreciationVitSeul: false,
  domicileFiscal: 'Métropole',
}
const couple: Foyer = { ...celibataire, situationFamiliale: 'ImpositionCommune' }

export const foyersTypes = [
  {
    id: 'celibataire-25000',
    libelle: 'Célibataire, 25 000 €',
    revenuNetImposableEuros: 25_000,
    foyer: celibataire,
  },
  {
    id: 'celibataire-falaise-17592',
    libelle: 'Célibataire près du seuil de 61 €, 17 592 €',
    revenuNetImposableEuros: 17_592,
    foyer: celibataire,
  },
  { id: 'couple-55000', libelle: 'Couple, 55 000 €', revenuNetImposableEuros: 55_000, foyer: couple },
  {
    id: 'couple-2-enfants-90000',
    libelle: 'Couple avec 2 enfants, 90 000 €',
    revenuNetImposableEuros: 90_000,
    foyer: { ...couple, enfantsAChargeExclusiveOuPrincipale: 2 },
  },
] as const

/** Une indexation « de x % » ne dit pas comment arrondir les nouveaux seuils : le choix est explicite. */
export type ArrondiSeuils = 'euro_le_plus_proche' | 'euro_inferieur'

export interface EcartFoyer {
  id: string
  libelle: string
  revenuNetImposableEuros: number
  loiEnVigueurEuros: number
  apresAmendementEuros: number
  /** Positif : le foyer paie davantage. */
  ecartEuros: number
}

export type Impact =
  | { statut: 'calcule'; amendementUid: string; hypotheses: string[]; foyers: EcartFoyer[] }
  | { statut: 'non_calculable'; amendementUid: string; motif: string }

// CGI 197 I.1, LEGIARTI000053542636@2026-02-21.
const tranches = [
  { seuil: 11_600n, taux: 11n },
  { seuil: 29_579n, taux: 30n },
  { seuil: 84_577n, taux: 41n },
  { seuil: 181_917n, taux: 45n },
]
// Revenu assez élevé pour que le plafond du quotient familial s'applique à chaque foyer à enfants.
const revenuPlafonnant = 10_000_000n

/** Nombre à deux décimales au plus, en centièmes entiers. */
const centiemes = (n: number) => BigInt(Math.round(n * 100))
const min = (a: bigint, b: bigint) => (a < b ? a : b)
const max = (a: bigint, b: bigint) => (a > b ? a : b)

/** Impôt arrondi à l'euro (en euros) et montant mis en recouvrement après application des paramètres. */
export function impotApresAmendement(
  revenuEuros: number,
  foyer: Foyer,
  parametres: readonly Parametre[],
  arrondiSeuils: ArrondiSeuils = 'euro_le_plus_proche',
): number {
  if (foyer.domicileFiscal !== 'Métropole') {
    throw new RangeError('La veille ne simule que des foyers domiciliés en métropole.')
  }
  // CGI 197 I.4.a, LEGIARTI000053542636@2026-02-21 : 897 €, 1 483 € et 45,25 %.
  let decoteCelibataire = 897n
  let decoteCouple = 1_483n
  let tauxDecote = 4_525n
  let decoteSupprimee = false
  let seuil61Supprime = false
  let indexationCentiemes = 0n
  for (const p of parametres) {
    if (p.type === 'indexation_bareme') indexationCentiemes = centiemes(p.pourcentage)
    else if (p.type === 'suppression_seuil_61') seuil61Supprime = true
    else if (p.type === 'suppression_decote') decoteSupprimee = true
    else if (p.type === 'decote_montant_celibataire') decoteCelibataire = BigInt(p.euros)
    else if (p.type === 'decote_montant_couple') decoteCouple = BigInt(p.euros)
    else tauxDecote = centiemes(p.pourcentage)
  }

  const revenu = BigInt(revenuEuros)
  const { demiParts, demiPartsDeReference, commune } = nombreDeDemiParts(foyer)
  const reference: Foyer = { ...foyer, enfantsAChargeExclusiveOuPrincipale: 0, appreciationVitSeul: false }
  // Plafond de l'avantage (CGI 197 I.2), déduit du moteur : inchangé par les amendements reconnus.
  const avantageMaximal =
    calculExact(revenuPlafonnant, reference).brut - calculExact(revenuPlafonnant, foyer).apresPlafond

  const seuils = tranches.map(({ seuil, taux }) => {
    const produit = seuil * (10_000n + indexationCentiemes)
    const demi = arrondiSeuils === 'euro_le_plus_proche' ? 5_000n : 0n
    return { seuil: (produit + demi) / 10_000n, taux }
  })
  const cotisation = (dp: bigint) => {
    let demiCentimes = 0n
    for (const [index, { seuil, taux }] of seuils.entries()) {
      const bas = seuil * dp
      if (revenu * 2n <= bas) break
      const suivante = seuils[index + 1]
      const haut = suivante ? min(revenu * 2n, suivante.seuil * dp) : revenu * 2n
      demiCentimes += (haut - bas) * taux
    }
    return demiCentimes * (unitesParCentime / 2n)
  }
  const brut = cotisation(demiParts)
  const limite = cotisation(demiPartsDeReference) - avantageMaximal
  const apresPlafond = max(brut, limite)

  const theorique =
    (commune ? decoteCouple : decoteCelibataire) * unitesParEuro - (apresPlafond * tauxDecote) / 10_000n
  const decote = decoteSupprimee ? 0n : min(apresPlafond, max(0n, theorique))
  // CGI 1657 1 et 1 bis : arrondi à l'euro, puis non-recouvrement sous 61 €.
  const impot = aLEuroEnCentimes(apresPlafond - decote) / 100
  return !seuil61Supprime && impot < 61 ? 0 : impot
}

export function calculImpact(
  suivi: AmendementSuivi,
  options: { arrondiSeuils?: ArrondiSeuils } = {},
): Impact {
  const { amendement, correspondances, extraction } = suivi
  const amendementUid = amendement.uid
  const nonCalculable = (motif: string): Impact => ({ statut: 'non_calculable', amendementUid, motif })

  if (!correspondances.some((c) => c.code === 'CGI' && (c.article === '197' || c.article === '1657'))) {
    return nonCalculable('Seuls les amendements aux articles 197 et 1657 du CGI sont chiffrés.')
  }
  if (!extraction.complete) {
    return nonCalculable(
      'Le dispositif n’est pas entièrement reconnu : aucun chiffre partiel n’est publié. Lecture humaine requise.',
    )
  }

  const arrondiSeuils = options.arrondiSeuils ?? 'euro_le_plus_proche'
  const hypotheses = [
    'Comparaison avec la loi du millésime 2026, à revenu net imposable et composition du foyer constants.',
    'Foyers de métropole ; impôt avant réductions et crédits d’impôt.',
    'Seuls les paramètres écrits dans le dispositif changent ; effet budgétaire non estimé.',
  ]
  if (extraction.parametres.some((p) => p.type === 'indexation_bareme')) {
    hypotheses.push(
      arrondiSeuils === 'euro_le_plus_proche'
        ? 'Nouveaux seuils du barème arrondis à l’euro le plus proche (choix de la veille, non fixé par le dispositif).'
        : 'Nouveaux seuils du barème arrondis à l’euro inférieur (choix de la veille, non fixé par le dispositif).',
    )
  }

  const foyers = foyersTypes.map(({ id, libelle, revenuNetImposableEuros, foyer }) => {
    const loiEnVigueurEuros =
      calculIR2026({
        ...foyer,
        dateDeCalcul: '2026-07-01',
        revenuNetImposableCentimes: revenuNetImposableEuros * 100,
      }).impotMisEnRecouvrement / 100
    const apresAmendementEuros = impotApresAmendement(
      revenuNetImposableEuros,
      foyer,
      extraction.parametres,
      arrondiSeuils,
    )
    return {
      id,
      libelle,
      revenuNetImposableEuros,
      loiEnVigueurEuros,
      apresAmendementEuros,
      ecartEuros: apresAmendementEuros - loiEnVigueurEuros,
    }
  })
  return { statut: 'calcule', amendementUid, hypotheses, foyers }
}
