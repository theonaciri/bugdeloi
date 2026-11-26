import { describe, expect, test } from 'bun:test'
import { calculIR2026, domiciles, situations } from '../c0.6/ir2026.ts'
import { detecterEffetsDeSeuil } from './detect-multi-cliffs.ts'
import { calculImpot2026, type FoyerEtendu, nombreDeQuartsDeParts } from './impot-parts.ts'
import {
  bonificationMensuelle,
  calculAllocationsFamilialesAnnuelles,
  calculAPLMensuelle,
  calculPrimeActiviteMensuelle,
  calculRsaMensuel,
  type EntreeAPL,
  montantForfaitaire,
} from './prestations.ts'
import { AMENDEMENTS_EXEMPLES, calculRevenuDisponible, simulerAmendementIR } from './revenu-disponible.ts'
import summary from './summary.json'

const couple: FoyerEtendu = {
  situationFamiliale: 'ImpositionCommune',
  enfantsAChargeExclusiveOuPrincipale: 0,
  appreciationVitSeul: false,
  domicileFiscal: 'Métropole',
}
const seul: FoyerEtendu = { ...couple, situationFamiliale: 'Célibataire' }
const parentIsole: FoyerEtendu = { ...seul, appreciationVitSeul: true }
const coupleDeuxEnfants: FoyerEtendu = { ...couple, enfantsAChargeExclusiveOuPrincipale: 2 }

const impot = (revenu: number, foyer: FoyerEtendu) =>
  calculImpot2026(revenu, foyer).impotMisEnRecouvrementEuros
const parts = (foyer: FoyerEtendu) => nombreDeQuartsDeParts(foyer).quarts / 4

describe('Quotient familial (CGI art. 194, 195 et 197)', () => {
  test('retrouve le calcul c0.6 sans résidence alternée ni demi-part de l’article 195', () => {
    let differences = 0
    for (const situationFamiliale of situations) {
      for (const domicileFiscal of domiciles) {
        for (const enfants of [0, 1, 2, 3, 5]) {
          for (const appreciationVitSeul of [false, true]) {
            const foyer = {
              situationFamiliale,
              domicileFiscal,
              appreciationVitSeul,
              enfantsAChargeExclusiveOuPrincipale: enfants,
            }
            for (let revenu = 0; revenu <= 250_000; revenu += 997) {
              const reference = calculIR2026({
                dateDeCalcul: '2026-07-01',
                revenuNetImposableCentimes: revenu * 100,
                ...foyer,
              })
              if (impot(revenu, foyer) !== reference.impotMisEnRecouvrement / 100) differences++
            }
          }
        }
      }
    }
    expect(differences).toBe(0)
  })

  test('compte les parts en résidence alternée (art. 194 I a, b, c et II)', () => {
    const alterne = (exclusifs: number, alternes: number, base = couple) =>
      parts({
        ...base,
        enfantsAChargeExclusiveOuPrincipale: exclusifs,
        enfantsEnResidenceAlternee: alternes,
      })
    expect(alterne(0, 1)).toBe(2.25)
    expect(alterne(0, 2)).toBe(2.5)
    expect(alterne(0, 3)).toBe(3)
    expect(alterne(1, 1)).toBe(2.75)
    expect(alterne(1, 2)).toBe(3.25)
    expect(alterne(2, 1)).toBe(3.5)
    expect(alterne(0, 1, parentIsole)).toBe(1.5)
    expect(alterne(0, 2, parentIsole)).toBe(2)
    expect(alterne(1, 1, parentIsole)).toBe(2.25)
  })

  test('ajoute les demi-parts de l’article 195 sans cumul interdit', () => {
    expect(parts({ ...seul, adultesInvalides: 1 })).toBe(1.5)
    expect(parts({ ...seul, adultesInvalides: 1, ancienCombattantPlus74: true })).toBe(1.5)
    expect(parts({ ...seul, ancienCombattantPlus74: true })).toBe(1.5)
    expect(parts({ ...seul, enfantsAChargeExclusiveOuPrincipale: 1, ancienCombattantPlus74: true })).toBe(1.5)
    expect(parts({ ...couple, adultesInvalides: 1 })).toBe(2.5)
    expect(parts({ ...couple, adultesInvalides: 2 })).toBe(3)
    expect(parts({ ...couple, ancienCombattantPlus74: true })).toBe(2.5)
    expect(parts({ ...couple, adultesInvalides: 1, ancienCombattantPlus74: true })).toBe(2.5)
    expect(() => parts({ ...seul, adultesInvalides: 2 })).toThrow(RangeError)
  })

  test('plafonne l’avantage à haut revenu (art. 197 I.2)', () => {
    const gain = (sans: FoyerEtendu, avec: FoyerEtendu) => impot(200_000, sans) - impot(200_000, avec)
    expect(gain(couple, { ...couple, enfantsEnResidenceAlternee: 2 })).toBe(1807)
    expect(gain(seul, { ...parentIsole, enfantsEnResidenceAlternee: 1 })).toBe(2131)
    expect(gain(seul, { ...parentIsole, enfantsEnResidenceAlternee: 2 })).toBe(4262)
    expect(gain(seul, { ...seul, adultesInvalides: 1 })).toBe(1807 + 1801)
    expect(gain(couple, { ...couple, adultesInvalides: 2 })).toBe(2 * (1807 + 1801))
  })
})

