import { describe, expect, test } from 'bun:test'
import { AF } from '../c0.7/parametres.ts'
import {
  type BaremeAF,
  type BaremeMensuel,
  type HistoriqueAF,
  parseSortiePont,
  type SortieOk,
} from './bridge.ts'
import {
  calculerAFLocal,
  calculerIRLocal,
  classerEcartAF,
  classerEcartIR,
  comparer,
  irAvecArrondisIntermediaires,
  PARAMETRES_IR_C06,
  parametresAFDifferents,
} from './classify.ts'
import { rapport, resumer } from './report.ts'
import { appelerPont, versJson } from './run.ts'
import { genererScenarios, premierRevenu, type Scenario, seuilsIR } from './scenarios.ts'

const LOCAL: BaremeAF = {
  bmafMensuelleEuros: AF.bmafMensuelleEuros,
  plafond1BaseEuros: AF.plafond1BaseEuros,
  plafond2BaseEuros: AF.plafond2BaseEuros,
  majorationPlafondParEnfantEuros: AF.majorationPlafondParEnfantEuros,
}
const MOIS: BaremeMensuel = { mois: '2026-07', ...LOCAL }
// Historique réduit aux valeurs locales ; `inconnus` les en retire pour tester le classement.
const historique = (inconnus: (keyof HistoriqueAF)[] = []): HistoriqueAF =>
  Object.fromEntries(
    (Object.keys(LOCAL) as (keyof HistoriqueAF)[]).map((cle) => [
      cle,
      inconnus.includes(cle) ? [] : [{ date: '2000-01-01', valeur: LOCAL[cle] }],
    ]),
  ) as HistoriqueAF

const foyer = (surcharge: Partial<Scenario> = {}): Scenario => ({
  id: 'f',
  domaine: 'af',
  revenuEuros: 30_000,
  situationFamiliale: 'ImpositionCommune',
  agesEnfants: [10, 8],
  appreciationVitSeul: false,
  domicileFiscal: 'Métropole',
  ...surcharge,
})
const resultat = (af: number, details: Record<string, number> = {}) => ({
  id: 'f',
  impot_revenu: null,
  af,
  details,
})
const impot = (montant: number, details: Record<string, number> = {}) => ({
  id: 'f',
  impot_revenu: montant,
  af: null,
  details,
})
const sortieOk = (results: SortieOk['results']): SortieOk => ({
  status: 'ok',
  versions: { openfisca_france: '0.0.0-fictive' },
  periode: { demandee: 2025, utilisee: 2025, moisAF: '2026-07' },
  parametres: { ir: PARAMETRES_IR_C06, af: { mois: MOIS, historique: historique() } },
  results,
})

