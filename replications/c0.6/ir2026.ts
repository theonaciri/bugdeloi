export const situations = ['Célibataire', 'Divorcé', 'Veuf', 'ImpositionCommune'] as const
export const domiciles = ['Métropole', 'GuadeloupeMartiniqueRéunion', 'GuyaneMayotte'] as const

export interface Foyer {
  situationFamiliale: (typeof situations)[number]
  enfantsAChargeExclusiveOuPrincipale: number
  appreciationVitSeul: boolean
  domicileFiscal: (typeof domiciles)[number]
}

export interface EntreeIR2026 extends Foyer {
  dateDeCalcul: string
  revenuNetImposableCentimes: number
}

// Toutes les sorties monétaires sont en centimes entiers.
export interface ResultatIR2026 {
  nombreDeParts: number
  impotBrutSansPlafond: number
  impotApresPlafondQf: number
  refactionOutreMer: number
  decote: number
  impotNetAvantCredits: number
  impotArrondiEuro: number
  impotMisEnRecouvrement: number
}

// CGI 197 I.1, LEGIARTI000053542636@2026-02-21.
const bareme = [
  { seuil: 11600n, taux: 11n },
  { seuil: 29579n, taux: 30n },
  { seuil: 84577n, taux: 41n },
  { seuil: 181917n, taux: 45n },
] as const

// Avec des revenus en euros et des demi-parts, le barème produit des multiples
// d'un demi-centime. La réfaction divise par 100 et la décote par 10 000.
export const unitesParCentime = 2n * 100n * 10000n
export const unitesParEuro = 100n * unitesParCentime
const euros = (n: bigint) => n * unitesParEuro
const min = (a: bigint, b: bigint) => (a < b ? a : b)
const max = (a: bigint, b: bigint) => (a > b ? a : b)

export function auCentime(montant: bigint): number {
  return Number((montant + unitesParCentime / 2n) / unitesParCentime)
}

/** CGI 1657.1 : arrondi à l'euro le plus proche (0,50 -> 1), renvoyé en centimes entiers. */
export function aLEuroEnCentimes(montant: bigint): number {
  const eurosArrondis = (montant + unitesParEuro / 2n) / unitesParEuro
  return Number(eurosArrondis * 100n)
}

export function nombreDeDemiParts(foyer: Foyer) {
  const { situationFamiliale, enfantsAChargeExclusiveOuPrincipale, appreciationVitSeul } = foyer
  const enfants = BigInt(enfantsAChargeExclusiveOuPrincipale)
  const commune = situationFamiliale === 'ImpositionCommune'
  // CGI 194 I (tableau), II (parent isolé), LEGIARTI000033817781@2018-01-01.
  const demiPartsDeReference = commune ? 4n : 2n
  const parentIsole =
    (situationFamiliale === 'Célibataire' || situationFamiliale === 'Divorcé') &&
    appreciationVitSeul &&
    enfants > 0n
  const demiPartsEnfants = min(enfants, 2n) + 2n * max(0n, enfants - 2n)
  const veufAvecEnfants = situationFamiliale === 'Veuf' && enfants > 0n
  const demiParts =
    demiPartsDeReference + demiPartsEnfants + (veufAvecEnfants ? 2n : 0n) + (parentIsole ? 1n : 0n)
  return { demiParts, demiPartsDeReference, commune, parentIsole, veufAvecEnfants }
}

function cotisation(revenuEuros: bigint, demiParts: bigint) {
  // CGI 193 et 197 I.1. Appliquer les seuils au foyer évite la division par
  // le nombre de parts, qui s'annule à la multiplication de la cotisation.
  const revenuDouble = revenuEuros * 2n
  let demiCentimes = 0n
  let taux = 0
  for (const [index, tranche] of bareme.entries()) {
    const limiteBasse = tranche.seuil * demiParts
    if (revenuDouble <= limiteBasse) break
    const suivante = bareme[index + 1]
    const limiteHaute = suivante ? min(revenuDouble, suivante.seuil * demiParts) : revenuDouble
    demiCentimes += (limiteHaute - limiteBasse) * tranche.taux
    taux = Number(tranche.taux)
  }
  return { montant: demiCentimes * (unitesParCentime / 2n), taux }
}

