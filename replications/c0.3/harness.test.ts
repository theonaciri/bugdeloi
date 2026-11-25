import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { legalTextHash } from '@bugdeloi/core/legi'
import { sourceCommit, withSource } from '../c0.1/source.ts'
import { entry, submissionFiles, task, withWorkspace } from './check.ts'
import { checkLeaks } from './check-leaks.ts'
import { committedSubmission, evaluate } from './evaluate.ts'

test('le paquet aveugle ne contient aucune ligne Catala substantielle de la source épinglée', async () => {
  await withSource((source) => checkLeaks(source))
}, 60_000)

test('les textes LEGI du paquet reproduisent leurs empreintes', async () => {
  const { articles } = (await Bun.file(join(task, 'articles.json')).json()) as {
    articles: { texte: string; sha256_normalisé: string; périmètre_initial: boolean }[]
  }
  expect(articles.filter((article) => article.périmètre_initial)).toHaveLength(18)
  for (const article of articles) {
    expect(legalTextHash(article.texte)).toBe(article.sha256_normalisé)
  }
})

test('le comparateur détecte aussi une ligne avec des espaces différents', async () => {
  await withWorkspace(async (source) => {
    await Bun.write(join(source, 'référence.catala_fr'), '```catala\n  définition montant égal à 42 €\n```\n')
    await withWorkspace(async (pack) => {
      await Bun.write(join(pack, 'interface.catala_fr'), 'définition   montant égal à 42€\n')
      await expect(checkLeaks(source, pack)).rejects.toThrow('interface.catala_fr:1')
    })
  })
})

test.skipIf(process.env.C03_REPLAY !== '1')(
  'la suite Inria réussit sur le témoin adapté puis distingue erreur et échec',
  async () => {
    const control = await evaluate({ handle: 'temoin', commit: sourceCommit })
    expect(control.cases.filter((item) => item.status !== 'passed').slice(0, 1)).toEqual([])
    expect([control.passed, control.total, control.score]).toEqual([17, 17, 1])
    expect(control.cases.filter((item) => item.kind === 'scope')).toHaveLength(15)
    expect(control.cases.filter((item) => item.name === 'Test1')).toHaveLength(2)
    expect(control.cases.filter((item) => item.name === 'Test13')).toHaveLength(1)

    await withWorkspace(async (directory) => {
      const load = () => submissionFiles(directory)
      const empty = await evaluate({ handle: 'vide', commit: 'fixture', load })
      expect([empty.passed, empty.failed, empty.errors, empty.total, empty.score]).toEqual([0, 0, 17, 17, 0])
      expect(empty.cases[0]?.diagnostic).toContain('doit inclure')

      const writeCalculation = (expression: string) =>
        Bun.write(
          join(directory, entry),
          `> Inclusion: interface.catala_fr

\`\`\`catala
champ d'application CalculMensuel:
  définition allocation_mensuelle égal à ${expression}

champ d'application OuverturePourEnfant:
  définition droit_individuel égal à faux
\`\`\`
`,
        )
      await writeCalculation('0 €')
      const wrong = await evaluate({ handle: 'faux', commit: 'fixture', load })
      expect(wrong.cases.filter((item) => item.status === 'error').slice(0, 1)).toEqual([])
      expect(wrong.failed).toBeGreaterThan(0)
      expect(wrong.total).toBe(control.total)
      expect(wrong.score).toBeLessThan(1)
      expect(wrong.cases.every((item) => item.classification === null)).toBe(true)
      expect([wrong.passed, wrong.failed, wrong.errors]).toEqual([4, 13, 0])

      await writeCalculation('0 € / 0,0')
      const runtimeError = await evaluate({ handle: 'erreur', commit: 'fixture', load })
      expect([runtimeError.passed, runtimeError.failed, runtimeError.errors]).toEqual([2, 1, 14])
      expect(runtimeError.cases.find((item) => item.status === 'error')?.diagnostic).toContain(
        'During evaluation',
      )
    })
  },
  120_000,
)

test.skipIf(process.env.C03_REPLAY !== '1')(
  'la remise épinglée reçoit explicitement l’appréciation générale et conserve les écarts classés',
  async () => {
    const submission = await committedSubmission('codex-gpt-6.2-sol', '028d1c4')
    const original = await evaluate(submission, 'original')
    expect([original.passed, original.failed, original.errors]).toEqual([5, 12, 0])
    expect(
      original.cases.filter((item) => item.status === 'failed').map((item) => item.classification),
    ).toEqual(Array(12).fill('erreur_harnais'))

    const completed = await evaluate(submission)
    expect([completed.passed, completed.failed, completed.errors]).toEqual([12, 5, 0])
    expect(
      completed.cases
        .filter((item) => item.status === 'failed')
        .map((item) => [item.name, item.classification]),
    ).toEqual([
      ['Test1', 'ambiguïté'],
      ['Test3', 'erreur_oracle'],
      ['Test7', 'ambiguïté'],
      ['Test8', 'ambiguïté'],
      ['Test12', 'erreur_oracle'],
    ])
  },
  120_000,
)
