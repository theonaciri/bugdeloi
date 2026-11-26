import { describe, expect, test } from 'bun:test'
import { calculIR2026, type Foyer } from '../../../replications/c0.6/ir2026.ts'
import echantillon from './fixtures/plf2026-sample.json'
import { calculImpact, foyersTypes, impotApresAmendement } from './impact.ts'
import {
  type AmendementSuivi,
  articlesSuivis,
  correspondances,
  extraireParametres,
  parseAmendement,
  veille,
} from './tricoteuses.ts'

const modele = parseAmendement(echantillon[0])
const cgi197 = "de l'article 197 du code général des impôts"
const amender = (dispositif: string, articleCible = '') => ({ ...modele, articleCible, dispositif })

function suivre(dispositif: string): AmendementSuivi {
  const [suivi] = veille([amender(dispositif)])
  if (!suivi) throw new Error('Amendement non suivi')
  return suivi
}

function ecarts(suivi: AmendementSuivi) {
  const impact = calculImpact(suivi)
  if (impact.statut !== 'calcule') throw new Error(impact.motif)
  return impact.foyers.map((f) => [f.loiEnVigueurEuros, f.apresAmendementEuros, f.ecartEuros])
}

describe('lecture Tricoteuses', () => {
  test('valide et normalise les champs', () => {
    expect(echantillon.map((a) => parseAmendement(a).chambre)).toEqual(['AN', 'SENAT', 'AN'])
    expect(parseAmendement({ ...modele, dateDepot: '2025-10-17T10:30:00+02:00' }).dateDepot).toBe(
      '2025-10-17',
    )
  })

  test.each(
    [
      null,
      [],
      {},
      { ...modele, uid: '' },
      { ...modele, numero: 12 },
      { ...modele, dispositif: undefined },
      { ...modele, dateDepot: '2025-02-30' },
      { ...modele, dateDepot: '17/10/2025' },
      { ...modele, chambre: 'Conseil' },
      { ...modele, chambre: 'constructor' },
    ].map((entree) => [entree]),
  )('rejette une entrée invalide : %j', (entree) => {
    expect(() => parseAmendement(entree)).toThrow(TypeError)
  })

  test('rejette un lot qui n’est pas un tableau', () => {
    expect(() => veille({})).toThrow(TypeError)
  })
})

describe('rattachement aux articles formalisés', () => {
  test('filtre l’amendement hors périmètre', () => {
    const suivis = veille(echantillon)
    expect(suivis.map((s) => s.amendement.uid)).toEqual([
      'FICTIF-AN-PLF2026-0001',
      'FICTIF-SENAT-PLF2026-0002',
    ])
    expect(suivis.map((s) => s.correspondances.map((c) => [c.code, c.article, c.legiarti]))).toEqual([
      [['CGI', '197', 'LEGIARTI000053542636']],
      [['CGI', '1657', 'LEGIARTI000051219510']],
    ])
  })

  test.each(articlesSuivis)('reconnaît $code $article', ({ code, article, legiarti }) => {
    const nom = code === 'CGI' ? 'code général des impôts' : 'code de la sécurité sociale'
    const ecrit = article.replace(/^([LD])/, '$1. ')
    for (const texte of [`À l’article ${ecrit} du ${nom}, …`, `${code}, art. ${article}`]) {
      expect(correspondances(amender(texte)).map((c) => c.legiarti)).toEqual([legiarti])
    }
  })

  test('lit une liste d’articles et signale l’origine', () => {
    const trouvees = correspondances(
      amender('Aux articles 193, 194 et 197 du code général des impôts, …', 'CGI art. 197'),
    )
    expect(trouvees.map((c) => [c.article, c.origine])).toEqual([
      ['197', 'article_cible'],
      ['193', 'dispositif'],
      ['194', 'dispositif'],
    ])
  })

  test.each([
    'À l’article 197 A du code général des impôts',
    'À l’article 197 bis du code général des impôts',
    'À l’article 1970 du code général des impôts',
    'À l’article L. 521-10 du code de la sécurité sociale',
    'À l’article L. 521-1 du code de l’éducation',
    'À l’article 197 du livre des procédures fiscales',
    'À l’article 197',
    'À l’article 197 du code de la sécurité sociale',
  ])('ne rattache pas : %s', (texte) => {
    expect(correspondances(amender(texte))).toEqual([])
  })
})