describe('Allocations familiales', () => {
  test('module les allocations et lisse le passage des plafonds', () => {
    const plein = calculAllocationsFamilialesAnnuelles(50_000, 2)
    expect(plein.tranche).toBe('taux_plein')
    expect(plein.annuelEuros).toBeCloseTo(478.16 * 0.32 * 12, 2)

    const reduit = calculAllocationsFamilialesAnnuelles(90_000, 2)
    expect(reduit.tranche).toBe('taux_reduit_50')
    expect(reduit.annuelEuros).toBeCloseTo(plein.annuelEuros / 2, 1)

    const quart = calculAllocationsFamilialesAnnuelles(120_000, 2)
    expect(quart.tranche).toBe('taux_reduit_25')
    expect(quart.annuelEuros).toBeCloseTo(plein.annuelEuros / 4, 1)

    expect(calculAllocationsFamilialesAnnuelles(79_981, 2).annuelEuros).toBeCloseTo(plein.annuelEuros - 1, 1)
  })

  test('exclut l’aîné de la majoration pour deux enfants', () => {
    const majoration = (enfants: number, eligibles: number) =>
      calculAllocationsFamilialesAnnuelles(50_000, enfants, { enfantsOuvrantMajoration: eligibles })
        .majorationAgeAnnuelleEuros
    const une = 478.16 * 0.16 * 12
    expect(majoration(2, 1)).toBe(0)
    expect(majoration(2, 2)).toBeCloseTo(une, 2)
    expect(majoration(3, 3)).toBeCloseTo(3 * une, 2)
  })

  test('partage les allocations en résidence alternée (art. R521-3)', () => {
    const entier = calculAllocationsFamilialesAnnuelles(50_000, 2).annuelEuros
    const partage = calculAllocationsFamilialesAnnuelles(50_000, 2, { enfantsAlternes: 1 }).annuelEuros
    expect(partage).toBeCloseTo(entier * 0.75, 1)
  })
})

