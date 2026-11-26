import {
  aLEuroEnCentimes,
  domiciles,
  type Foyer,
  situations,
  unitesParCentime,
  unitesParEuro,
} from '../c0.6/ir2026.ts'

/**
 * Impôt sur le revenu 2026 avec des quarts de part : résidence alternée (CGI art. 194 I),
 * demi-parts invalidité et ancien combattant (CGI art. 195), plafonnement (CGI art. 197 I.2).
 *
 * Sans résidence alternée ni demi-part de l'article 195, le résultat est celui de c0.6
 * (les tests comparent les deux calculs).
 */

export interface FoyerEtendu extends Foyer {
  /** Enfants mineurs à charge égale des deux parents (en plus des enfants à charge principale). */
  enfantsEnResidenceAlternee?: number
  /** Adultes du foyer remplissant une condition d'invalidité (art. 195 1 c, d ou d bis). */
  adultesInvalides?: number
  /** Un adulte de plus de 74 ans titulaire de la carte du combattant ou d'une pension visée (1 f et 6). */
  ancienCombattantPlus74?: boolean
}

export interface ResultatImpot {
  nombreDeParts: number
  impotAvantRecouvrementEuros: number
  impotMisEnRecouvrementEuros: number
}

// CGI 197 I.1, LEGIARTI000053542636.
const bareme = [
  { seuil: 11600n, taux: 11n },
  { seuil: 29579n, taux: 30n },
  { seuil: 84577n, taux: 41n },
  { seuil: 181917n, taux: 45n },
] as const

const euros = (n: bigint) => n * unitesParEuro
const min = (a: bigint, b: bigint) => (a < b ? a : b)
const max = (a: bigint, b: bigint) => (a > b ? a : b)
const entierPositif = (n: number) => Number.isSafeInteger(n) && n >= 0

export function nombreDeQuartsDeParts(foyer: FoyerEtendu) {
  const exclusifs = foyer.enfantsAChargeExclusiveOuPrincipale
  const alternes = foyer.enfantsEnResidenceAlternee ?? 0
  const invalides = foyer.adultesInvalides ?? 0
  const ancienCombattant = foyer.ancienCombattantPlus74 ?? false
  const commune = foyer.situationFamiliale === 'ImpositionCommune'
  if (!entierPositif(exclusifs) || !entierPositif(alternes) || !entierPositif(invalides)) {
    throw new RangeError('Nombre d’enfants ou d’adultes invalides incorrect.')
  }
  if (invalides > (commune ? 2 : 1)) {
    throw new RangeError('Plus d’adultes invalides que d’adultes dans le foyer.')
  }
  if (foyer.situationFamiliale === 'Veuf' && alternes > 0) {
    throw new RangeError('Veuvage avec résidence alternée : cas non modélisé.')
  }

  // CGI 194 I (tableau) : une demi-part pour les deux premiers enfants, une part ensuite.
  const base = commune ? 8 : 4
  let quarts = base + Math.min(exclusifs, 2) * 2 + Math.max(0, exclusifs - 2) * 4
  // CGI 194 I a, b, c : selon le rang, 0,25 part (rangs 1 et 2) puis 0,5 part.
  for (let rang = exclusifs + 1; rang <= exclusifs + alternes; rang++) quarts += rang <= 2 ? 1 : 2
  const veufAvecEnfants = foyer.situationFamiliale === 'Veuf' && exclusifs > 0
  if (veufAvecEnfants) quarts += 4

  // CGI 194 II : parent vivant seul.
  const parentIsole =
    (foyer.situationFamiliale === 'Célibataire' || foyer.situationFamiliale === 'Divorcé') &&
    foyer.appreciationVitSeul &&
    exclusifs + alternes > 0
  if (parentIsole) quarts += exclusifs > 0 || alternes >= 2 ? 2 : 1

  // CGI 195 : 1 c à d bis et 5 (personne seule), 3 et 4 (couple), 1 f et 6 (ancien combattant).
  // Le 6 ne se cumule pas avec les 3 et 4 ; le 1 f suppose l'absence d'enfant à charge.
  let quarts195 = invalides * 2
  if (ancienCombattant && invalides === 0 && (commune || exclusifs + alternes === 0)) quarts195 = 2
  quarts += quarts195

  return { quarts, base, quarts195, commune, parentIsole, veufAvecEnfants, exclusifs, alternes }
}