describe('extraction des paramètres', () => {
  test('lit les deux amendements fictifs suivis', () => {
    expect(veille(echantillon).map((s) => s.extraction)).toEqual([
      {
        parametres: [{ type: 'indexation_bareme', pourcentage: 2 }],
        phrasesNonReconnues: [],
        complete: true,
      },
      { parametres: [{ type: 'suppression_seuil_61' }], phrasesNonReconnues: [], complete: true },
    ])
  })

  test('lit la suppression et la modification de la décote', () => {
    expect(extraireParametres(`Le a du 4 du I ${cgi197} est abrogé.`).parametres).toEqual([
      { type: 'suppression_decote' },
    ])
    const modification = extraireParametres(
      `Au a du 4 du I ${cgi197}, le montant : « 897 € » est remplacé par le montant : « 950 € », le montant : « 1 483 € » est remplacé par le montant : « 1 570 € » et le taux : « 45,25 % » est remplacé par le taux : « 44 % ».`,
    )
    expect(modification.complete).toBe(true)
    expect(modification.parametres).toEqual([
      { type: 'decote_montant_celibataire', euros: 950 },
      { type: 'decote_montant_couple', euros: 1570 },
      { type: 'decote_taux', pourcentage: 44 },
    ])
  })

  test.each([
    'Le 1 bis de l’article 1657 du code général des impôts n’est pas abrogé.',
    'Le 1 bis de l’article 1657 du code général des impôts est abrogé pour les seuls célibataires.',
    `Au 1 du I ${cgi197}, les montants sont relevés de 2 % à compter de 2028.`,
    `Au a du 4 du I ${cgi197}, le montant : « 900 € » est remplacé par le montant : « 950 € ».`,
  ])('ne devine pas : %s', (dispositif) => {
    const extraction = extraireParametres(dispositif)
    expect(extraction).toMatchObject({ parametres: [], complete: false })
    expect(extraction.phrasesNonReconnues).toHaveLength(1)
  })

  test('une phrase inconnue ou contradictoire bloque le chiffrage', () => {
    for (const dispositif of [
      `Le a du 4 du I ${cgi197} est abrogé. Le 3 du même I est abrogé.`,
      `Le a du 4 du I ${cgi197} est abrogé. Au a du 4 du I ${cgi197}, le taux : « 45,25 % » est remplacé par le taux : « 40 % ».`,
    ]) {
      const suivi = suivre(dispositif)
      expect(suivi.extraction.complete).toBe(false)
      expect(calculImpact(suivi).statut).toBe('non_calculable')
    }
  })

  test('l’exposé sommaire ne fixe aucun paramètre', () => {
    const [suivi] = veille([
      { ...amender('Texte libre.', 'CGI art. 197'), exposeSommaire: `Le 4 du I ${cgi197} est abrogé.` },
    ])
    expect(suivi?.extraction.parametres).toEqual([])
  })
})

