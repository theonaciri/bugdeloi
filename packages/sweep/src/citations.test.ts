import { describe, expect, test } from 'bun:test'
import { extractCitations, normalizeNum } from './citations.ts'

const nums = (text: string) => extractCitations(text).map((c) => c.num)

describe('normalizeNum', () => {
  test('numéros CGI : casse, espaces, 1er', () => {
    expect(normalizeNum('199 undecies B')).toBe('199 undecies b')
    expect(normalizeNum('1er')).toBe('1')
    expect(normalizeNum('223  VU   sexies')).toBe('223 vu sexies')
  })
  test('numéros CSS/CCH : préfixe, point, astérisque', () => {
    expect(normalizeNum('L. 521-1')).toBe('l521-1')
    expect(normalizeNum('L521-1')).toBe('l521-1')
    expect(normalizeNum('R*111-9')).toBe('r111-9')
    expect(normalizeNum('R. 111-9')).toBe('r111-9')
    expect(normalizeNum('D. 331-53-1')).toBe('d331-53-1')
  })
})

describe('extractCitations', () => {
  test('article simple du CGI avec suffixes', () => {
    expect(nums("au regard de l'article 199 undecies B, le contribuable")).toEqual(['199 undecies b'])
    expect(nums("l'article 1649 quater B bis est applicable")).toEqual(['1649 quater b bis'])
    expect(nums("l'article 150-0 A, les plus-values")).toEqual(['150-0 a'])
    expect(nums("l'article 223 VU sexies, la reprise")).toEqual(['223 vu sexies'])
  })
  test('adverbes longs non tronqués (quatervicies ≠ quater)', () => {
    expect(nums("de l'article 163 quatervicies du présent code")).toEqual(['163 quatervicies'])
    expect(nums("l'article 199 terdecies-0 A bis")).toEqual(['199 terdecies-0 a bis'])
  })
  test('liste, « et », « ou », plage', () => {
    expect(nums('aux articles L. 521-1 et L. 521-2 du présent code')).toEqual(['l521-1', 'l521-2'])
    const r = extractCitations('aux articles 150 U à 150 UC')
    expect(r.map((c) => [c.num, c.rangeRole])).toEqual([
      ['150 u', 'start'],
      ['150 uc', 'end'],
    ])
  })
  test('liste interrompue par « sauf le 1° »', () => {
    expect(nums('les articles D. 811-10 sauf le 1°, D. 811-11, D. 811-15')).toEqual([
      'd811-10',
      'd811-11',
      'd811-15',
    ])
  })
  test("« art. » (notes d'annexes) n'est pas une citation", () => {
    expect(nums('(1) Annexe III, art. 48.')).toEqual([])
  })
  test('lettre de suffixe accentuée ou point suscrit (« İ ») : numéro complet, diacritique ignoré', () => {
    expect(nums('des articles 31 bis, 199 decies İ, 199 undecies A et 199 septvicies')).toEqual([
      '31 bis',
      '199 decies i',
      '199 undecies a',
      '199 septvicies',
    ])
    expect(normalizeNum('199 decies İ')).toBe('199 decies i')
  })
  test('subdivisions (I, II, 2°) ne sont pas des suffixes', () => {
    expect(nums("au 2° du I de l'article 156 est applicable")).toEqual(['156'])
    expect(nums("de l'article 200 A II est applicable")).toEqual(['200 a'])
  })
})

describe('désignation de la norme visée', () => {
  const kind = (text: string) => extractCitations(text)[0]?.designation.kind
  test('présent code et codes nommés', () => {
    expect(kind('à l’article L. 241-3 du présent code'.replace('’', "'"))).toBe('self')
    expect(kind("l'article 1837 du code général des impôts que")).toBe('code')
    expect(kind("l'article L. 411-2 du code de la construction et de l'habitation")).toBe('code')
  })
  test('autres normes : écartées', () => {
    expect(kind("l'article L. 211-16 du code de l'organisation judiciaire")).toBe('other')
    expect(kind("l'article 49 de la même loi")).toBe('other')
    expect(kind("l'article 15 de la loi du 6 juillet 1989")).toBe('other')
    expect(kind('les articles 107 et 108 du traité sur le fonctionnement')).toBe('other')
    expect(kind("l'article 1er de l'annexe III")).toBe('other')
    expect(kind("l'article 150 du même code")).toBe('other')
    expect(kind("l'article L. 16 B du livre des procédures fiscales")).toBe('other')
    expect(kind("l'article L. 3141-1 du CGCT")).toBe('other')
    expect(kind('les articles L. 301-3 et L. 301-5-1 précités')).toBe('other')
  })
  test('incise « premier alinéa, » et désignation plus loin dans la proposition', () => {
    expect(kind("visés à l'article 1er, premier alinéa, de ladite loi mais se rattachant")).toBe('other')
    expect(kind("mentionnés à l'article 1er modifié de la même loi, figurent au bilan")).toBe('other')
    expect(kind("prévue à l'article L. 200-1 et conformément au code civil")).toBe('other')
    expect(kind("prévue à l'article L. 200-1 et à l'article L. 5 du code civil")).toBe('none') // désignation de la citation suivante
  })
  test('aucune désignation : même code (implicite)', () => {
    expect(kind("prévue à l'article 199 A, le taux")).toBe('none')
    expect(kind("mentionnées au I de l'article L. 862-4 et au 2° de")).toBe('none')
    expect(kind("de l'article 4 B, il est fait application")).toBe('none')
  })
})
