import { describe, expect, test } from 'bun:test'
import { corpusRounding, scanRounding } from './rounding.ts'

const sample = [
  '#### Article 1|LEGIARTI000000000001',
  '',
  '```catala',
  "déclaration champ d'application Calcul:",
  '  entrée montant contenu argent',
  '  entrée proportion contenu décimal',
  '  résultat a contenu argent',
  '  résultat b contenu argent',
  '  résultat c contenu argent',
  '  résultat d contenu argent',
  '  résultat ratio contenu décimal',
  '',
  "champ d'application Calcul:",
  "  # Article 1 : arrondi à l'euro le plus proche.",
  '  définition a égal à arrondi de montant',
  "  # TODO juridique : le texte ne fixe pas d'arrondi.",
  '  définition b égal à montant * proportion',
  '  définition c égal à',
  '    # Article 1 : taux de 11 %.',
  '    montant * 11%',
  '  définition d égal à (décimal de 2) * 0,5',
  '  définition ratio égal à proportion * 50%',
  '',
  "champ d'application Calcul:",
  "  # Article 1 : arrondi à l'euro le plus proche.",
  '  définition a égal à arrondi de montant',
  '',
  '#[test]',
  "déclaration champ d'application Test:",
  "  calcul champ d'application Calcul",
  '',
  "champ d'application Test:",
  '  définition calcul.montant égal à arrondi de 10€ * 3%',
  '```',
].join('\n')

describe('inventaire des arrondis', () => {
  test('classe chaque point et ignore les tests', () => {
    const { points } = scanRounding('x.catala_fr', sample)
    expect(points.map((p) => [p.kind, p.definition, p.lines])).toEqual([
      ['prescrit', 'a', [15]],
      ['choisi', 'b', [17]],
      ['implicite', 'c', [20]],
      ['prescrit', 'a', [26]],
    ])
    expect(points[0]?.article).toEqual({ num: '1', legiarti: 'LEGIARTI000000000001' })
    expect(points[2]?.note).toBe('Article 1 : taux de 11 %.')
  })

  test('corpus : 38 quater est un choix écrit, 193 et 1657 sont fixés par le texte', () => {
    const files = corpusRounding()
    const quater = files.find((f) => f.file.endsWith('article_38-quater.catala_fr'))
    expect(quater?.points.every((p) => p.kind === 'choisi')).toBe(true)
    const ir = files.find((f) => f.file.endsWith('noyau_ir.catala_fr'))
    expect(ir?.points.filter((p) => p.kind === 'prescrit').map((p) => p.article?.num)).toEqual([
      '193',
      '1657',
    ])
  })
})