describe('écart en euros', () => {
  test('sans paramètre, égale calculIR2026 (parité)', () => {
    const base: Foyer = {
      situationFamiliale: 'Célibataire',
      enfantsAChargeExclusiveOuPrincipale: 0,
      appreciationVitSeul: false,
      domicileFiscal: 'Métropole',
    }
    const foyers: Foyer[] = [
      ...foyersTypes.map((f) => f.foyer),
      { ...base, enfantsAChargeExclusiveOuPrincipale: 1, appreciationVitSeul: true },
      { ...base, situationFamiliale: 'Veuf', enfantsAChargeExclusiveOuPrincipale: 3 },
    ]
    const differences: unknown[] = []
    for (const foyer of foyers) {
      for (let revenu = 0; revenu <= 400_000; revenu += 137) {
        const attendu =
          calculIR2026({ ...foyer, dateDeCalcul: '2026-07-01', revenuNetImposableCentimes: revenu * 100 })
            .impotMisEnRecouvrement / 100
        const obtenu = impotApresAmendement(revenu, foyer, [])
        if (obtenu !== attendu) differences.push({ foyer, revenu, attendu, obtenu })
      }
    }
    expect(differences).toEqual([])
  })

  test('indexation du barème de 2 % : barème seul, décote et plafonds inchangés', () => {
    const [indexation] = veille(echantillon)
    if (!indexation) throw new Error('Fixture absente')
    // Seuils : 11 832 €, 30 171 €, 86 269 €, 185 555 €.
    // 25 000 € : (25 000 − 11 832) × 11 % = 1 448,48 ; décote 897 − 655,44 = 241,56 ; 1 206,92 -> 1 207.
    // 17 592 € : 633,60 ; décote 897 − 286,70 = 610,30 ; 23,30 -> 23 < 61 -> 0.
    // 55 000 € (2 parts) : 2 × (27 500 − 11 832) × 11 % = 3 446,96 ; décote nulle -> 3 447.
    // 90 000 € (3 parts) : 3 × (30 000 − 11 832) × 11 % = 5 995,44 ;
    //   référence 2 parts : 2 × (18 339 × 11 % + 14 829 × 30 %) = 12 931,98 ;
    //   plafond : 12 931,98 − 2 × 1 807 = 9 317,98 -> 9 318.
    expect(ecarts(indexation).map((e) => e[1])).toEqual([1207, 0, 3447, 9318])
    for (const [avant = 0, apres = 0, ecart] of ecarts(indexation)) {
      expect(ecart).toBe(apres - avant)
      expect(ecart).toBeLessThanOrEqual(0)
    }
    const impact = calculImpact(indexation, { arrondiSeuils: 'euro_inferieur' })
    expect(impact.statut === 'calcule' && impact.hypotheses.at(-1)).toContain('euro inférieur')
  })

  test('suppression du seuil de 61 € : seul le foyer sous le seuil change', () => {
    const seuil = veille(echantillon)[1]
    if (!seuil) throw new Error('Fixture absente')
    const resultat = ecarts(seuil)
    for (const [index, [avant, apres, ecart]] of resultat.entries()) {
      if (index !== 1) expect([apres, ecart]).toEqual([avant, 0])
    }
    const exact = calculIR2026({
      ...foyersTypes[1].foyer,
      dateDeCalcul: '2026-07-01',
      revenuNetImposableCentimes: 1_759_200,
    })
    expect(resultat[1]).toEqual([
      exact.impotMisEnRecouvrement / 100,
      exact.impotArrondiEuro / 100,
      (exact.impotArrondiEuro - exact.impotMisEnRecouvrement) / 100,
    ])
  })

  test('suppression de la décote : retour à l’impôt avant décote', () => {
    const resultat = ecarts(suivre(`Le a du 4 du I ${cgi197} est abrogé.`))
    for (const [index, { foyer, revenuNetImposableEuros }] of foyersTypes.entries()) {
      const loi = calculIR2026({
        ...foyer,
        dateDeCalcul: '2026-07-01',
        revenuNetImposableCentimes: revenuNetImposableEuros * 100,
      })
      expect(resultat[index]?.[1]).toBe(Math.round(loi.impotApresPlafondQf / 100))
    }
  })

  test('ne chiffre pas les autres articles', () => {
    const impact = calculImpact(suivre('L’article 194 du code général des impôts est abrogé.'))
    expect(impact.statut).toBe('non_calculable')
  })
})