export function calculExact(revenuEuros: bigint, foyer: Foyer) {
  const { demiParts, demiPartsDeReference, commune, parentIsole, veufAvecEnfants } = nombreDeDemiParts(foyer)
  const brut = cotisation(revenuEuros, demiParts)
  const reference = cotisation(revenuEuros, demiPartsDeReference)

  // CGI 197 I.2, alinéas 1 et dernier.
  const demiPartsSupplementaires = demiParts - demiPartsDeReference
  const avantage = parentIsole
    ? 4262n + (demiPartsSupplementaires - 2n) * 1807n
    : demiPartsSupplementaires * 1807n
  const limite = reference.montant - euros(avantage + (veufAvecEnfants ? 2011n : 0n))
  const apresPlafond = max(brut.montant, limite)
  const qfPlafonne = limite > brut.montant

  // CGI 197 I.3.
  const refaction =
    foyer.domicileFiscal === 'GuyaneMayotte'
      ? min(euros(4050n), (apresPlafond * 40n) / 100n)
      : foyer.domicileFiscal === 'GuadeloupeMartiniqueRéunion'
        ? min(euros(2450n), (apresPlafond * 30n) / 100n)
        : 0n

  // CGI 197 I.4.a.
  const apresRefaction = apresPlafond - refaction
  const decoteTheorique = euros(commune ? 1483n : 897n) - (apresRefaction * 4525n) / 10000n
  const decote = min(apresRefaction, max(0n, decoteTheorique))
  const regimeDecote =
    decoteTheorique <= 0n ? 'nulle' : decoteTheorique >= apresRefaction ? 'totale' : 'partielle'
  return {
    demiParts,
    brut: brut.montant,
    apresPlafond,
    refaction,
    decote,
    net: apresRefaction - decote,
    qfPlafonne,
    regimeDecote,
    tauxBaremeFoyer: brut.taux,
    tauxBaremeReference: reference.taux,
  }
}

export function calculIR2026(entree: EntreeIR2026): ResultatIR2026 {
  const { enfantsAChargeExclusiveOuPrincipale: enfants, revenuNetImposableCentimes: revenu } = entree
  const { dateDeCalcul } = entree
  // Bornes communes aux trois versions LEGI épinglées.
  const date = new Date(`${dateDeCalcul}T00:00:00Z`)
  if (
    !(dateDeCalcul >= '2026-07-01' && dateDeCalcul < '2999-01-01') ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== dateDeCalcul
  ) {
    throw new RangeError('Date hors du millésime LEGI modélisé.')
  }
  if (
    !Number.isSafeInteger(enfants) ||
    enfants < 0 ||
    !Number.isSafeInteger(revenu) ||
    revenu < 0 ||
    !situations.includes(entree.situationFamiliale) ||
    !domiciles.includes(entree.domicileFiscal) ||
    typeof entree.appreciationVitSeul !== 'boolean'
  ) {
    throw new RangeError('Foyer ou revenu hors du périmètre de CalculImpotRevenu@v1.')
  }
  // CGI 193, dernière phrase, LEGIARTI000054373592@2026-07-01.
  const revenuEuros = (BigInt(revenu) + 50n) / 100n
  const exact = calculExact(revenuEuros, entree)
  const impotArrondiEuro = aLEuroEnCentimes(exact.net)
  // CGI 1657 1 bis, LEGIARTI000051219510@2025-02-16 : non mis en recouvrement si < 61 €.
  const impotMisEnRecouvrement = impotArrondiEuro < 6100 ? 0 : impotArrondiEuro
  return {
    nombreDeParts: Number(exact.demiParts) / 2,
    impotBrutSansPlafond: auCentime(exact.brut),
    impotApresPlafondQf: auCentime(exact.apresPlafond),
    refactionOutreMer: auCentime(exact.refaction),
    decote: auCentime(exact.decote),
    impotNetAvantCredits: auCentime(exact.net),
    impotArrondiEuro,
    impotMisEnRecouvrement,
  }
}
