import { describe, expect, test } from 'bun:test'
import { analyzeHousehold, households } from './detect-kinks.ts'
import { calculIR2026 } from './ir2026.ts'

describe('J5 / C0.5 · noyau Impôt sur le revenu 2026 (CGI 193, 194, 197)', () => {
  test('applique le barème 2026, la décote et le plafonnement du quotient familial au centime', () => {
    const celibDecote = calculIR2026({
      dateDeCalcul: '2026-07-01',
      revenuNetImposableCentimes: 22_000_00,
      situationFamiliale: 'Célibataire',
      enfantsAChargeExclusiveOuPrincipale: 0,
      appreciationVitSeul: false,
      domicileFiscal: 'Métropole',
    })
    expect(celibDecote.impotBrutSansPlafond).toBe(1144_00)
    expect(celibDecote.decote).toBe(379_34)
    expect(celibDecote.impotNetAvantCredits).toBe(764_66)

    const couplePlafonne = calculIR2026({
      dateDeCalcul: '2026-07-01',
      revenuNetImposableCentimes: 120_000_00,
      situationFamiliale: 'ImpositionCommune',
      enfantsAChargeExclusiveOuPrincipale: 2,
      appreciationVitSeul: false,
      domicileFiscal: 'Métropole',
    })
    expect(couplePlafonne.nombreDeParts).toBe(3)
    expect(couplePlafonne.impotBrutSansPlafond).toBe(15311_97)
    expect(couplePlafonne.impotApresPlafondQf).toBe(18593_98)

    const guyaneCap = calculIR2026({
      dateDeCalcul: '2026-07-01',
      revenuNetImposableCentimes: 80_000_00,
      situationFamiliale: 'Célibataire',
      enfantsAChargeExclusiveOuPrincipale: 0,
      appreciationVitSeul: false,
      domicileFiscal: 'GuyaneMayotte',
    })
    expect(guyaneCap.refactionOutreMer).toBe(4050_00)
    expect(guyaneCap.impotNetAvantCredits).toBe(13053_99)
  })
})

describe('C0.6 · détecteur de coudes et falaises', () => {
  test('retrouve le coude de la décote (~15,98 %) et 0 falaise sur le barème pur', () => {
    const single = households[0]
    if (!single) throw new Error('Foyer célibataire absent')
    const analysis = analyzeHousehold(single, 100_000)

    expect(analysis.cliffs).toEqual([])
    expect(analysis.tmeZoneDecotePct).not.toBeNull()
    expect(Math.abs((analysis.tmeZoneDecotePct ?? 0) - 15.98)).toBeLessThan(0.05)
    expect(analysis.finDecoteEuros).toBeGreaterThan(29_000)
    expect(analysis.finDecoteEuros).toBeLessThan(30_000)
    expect(analysis.kinks.some((k) => k.tmeAvantPct === 0 && Math.abs(k.tmeApresPct - 15.98) < 0.05)).toBe(
      true,
    )
    expect(
      analysis.kinks.some(
        (k) => Math.abs(k.tmeAvantPct - 15.98) < 0.05 && Math.abs(k.tmeApresPct - 43.58) < 0.05,
      ),
    ).toBe(true)
    expect(analysis.kinks.some((k) => Math.abs(k.tmeAvantPct - 43.58) < 0.05 && k.tmeApresPct === 30)).toBe(
      true,
    )
  })

  test('retrouve le déclenchement du plafonnement du quotient familial pour un couple avec 2 enfants', () => {
    const couple2 = households[2]
    if (!couple2) throw new Error('Foyer couple 2 enfants absent')
    const analysis = analyzeHousehold(couple2, 100_000)

    expect(analysis.cliffs).toEqual([])
    expect(analysis.seuilPlafondQfEuros).not.toBeNull()
    expect(analysis.seuilPlafondQfEuros ?? 0).toBeGreaterThan(65_000)
    expect(analysis.seuilPlafondQfEuros ?? 0).toBeLessThan(80_000)
  })
})
