import { describe, expect, test } from 'bun:test'
import { latestAnalysisFilenames } from './analyses.ts'
import { catalaPath, frozenInterfaces, parseAnalysis, sectionSlug } from './interfaces.ts'

const fiche = `# Article 167 du code général des impôts

Empreinte normalisée SHA-256 \`${'a'.repeat(64)}\`.

## Interface proposée

\`RevenusDépartÉtranger@v1\`

### Entrées

- \`date_de_départ\` (date).

### Sorties

- \`lignes_visées\` (liste).

## Classement des alinéas

1. Calculable.
`

describe('interfaces figées par les fiches d’analyse', () => {
  test('lit le nom accentué, la signature et l’empreinte', () => {
    const parsed = parseAnalysis(fiche)
    expect(parsed?.interface).toBe('RevenusDépartÉtranger@v1')
    expect(parsed?.hash).toBe('a'.repeat(64))
    expect(parsed?.signature).toContain('Entrées :')
    expect(parsed?.signature).toContain('Sorties :')
    expect(parsed?.signature).not.toContain('Classement')
  })

  test('lit une fiche v2 : nom de la nouvelle version, bloc de déclaration hors de la signature', () => {
    const v2 = `# Article 37\n\nEmpreinte normalisée SHA-256 \`${'b'.repeat(64)}\`.\n\n## Interface proposée\n\n\`Resultat37@v2\`, qui remplace \`Resultat37@v1\`.\n\n\`\`\`catala\ndéclaration champ d'application Resultat37:\n  entrée bilans contenu liste de argent\n\`\`\`\n\n## Classement des dispositions\n\nCalculable.\n`
    const parsed = parseAnalysis(v2)
    expect(parsed?.interface).toBe('Resultat37@v2')
    expect(parsed?.signature).not.toContain('déclaration champ')
    expect(parsed?.signature).toContain('Déclaration Catala figée dans la fiche')
  })

  test('retient la version la plus récente de chaque fiche', () => {
    expect(
      latestAnalysisFilenames([
        'LEGIARTI000000000002.md',
        'LEGIARTI000000000001.v2.md',
        'LEGIARTI000000000001.md',
        'README.md',
      ]),
    ).toEqual([
      { id: 'LEGIARTI000000000001', filename: 'LEGIARTI000000000001.v2.md', version: 2 },
      { id: 'LEGIARTI000000000002', filename: 'LEGIARTI000000000002.md', version: 1 },
    ])
  })

  test('refuse une fiche sans interface ou sans empreinte', () => {
    expect(parseAnalysis('# Article\n\n## Interface proposée\n\nÀ définir.')).toBeNull()
    expect(parseAnalysis(fiche.replace(/SHA-256.*\n/, ''))).toBeNull()
  })

  test('ne fige que des fiches calculables ou mixtes, liste manuelle comprise', () => {
    const all = [...frozenInterfaces().values()]
    expect(all.length).toBeGreaterThan(0)
    for (const f of all) {
      if (f.source === 'analyse') expect(['calculable', 'mixte']).toContain(f.category ?? '')
      expect(f.hash).toMatch(/^[0-9a-f]{64}$/)
    }
  })
})

describe('chemin du fichier Catala (hiérarchie Légifrance)', () => {
  test('convertit les intitulés de sections', () => {
    expect(sectionSlug("Livre premier : Assiette et liquidation de l'impôt")).toBe('livre1')
    expect(sectionSlug("Première Partie : Impôts d'État")).toBe('partie1')
    expect(sectionSlug('Titre II : Taxes sur le chiffre d’affaires')).toBe('titre2')
    expect(sectionSlug('Chapitre premier : Taxe sur la valeur ajoutée')).toBe('chapitre1')
    expect(sectionSlug('Section V : Calcul de la taxe')).toBe('section5')
    expect(sectionSlug('I : Taux')).toBe('i')
    expect(sectionSlug('A : Taux normal')).toBe('a')
    expect(sectionSlug('Partie législative')).toBeNull()
    expect(sectionSlug("Partie réglementaire - Décrets en Conseil d'Etat")).toBe('decrets-en-conseil-detat')
    expect(sectionSlug('Chapitre préliminaire : Dispositions générales')).toBe('chapitre-preliminaire')
    expect(sectionSlug('1re Sous-section : Revenus fonciers')).toBe('sous-section1')
    expect(sectionSlug('2e Sous-section : Bénéfices industriels et commerciaux')).toBe('sous-section2')
  })

  test('retrouve le chemin d’un fichier existant du corpus (CGI 278)', () => {
    const titles = [
      "Livre premier : Assiette et liquidation de l'impôt",
      "Première Partie : Impôts d'État",
      "Titre II : Taxes sur le chiffre d'affaires et taxes assimilées",
      'Chapitre premier : Taxe sur la valeur ajoutée',
      'Section V : Calcul de la taxe',
      'I : Taux',
      'A : Taux normal',
    ]
    expect(catalaPath('LEGITEXT000006069577', titles, '278', 'LEGIARTI000026950057')).toBe(
      'cgi/livre1/partie1/titre2/chapitre1/section5/i/a/article_278.catala_fr',
    )
    expect(catalaPath('LEGITEXT000006069577', [], '4 A', 'LEGIARTI000006302200')).toBe(
      'cgi/article_4-a.catala_fr',
    )
  })
})
