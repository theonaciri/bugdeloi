import { expect, test } from 'bun:test'
import { articleHeadings } from './coverage.ts'

const fence = '```'
const scope = "champ d'application Exemple:"

test('retient une définition sous un titre d’article', () => {
  const heading = '####### Article A | LEGIARTI000000000001'
  const fixture = [heading, '', `${fence}catala`, scope, '  définition', '    montant égal à 1 €', fence]
  expect(articleHeadings(fixture.join('\n'))).toEqual([
    { legiarti: 'LEGIARTI000000000001', line: 1, heading, formalized: true },
  ])
})

test('une citation textuelle cesse au prochain titre de même niveau ou supérieur', () => {
  const fixture = [
    '####### Article A | LEGIARTI000000000001',
    'La règle figure dans le texte.',
    '####### Annexe',
    `${fence}catala`,
    "déclaration champ d'application Exemple:",
    fence,
    '####### Article B | LEGIARTI000000000002',
    '###### Chapitre suivant',
    `${fence}catala`,
    scope,
    '  assertion vrai',
    fence,
  ]
  expect(articleHeadings(fixture.join('\n')).map((heading) => heading.formalized)).toEqual([false, false])
})

test('un article indiqué comme non formalisé peut contenir des commentaires Catala et un exemple CLI', () => {
  const fixture = [
    '####### Article A | LEGIARTI000000000001',
    'Cet article reste hors du champ du programme.',
    `${fence}catala`,
    scope,
    '  # définition montant égal à 1 €',
    fence,
    `${fence}catala-test-cli`,
    'assertion vrai',
    fence,
  ]
  expect(articleHeadings(fixture.join('\n'))[0]?.formalized).toBe(false)
})

test('rattache le code sous un sous-titre à l’article, et distingue les titres d’articles suivants', () => {
  const fixture = [
    '####### Article A | LEGIARTI000000000001',
    '######## Premier alinéa',
    `${fence}catala`,
    scope,
    '  exception défaut règle éligible satisfait',
    fence,
    '####### Article B | LEGIARTI000000000002',
    'Cet article est seulement cité.',
    '######## Article C | LEGIARTI000000000003',
    `${fence}catala-metadata`,
    'declaration scope Example:',
    fence,
  ]
  expect(articleHeadings(fixture.join('\n')).map((heading) => heading.formalized)).toEqual([
    true,
    false,
    true,
  ])
})

test('ignore un bloc Catala sans fermeture', () => {
  const fixture = ['####### Article A | LEGIARTI000000000001', `${fence}catala`, scope, '  assertion vrai']
  expect(articleHeadings(fixture.join('\n'))[0]?.formalized).toBe(false)
})