describe('Aide au logement', () => {
  const base: EntreeAPL = {
    couple: true,
    enfantsExclusifs: 2,
    enfantsAlternes: 0,
    zone: 2,
    loyerMensuelEuros: 750,
    ressourcesAnnuellesEuros: 0,
  }

  test('suit la formule L + C - Pp, calculée à la main', () => {
    // L = 458,10 ; C = 88,07 ; Pp = 8,5 % × 546,17 ; (546,17 - 46,42 - 5) × 99,5 % = 492,28.
    expect(calculAPLMensuelle(base)).toBe(492)
    // R - R0 = 10 852 ; Tp = 2,38 % + 0,305 % ; Pp = 337,80 ; (208,37 - 5) × 99,5 % = 202,35.
    expect(calculAPLMensuelle({ ...base, ressourcesAnnuellesEuros: 20_000 })).toBe(202)
  })

  test('arrondit les ressources à la centaine supérieure', () => {
    const aide = (r: number) => calculAPLMensuelle({ ...base, ressourcesAnnuellesEuros: r })
    expect(aide(20_001)).toBe(aide(20_100))
    expect(aide(20_001)).toBeLessThan(aide(20_000))
  })

  test('applique la zone et supprime l’aide pour un loyer très élevé', () => {
    expect(calculAPLMensuelle({ ...base, zone: 1 })).toBeGreaterThan(calculAPLMensuelle(base))
    expect(calculAPLMensuelle({ ...base, zone: 3 })).toBeLessThan(calculAPLMensuelle(base))
    expect(calculAPLMensuelle({ ...base, loyerMensuelEuros: 1300 })).toBeLessThan(calculAPLMensuelle(base))
    expect(calculAPLMensuelle({ ...base, loyerMensuelEuros: 1500 })).toBe(0)
    expect(calculAPLMensuelle({ ...base, loyerMensuelEuros: 0 })).toBe(0)
  })

  test('sert la moitié de la part liée aux enfants en alternance', () => {
    const sans = calculAPLMensuelle({ ...base, enfantsExclusifs: 0 })
    const alterne = calculAPLMensuelle({ ...base, enfantsExclusifs: 0, enfantsAlternes: 2 })
    expect(Math.abs(alterne - (sans + calculAPLMensuelle(base)) / 2)).toBeLessThanOrEqual(1)
  })
})

describe('RSA et prime d’activité', () => {
  const entree = {
    couple: true,
    enfants: 2,
    appreciationIsoleMajore: false,
    revenusProfessionnelsMensuelsEuros: [0],
    allocationsFamilialesMensuellesEuros: 153.01,
    aideLogementMensuelleEuros: 492,
  }

  test('construit le montant forfaitaire selon le foyer (art. D843-1)', () => {
    const coefficient = (c: boolean, enfants: number, majore = false) =>
      montantForfaitaire(1000, { couple: c, enfants, appreciationIsoleMajore: majore }) / 1000
    expect(coefficient(false, 0)).toBeCloseTo(1, 6)
    expect(coefficient(true, 0)).toBeCloseTo(1.5, 6)
    expect(coefficient(true, 2)).toBeCloseTo(2.1, 6)
    expect(coefficient(true, 3)).toBeCloseTo(2.5, 6)
    expect(coefficient(false, 3)).toBeCloseTo(2.2, 6)
    expect(coefficient(false, 1, true)).toBeCloseTo(1.71216, 6)
  })

  test('complète les ressources jusqu’au forfait, sans prime sans activité', () => {
    // 651,69 × 2,1 - 153,01 - (651,69 × 1,8 × 16,5 %) = 1 021,99.
    expect(calculRsaMensuel(entree)).toBeCloseTo(1021.99, 2)
    expect(calculPrimeActiviteMensuelle(entree)).toBe(0)
  })

  test('fait croître la bonification entre 59 et 138 SMIC horaires', () => {
    expect(bonificationMensuelle(59 * 12.31)).toBe(0)
    expect(bonificationMensuelle(138 * 12.31)).toBeCloseTo(240.63, 2)
    expect(bonificationMensuelle(5000)).toBeCloseTo(240.63, 2)
  })

  test('ne verse pas une prime inférieure à 15 €', () => {
    const prime = (revenu: number) =>
      calculPrimeActiviteMensuelle({ ...entree, revenusProfessionnelsMensuelsEuros: [revenu] })
    expect(prime(20)).toBe(0)
    expect(prime(30)).toBeGreaterThanOrEqual(15)
  })
})

