import { describe, expect, test } from 'bun:test'
import { sha256Hex } from '../../packages/core/src/legi.ts'
import { baseline } from './baseline-heuristic.ts'
import { score } from './evaluate.ts'
import { type GroundTruthItem, parseSourceFile } from './extract-ground-truth.ts'
import { checkNoLeaks } from './generate-task.ts'
import type { BlindPacket } from './packet.ts'

describe('C0.4 · extraction et évaluation aveugle', () => {
  test('extrait les TODO juridiques et dépendances BOFiP rattachés au LEGIARTI précédent', () => {
    const sample = `
#### Article D755-5|LEGIARTI000006738575

\`\`\`catala
# TODO: la syntaxe de la phrase est très ambiguë pour l'enfant unique.
# D'après BOI-IR-LIQ-20-20-30, la décote s'applique après réfaction.
# TODO: refactorer le nom de la variable locale
\`\`\`
`
    const { annotations: items } = parseSourceFile(
      'allocations_familiales/securite_sociale_D.catala_fr',
      sample,
    )
    expect(
      items.some((i) => i.kind === 'todo_juridique' && i.nearestLegiarti === 'LEGIARTI000006738575'),
    ).toBe(true)
    expect(
      items.some(
        (i) =>
          i.kind === 'dependance_bofip' &&
          i.bofipRef === 'BOI-IR-LIQ-20-20-30' &&
          i.nearestLegiarti === 'LEGIARTI000006738575',
      ),
    ).toBe(true)
  })

  test('checkNoLeaks rejette toute fuite de commentaire Inria ou mention BOI dans le paquet aveugle', () => {
    const text = 'La charge effective et permanente est appréciée selon les règles fixées par décret.'
    const packet: BlindPacket = {
      articles: [
        {
          legiarti: 'LEGIARTI000006738575',
          code: 'CSS',
          article: 'D755-5',
          dateDebut: '1998-12-30',
          dateFin: '2999-01-01',
          textSha256: sha256Hex(text),
          text,
        },
      ],
    }
    expect(() =>
      checkNoLeaks(packet, 'Lisez les textes officiels et relevez les ambiguïtés.', [
        '# TODO Liane: Angle mort sur la charge effective et permanente',
      ]),
    ).not.toThrow()

    expect(() => checkNoLeaks(packet, 'Voir catala-examples pour les indices.', [])).toThrow()
  })

  test('calcule le rappel de manière déterministe sur le témoin mécanique', () => {
    const text =
      "L'allocation est due à la personne qui assume la charge effective et permanente de l'enfant dans des conditions fixées par décret."
    const packet: BlindPacket = {
      articles: [
        {
          legiarti: 'LEGIARTI000006738575',
          code: 'CSS',
          article: 'L521-2',
          dateDebut: '2018-01-01',
          dateFin: '2999-01-01',
          textSha256: sha256Hex(text),
          text,
        },
      ],
    }
    const observations = baseline(packet)
    expect(observations.length).toBeGreaterThan(0)

    const truth: GroundTruthItem[] = [
      {
        id: 'c04-todo-001',
        kind: 'todo_juridique',
        suite: 'allocations_familiales',
        file: 'allocations_familiales/securite_sociale_L.catala_fr',
        line: 430,
        nearestLegiarti: 'LEGIARTI000006738575',
        excerpt: 'Angle mort sur la charge effective et permanente.',
        inBugdeloiDb: true,
      },
    ]
    const result = score(truth, packet, observations)
    expect(result.inPacket).toBe(1)
    expect(result.matched).toBe(1)
    expect(result.recallPercent).toBe(100)
  })
})
