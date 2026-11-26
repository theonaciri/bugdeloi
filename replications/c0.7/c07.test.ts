import { describe, expect, test } from 'bun:test'
import {
  AMENDEMENTS_EXEMPLES,
  calculAllocationsFamilialesAnnuelles,
  calculRevenuDisponible,
  simulerAmendementIR,
} from './revenu-disponible.ts'

describe('C0.7 · Revenu disponible combiné (IR 2026 + Allocations familiales)', () => {
  test('calcule la modulation des allocations familiales et le complément dégressif', () => {
    const plein = calculAllocationsFamilialesAnnuelles(50_000, 2)
    expect(plein.tranche).toBe('taux_plein')
    expect(plein.annuelEuros).toBeGreaterThan(1700)

    const reduit = calculAllocationsFamilialesAnnuelles(90_000, 2)
    expect(reduit.tranche).toBe('taux_reduit_50')
    expect(reduit.annuelEuros).toBeCloseTo(plein.annuelEuros / 2, 1)

    const quart = calculAllocationsFamilialesAnnuelles(120_000, 2)
    expect(quart.tranche).toBe('taux_reduit_25')
    expect(quart.annuelEuros).toBeCloseTo(plein.annuelEuros / 4, 1)
  })

  test('détecte la baisse du revenu disponible au franchissement de la falaise de 61 €', () => {
    const foyer = {
      situationFamiliale: 'ImpositionCommune' as const,
      enfantsAChargeExclusiveOuPrincipale: 2,
      appreciationVitSeul: false,
      domicileFiscal: 'Métropole' as const,
    }
    const avant = calculRevenuDisponible(44_460, foyer)
    const apres = calculRevenuDisponible(44_461, foyer)
    expect(avant.impotMisEnRecouvrementEuros).toBe(0)
    expect(apres.impotMisEnRecouvrementEuros).toBe(61)
    expect(apres.revenuDisponibleEuros).toBeLessThan(avant.revenuDisponibleEuros)
  })

  test('simule un amendement et calcule le diff en euros', () => {
    const foyer = {
      situationFamiliale: 'Célibataire' as const,
      enfantsAChargeExclusiveOuPrincipale: 0,
      appreciationVitSeul: false,
      domicileFiscal: 'Métropole' as const,
    }
    const indexation = AMENDEMENTS_EXEMPLES[0]
    if (!indexation) throw new Error('Amendement absent')
    const diff = simulerAmendementIR(40_000, foyer, indexation)
    expect(diff.apresAmendementEuros).toBeLessThan(diff.loiEnVigueurEuros)
    expect(diff.ecartEuros).toBeLessThan(0)
  })
})