describe('C0.7 · Revenu disponible combiné', () => {
  const options = { logement: { zone: 2 as const, loyerMensuelEuros: 750 }, activite: {} }

  test('additionne exactement les composantes affichées', () => {
    for (const revenu of [0, 12_000, 30_000, 44_461, 90_000]) {
      const r = calculRevenuDisponible(revenu, coupleDeuxEnfants, options)
      expect(r.revenuDisponibleEuros).toBeCloseTo(
        revenu -
          r.impotMisEnRecouvrementEuros +
          r.allocationsFamilialesAnnuellesEuros +
          r.aideLogementAnnuelleEuros +
          r.primeActiviteAnnuelleEuros +
          r.rsaAnnuelEuros,
        2,
      )
    }
  })

  test('ne calcule ni aide au logement ni minima sans les options', () => {
    const r = calculRevenuDisponible(10_000, coupleDeuxEnfants)
    expect(r.aideLogementAnnuelleEuros).toBe(0)
    expect(r.primeActiviteAnnuelleEuros).toBe(0)
    expect(r.rsaAnnuelEuros).toBe(0)
  })

  test('ignore les revenus d’activité dans l’aide au logement tant que le RSA est versé', () => {
    const avecRsa = calculRevenuDisponible(12_000, coupleDeuxEnfants, options)
    expect(avecRsa.rsaAnnuelEuros).toBeGreaterThan(0)
    expect(avecRsa.aideLogementAnnuelleEuros).toBe(5904)
    const sortie = calculRevenuDisponible(15_000, coupleDeuxEnfants, options)
    expect(sortie.rsaAnnuelEuros).toBe(0)
    expect(sortie.aideLogementAnnuelleEuros).toBeLessThan(5904)
  })

  test('combine résidence alternée et invalidité', () => {
    const r = calculRevenuDisponible(30_000, {
      ...parentIsole,
      enfantsEnResidenceAlternee: 2,
      adultesInvalides: 1,
    })
    expect(r.nombreDeParts).toBe(2.5)
    expect(r.allocationsFamilialesAnnuellesEuros).toBeCloseTo(478.16 * 0.32 * 6, 1)
  })

  test('détecte la baisse du revenu disponible au franchissement du seuil de 61 €', () => {
    const avant = calculRevenuDisponible(44_460, coupleDeuxEnfants)
    const apres = calculRevenuDisponible(44_461, coupleDeuxEnfants)
    expect(avant.impotMisEnRecouvrementEuros).toBe(0)
    expect(apres.impotMisEnRecouvrementEuros).toBe(61)
    expect(apres.revenuDisponibleEuros).toBeLessThan(avant.revenuDisponibleEuros)
  })

  test('simule un amendement et calcule le diff en euros', () => {
    const indexation = AMENDEMENTS_EXEMPLES[0]
    if (!indexation) throw new Error('Amendement absent')
    const diff = simulerAmendementIR(40_000, seul, indexation)
    expect(diff.apresAmendementEuros).toBeLessThan(diff.loiEnVigueurEuros)
    expect(diff.ecartEuros).toBeLessThan(0)
  })
})

describe('Balayage des effets de seuil', () => {
  test('le fichier summary.json correspond au calcul actuel', () => {
    expect(JSON.parse(JSON.stringify(detecterEffetsDeSeuil()))).toEqual(summary)
  })

  test('relève la sortie du RSA, la fin de la prime d’activité et le seuil de 61 €', () => {
    const baisses = summary.effetsDeSeuil.filter((e) => e.variationRevenuDisponibleEuros < 0)
    expect(baisses.some((e) => e.variations.rsa < 0 && e.variations.aideLogement < 0)).toBe(true)
    expect(baisses.some((e) => e.variations.primeActivite < 0 && e.variations.rsa === 0)).toBe(true)
    expect(baisses.some((e) => e.revenuApresEuros === 44_461 && e.variations.impot === -61)).toBe(true)
  })
})