describe('C0.8 · génération des foyers', () => {
  const scenarios = genererScenarios()

  test('est déterministe, avec des identifiants uniques et des entiers positifs', () => {
    expect(genererScenarios()).toEqual(scenarios)
    expect(new Set(scenarios.map((s) => s.id)).size).toBe(scenarios.length)
    expect(scenarios.every((s) => Number.isInteger(s.revenuEuros) && s.revenuEuros >= 0)).toBe(true)
    expect(new Set(scenarios.map((s) => s.domaine))).toEqual(new Set(['ir', 'af']))
  })

  test('encadre à 1 € les seuils du barème et la mise en recouvrement', () => {
    const revenus = new Set(
      scenarios
        .filter((s) => s.id.startsWith('ir-celibataire-') && !s.agesEnfants.length)
        .map((s) => s.revenuEuros),
    )
    // 17 593 € : falaise de 61 € consignée dans replications/c0.6/REPORT.md.
    for (const seuil of [11_600, 17_593, 29_579, 84_577, 181_917]) {
      for (const revenu of [seuil - 1, seuil, seuil + 1]) expect(revenus.has(revenu)).toBe(true)
    }
  })

  test('trouve la bascule de 61 € au premier euro où l’impôt est recouvré', () => {
    const celibataire = foyer({ domaine: 'ir', situationFamiliale: 'Célibataire', agesEnfants: [] })
    const seuils = seuilsIR({
      situationFamiliale: 'Célibataire',
      enfantsAChargeExclusiveOuPrincipale: 0,
      appreciationVitSeul: false,
      domicileFiscal: 'Métropole',
    })
    expect(seuils).toContain(17_593)
    expect(calculerIRLocal({ ...celibataire, revenuEuros: 17_592 }).impotRevenu).toBe(0)
    expect(calculerIRLocal({ ...celibataire, revenuEuros: 17_593 }).impotRevenu).toBe(61)
  })

  test('encadre les plafonds d’un barème AF supplémentaire', () => {
    const autre = { ...LOCAL, plafond1BaseEuros: 10_000, majorationPlafondParEnfantEuros: 1 }
    const revenus = genererScenarios([autre, autre]).map((s) => s.revenuEuros)
    for (const revenu of [10_001, 10_002, 10_003]) expect(revenus).toContain(revenu)
  })

  test('chaque foyer AF généré est calculable par c0.7', () => {
    for (const s of scenarios.filter((x) => x.domaine === 'af')) {
      expect(Number.isFinite(calculerAFLocal(s))).toBe(true)
    }
    expect(() => calculerAFLocal(foyer({ agesEnfants: [15, 10] }))).toThrow('indéterminée')
  })

  test('premierRevenu renvoie null quand le prédicat reste faux', () => {
    expect(premierRevenu((r) => r >= 42)).toBe(42)
    expect(premierRevenu(() => false)).toBeNull()
  })
})

describe('C0.8 · classement des écarts', () => {
  const celibataire = (revenuEuros: number) =>
    foyer({ domaine: 'ir', revenuEuros, situationFamiliale: 'Célibataire', agesEnfants: [] })

  test('IR : paramètres différents → millésime', () => {
    const params = { ...PARAMETRES_IR_C06, decoteSeul: 1 }
    const verdict = classerEcartIR(celibataire(30_000), impot(10), 0, params)
    expect(verdict.categorie).toBe('difference_de_millesime')
    expect(verdict.motif).toContain('decoteSeul')
  })

  test('IR : la contribution sur les hauts revenus n’explique que son propre montant', () => {
    const cehr = { contribution_exceptionnelle_hauts_revenus: 1500 }
    const classer = (montant: number) =>
      classerEcartIR(celibataire(300_000), impot(montant, cehr), 100_000, PARAMETRES_IR_C06).categorie
    expect(classer(101_500)).toBe('difference_de_perimetre')
    expect(classer(101_600)).toBe('divergence_simulateur')
  })

  // Montants OpenFisca observés (177.1.4), figés ici pour tester le contrefactuel sans Python.
  test.each([
    [17_593, 0, 61],
    [29_578, 1976, 1975],
  ])('IR : à %i €, l’écart suit l’ordre des arrondis mais reste une divergence', (revenu, autre, local) => {
    const s = celibataire(revenu)
    expect(calculerIRLocal(s).impotRevenu).toBe(local)
    expect(irAvecArrondisIntermediaires(s)).toBe(autre)
    const verdict = classerEcartIR(s, impot(autre), local, PARAMETRES_IR_C06)
    expect(verdict.categorie).toBe('divergence_simulateur')
    expect(verdict.motif).toContain('ARRONDI')
  })

  test('IR : sinon l’écart est dit non expliqué', () => {
    const verdict = classerEcartIR(celibataire(30_000), impot(1), 1000, PARAMETRES_IR_C06)
    expect(verdict.motif).toStartWith('Non expliqué')
  })

  const classerAF = (s: Scenario, ecart: number, parametres = { mois: MOIS, historique: historique() }) => {
    const local = calculerAFLocal(s)
    return classerEcartAF(s, resultat(local + ecart), local, parametres)
  }

  test('AF : valeur locale connue à une autre date → millésime', () => {
    const mois = { ...MOIS, bmafMensuelleEuros: 1 }
    expect(parametresAFDifferents(mois)).toEqual(['bmafMensuelleEuros'])
    const verdict = classerAF(foyer(), 100, { mois, historique: historique() })
    expect(verdict.categorie).toBe('difference_de_millesime')
  })

  test('AF : valeur locale introuvable → divergence', () => {
    const mois = { ...MOIS, plafond1BaseEuros: 1 }
    const parametres = { mois, historique: historique(['plafond1BaseEuros']) }
    const verdict = classerAF(foyer(), 100, parametres)
    expect(verdict.categorie).toBe('divergence_simulateur')
    expect(verdict.motif).toContain(`plafond1BaseEuros=${AF.plafond1BaseEuros}`)
  })

  test('AF : forfait et outre-mer → périmètre ; reste → divergence', () => {
    const s = foyer()
    const local = calculerAFLocal(s)
    const parametres = { mois: MOIS, historique: historique() }
    const avecForfait = resultat(local + 100, { af_allocation_forfaitaire: 100 })
    expect(classerEcartAF(s, avecForfait, local, parametres).categorie).toBe('difference_de_perimetre')
    const outreMer = classerAF(foyer({ domicileFiscal: 'GuyaneMayotte' }), 100)
    expect(outreMer.categorie).toBe('difference_de_perimetre')
    expect(classerAF(s, 100).categorie).toBe('divergence_simulateur')
  })

  test('comparer ignore l’accord, signale l’écart et refuse un résultat manquant', () => {
    const s = foyer()
    expect(comparer([s], sortieOk([resultat(calculerAFLocal(s))]))).toEqual([])
    const [ecart] = comparer([s], sortieOk([resultat(0)]))
    expect(ecart?.champ).toBe('af')
    expect(() => comparer([s], sortieOk([]))).toThrow('manquant')
  })
})