/** CGI 193 et 197 I.1, en unités entières exactes (voir c0.6). */
function cotisation(revenuEuros: bigint, quarts: bigint): bigint {
  const revenuQuadruple = revenuEuros * 4n
  let somme = 0n
  for (const [index, tranche] of bareme.entries()) {
    const basse = tranche.seuil * quarts
    if (revenuQuadruple <= basse) break
    const suivante = bareme[index + 1]
    const haute = suivante ? min(revenuQuadruple, suivante.seuil * quarts) : revenuQuadruple
    somme += (haute - basse) * tranche.taux
  }
  return somme * (unitesParCentime / 4n)
}

export function calculImpot2026(revenuNetImposableEuros: number, foyer: FoyerEtendu): ResultatImpot {
  if (
    !situations.includes(foyer.situationFamiliale) ||
    !domiciles.includes(foyer.domicileFiscal) ||
    !Number.isFinite(revenuNetImposableEuros)
  ) {
    throw new RangeError('Foyer ou revenu hors du périmètre.')
  }
  const parts = nombreDeQuartsDeParts(foyer)
  // CGI 193 : revenu arrondi à l'euro le plus proche.
  const revenu = BigInt(Math.max(0, Math.round(revenuNetImposableEuros)))
  const brut = cotisation(revenu, BigInt(parts.quarts))
  const reference = cotisation(revenu, BigInt(parts.base))

  // CGI 197 I.2 : 1 807 € par demi-part, la moitié par quart de part.
  const supplementaires = BigInt(parts.quarts - parts.base)
  const parQuart = (n: bigint) => (n * euros(1807n)) / 2n
  let avantage = parQuart(supplementaires)
  if (parts.parentIsole && parts.exclusifs > 0) {
    // La part du premier enfant (quatre quarts) est limitée à 4 262 €.
    avantage = euros(4262n) + parQuart(supplementaires - 4n)
  } else if (parts.parentIsole) {
    // Enfants uniquement en alternance : 2 131 € par demi-part des deux premiers enfants.
    const enfantsLimites = BigInt(Math.min(parts.alternes, 2))
    avantage = enfantsLimites * (euros(4262n) / 2n) + parQuart(supplementaires - 2n * enfantsLimites)
  }
  // Réductions complémentaires : demi-parts de l'article 195 et part supplémentaire des veufs.
  const complement = euros(1801n) * BigInt(parts.quarts195 / 2) + (parts.veufAvecEnfants ? euros(2011n) : 0n)
  const apresPlafond = max(brut, reference - avantage - complement)

  // CGI 197 I.3.
  const refaction =
    foyer.domicileFiscal === 'GuyaneMayotte'
      ? min(euros(4050n), (apresPlafond * 40n) / 100n)
      : foyer.domicileFiscal === 'GuadeloupeMartiniqueRéunion'
        ? min(euros(2450n), (apresPlafond * 30n) / 100n)
        : 0n
  // CGI 197 I.4.a.
  const apresRefaction = apresPlafond - refaction
  const decoteTheorique = euros(parts.commune ? 1483n : 897n) - (apresRefaction * 4525n) / 10000n
  const decote = min(apresRefaction, max(0n, decoteTheorique))
  const arrondi = aLEuroEnCentimes(apresRefaction - decote)

  return {
    nombreDeParts: parts.quarts / 4,
    impotAvantRecouvrementEuros: arrondi / 100,
    // CGI 1657 1 bis : non mis en recouvrement si inférieur à 61 €.
    impotMisEnRecouvrementEuros: arrondi < 6100 ? 0 : arrondi / 100,
  }
}
