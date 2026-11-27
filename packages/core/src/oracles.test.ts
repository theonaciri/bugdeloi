import { describe, expect, test } from 'bun:test'
import {
  extractScopeSchema,
  formatCatalaLiteral,
  generateOracleCatalaFile,
  interfaceScopeName,
  isQualifyingNonLlmOracle,
  oracleLegiartis,
  validateOracleCases,
} from './oracles.ts'

const SAMPLE_CATALA = `> Module Noyau_ir

\`\`\`catala-metadata
déclaration énumération SituationFamiliale:
  -- Célibataire
  -- ImpositionCommune

déclaration champ d'application CalculImpôtRevenu:
  entrée revenu_net_imposable contenu argent
  entrée situation_familiale contenu SituationFamiliale
  entrée enfants contenu entier
  entrée appréciation_vit_seul contenu booléen
  résultat nombre_de_parts contenu décimal
  résultat impôt_mis_en_recouvrement contenu argent
\`\`\`
`

const VALID_CASE = {
  id: 'openfisca-ir-celibataire-25000',
  interface: 'CalculImpôtRevenu@v1',
  module: 'Noyau_ir',
  source: {
    kind: 'openfisca_test',
    ref: 'openfisca-france 177.1.4 (barème 2025)',
    retrieved: '2026-11-27',
    legal_units: ['LEGIARTI000054373592@2026-07-01', 'LEGIARTI000053542636@2026-02-21'],
  },
  author: {
    handle: 'theonaciri',
    role: 'oracle',
    family: 'humain',
  },
  blind_to: ['corpus/cgi/livre1/partie1/titre1/chapitre1/section5/noyau_ir.catala_fr'],
  inputs: {
    revenu_net_imposable: '25 000 €',
    situation_familiale: 'Célibataire',
    enfants: 0,
    appréciation_vit_seul: false,
  },
  expected: {
    nombre_de_parts: 1,
    impôt_mis_en_recouvrement: '1 281 €',
  },
}

describe('oracles YAML (AGENTS.md §4.3)', () => {
  test('valide un cas OpenFisca conforme et reconnaît un oracle non-LLM', () => {
    const res = validateOracleCases([VALID_CASE], 'test.yaml')
    expect(res.errors).toEqual([])
    expect(res.cases).toHaveLength(1)
    const c = res.cases[0]
    expect(c).toBeDefined()
    if (!c) return
    expect(isQualifyingNonLlmOracle(c)).toBe(true)
    expect(interfaceScopeName(c.interface)).toBe('CalculImpôtRevenu')
    expect(oracleLegiartis(c)).toEqual(['LEGIARTI000054373592', 'LEGIARTI000053542636'])
  })

  test('exclut les cas écrits par le traducteur (role: translate) du seuil N3', () => {
    const translatorCase = {
      ...VALID_CASE,
      id: 'self-test',
      author: { handle: 'codex', role: 'translate', family: 'openai' },
    }
    const res = validateOracleCases([translatorCase], 'self.yaml')
    expect(res.errors).toEqual([])
    expect(res.cases[0] && isQualifyingNonLlmOracle(res.cases[0])).toBe(false)
  })

  test('exige une dérivation pour derivation_manuelle et rejette les doublons', () => {
    const missingDerivation = {
      ...VALID_CASE,
      id: 'no-deriv',
      source: { ...VALID_CASE.source, kind: 'derivation_manuelle' },
    }
    const res = validateOracleCases([missingDerivation, VALID_CASE, VALID_CASE], 'bad.yaml')
    expect(res.errors.length).toBe(2)
    expect(res.errors[0]).toContain('derivation')
    expect(res.errors[1]).toContain('doublon')
  })

  test('extrait le schéma Catala et génère un fichier #[test] valide', () => {
    const schema = extractScopeSchema(SAMPLE_CATALA, 'CalculImpôtRevenu')
    expect(schema).not.toBeNull()
    if (!schema) return
    expect(schema.moduleName).toBe('Noyau_ir')
    expect(schema.inputs.get('revenu_net_imposable')).toBe('argent')
    expect(schema.enumConstructors.has('Célibataire')).toBe(true)

    expect(formatCatalaLiteral('25 000 €', 'argent', schema.enumConstructors, 'Noyau_ir')).toBe('25000€')
    expect(formatCatalaLiteral(1, 'décimal', schema.enumConstructors, 'Noyau_ir')).toBe('1,0')
    expect(formatCatalaLiteral(false, 'booléen', schema.enumConstructors, 'Noyau_ir')).toBe('faux')
    expect(
      formatCatalaLiteral('Célibataire', 'SituationFamiliale', schema.enumConstructors, 'Noyau_ir'),
    ).toBe('Noyau_ir.SituationFamiliale.Célibataire')

    const { cases } = validateOracleCases([VALID_CASE], 'test.yaml')
    const catala = generateOracleCatalaFile(schema, cases)
    expect(catala).toContain('> Usage de Noyau_ir')
    expect(catala).toContain('#[test]')
    expect(catala).toContain("déclaration champ d'application TestOracle_openfisca_ir_celibataire_25000:")
    expect(catala).toContain(
      'définition c.situation_familiale égal à Noyau_ir.SituationFamiliale.Célibataire',
    )
    expect(catala).toContain('assertion c.nombre_de_parts = 1,0')
    expect(catala).toContain('assertion c.impôt_mis_en_recouvrement = 1281€')
  })
})