describe('C0.8 · pont JSON et rapport', () => {
  const valide = sortieOk([resultat(12.5, { af_base: 12.5 })])

  test('relit une sortie valide et une erreur structurée', () => {
    expect(parseSortiePont(JSON.stringify(valide))).toEqual(valide)
    const erreur = { status: 'error', code: 'openfisca_france_not_installed', message: 'absent' } as const
    expect(parseSortiePont(JSON.stringify(erreur))).toEqual(erreur)
  })

  test.each([
    ['texte', 'Traceback'],
    ['statut inconnu', '{"status":"?"}'],
    ['montant en texte', JSON.stringify(valide).replace('"af":12.5', '"af":"12.5"')],
    [
      'mois incomplet',
      JSON.stringify({
        ...valide,
        parametres: { ...valide.parametres, af: { mois: {}, historique: historique() } },
      }),
    ],
  ])('refuse une sortie invalide : %s', (_nom, brut) => {
    expect(() => parseSortiePont(brut)).toThrow('Sortie OpenFisca invalide')
  })

  test('sans environnement Python, le pont répond hors ligne et le rapport le dit', async () => {
    const sortie = await appelerPont([], '/chemin/inexistant/python')
    expect(sortie).toMatchObject({ status: 'error', code: 'venv_absent' })
    const resume = resumer(genererScenarios(), sortie, [], { irEuros: 0, afEuros: 0 })
    expect(resume.foyersCompares).toBe(0)
    expect(resume.ecartsParCategorie).toBeNull()
    expect(rapport(resume)).toContain('aucune comparaison n’a été faite')
  })

  test('compte et regroupe les écarts', () => {
    const s = foyer()
    const sortie = sortieOk([resultat(0)])
    const resume = resumer([s], sortie, comparer([s], sortie), { irEuros: 0, afEuros: 0 })
    expect(resume.ecartsParCategorie?.divergence_simulateur).toBe(1)
    expect(resume.groupes[0]?.exemples[0]?.entree).toEqual(s)
    expect(rapport(resume)).toContain('Un compte, pas une probabilité')
  })

  test('versJson reste relisible et compacte les listes courtes', () => {
    const valeur = { a: [1, 2], b: ['x, y'], c: [{ d: [] }] }
    const texte = versJson(valeur)
    expect(JSON.parse(texte)).toEqual(valeur)
    expect(texte).toContain('"a": [1, 2]')
  })
})
