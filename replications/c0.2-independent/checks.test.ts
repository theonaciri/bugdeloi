import { describe, expect, test } from 'bun:test'
import { check, compareSubdivisions, date, inForce, normalize, syntaxProblems } from './checks.ts'
import { type Article, ArticleIndex, parseArticle } from './tricoteuses.ts'

const source: Article = {
  id: 'LEGIARTI000000000001',
  num: 'R1',
  start: '2020-01-01',
  end: '2999-01-01',
  state: 'VIGUEUR',
  path: 'css/article_r1.md',
  paragraphs: ['Selon l’article R. 2, « une condition ».'],
}
const expired: Article = {
  ...source,
  id: 'LEGIARTI000000000002',
  num: 'R2',
  end: date,
  state: 'ABROGE',
  path: 'css/article_r2.md',
  paragraphs: [],
}

function reference(targets: Article[], excerpt = 'Selon l\'article R.\u00a02, " une condition ".') {
  const corpus = {
    CGI: new ArticleIndex([]),
    CSS: new ArticleIndex([source, ...targets]),
    CCH: new ArticleIndex([]),
  }
  return check(
    'F-test',
    'REF_MORTE',
    {
      proof: {
        projection_date: date,
        source: { code: 'CSS', id: source.id },
        citation: { normalized_num: 'r2', occurrences: [{ excerpt }] },
        target_lineage: { code: 'CSS', derniere_version: { id: expired.id, num: 'R. 2' } },
        outcome: { last_version_etat: 'ABROGE' },
      },
    },
    corpus,
  )
}

describe('instantané Tricoteuses', () => {
  test('lit séparément le corps, les métadonnées et la nota', () => {
    const article = parseArticle(
      `---
Nature: Article
Numéro: R1
État: VIGUEUR
Date de début: 2020-01-01
Date de fin: 2999-01-01
Identifiant: LEGIARTI000000000001
---

# Article R1

Un &laquo; début &raquo;.<br />
Une <b>fin</b>.

### Nota

Une note.

## [Autres formats](https://example.invalid)
`,
      source.path,
    )
    expect(article.paragraphs).toEqual(['Un « début ».', 'Une fin.'])
    expect(article.id).toBe(source.id)
    expect(article.num).toBe(source.num)
    expect(normalize('I. ― L’article\u202f« R. 2 »')).toBe('I. - L\'article " R. 2 "')
  })

  test('inclut le début, exclut la fin et distingue les états DILA', () => {
    expect(inForce({ ...source, start: date, state: 'VIGUEUR_DIFF' })).toBe(true)
    expect(inForce({ ...source, end: date, state: 'ABROGE_DIFF' })).toBe(false)
    expect(inForce({ ...source, start: '2026-11-26' })).toBe(false)
    expect(inForce({ ...source, state: 'ABROGE' })).toBe(false)
    expect(inForce({ ...source, state: 'MODIFIE' })).toBe(false)
    expect(inForce({ ...source, state: 'MODIFIE', end: '2026-11-26' })).toBe(true)
  })
})

describe('renvois', () => {
  test('reproduit l’extrait et l’état d’une cible arrivée à terme', () => {
    expect(reference([expired])).toMatchObject({
      verdict: 'confirmé',
      fichiers: [source.path, expired.path],
    })
  })

  test('une version en vigueur du même numéro suffit pour contredire le contrôle par numéro', () => {
    const current = {
      ...expired,
      id: 'LEGIARTI000000000003',
      num: 'R. 2',
      end: '2999-01-01',
      state: 'VIGUEUR',
    }
    expect(reference([expired, current]).verdict).toBe('infirmé')
  })

  test('distingue l’absence de données, un autre état terminal et l’absence d’extrait', () => {
    expect(reference([]).verdict).toBe('indéterminé')
    expect(reference([{ ...expired, state: 'TRANSFERE' }]).verdict).toBe('infirmé')
    expect(reference([expired], 'Selon l’article R. 3').verdict).toBe('infirmé')
  })
})

describe('syntaxe et numérotation', () => {
  test('laisse passer les subdivisions et les citations sur plusieurs alinéas', () => {
    expect(syntaxProblems(['a bis) « Texte', '« suite [annexe]. »', 'b) (fin)'])).toEqual([])
  })

  test('sépare les guillemets imbriqués et les signes non appariés', () => {
    expect(syntaxProblems(['« Texte "cité" »', 'l2°) fin (suite', '10° “Exemple', '11° “Autre”'])).toEqual([
      'guillemet_droit_non_apparie',
      'parenthese_non_ouverte',
      'parenthese_non_fermee',
    ])
  })

  test('distingue une répétition d’un changement de section ou de portée de citation', () => {
    expect(compareSubdivisions(['1. Premier', '2. Avant', '2. Après'], '2. Avant', '2. Après', '2.')).toBe(
      'repetition',
    )
    expect(
      compareSubdivisions(['2. Avant', 'III bis.-1. Nouveau', '2. Après'], '2. Avant', '2. Après', '2.'),
    ).toBe('niveau')
    expect(
      compareSubdivisions(
        ['b) Est ainsi rédigé : " Texte', 'c) Avant " ;', 'c) Après'],
        'c) Avant',
        'c) Après',
        'c)',
      ),
    ).toBe('citation')
  })
})
