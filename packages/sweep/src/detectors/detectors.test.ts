import { describe, expect, test } from 'bun:test'
import { ctxOf, link, TEXT_A, TEXT_B } from '../fixtures.ts'
import type { Candidate } from '../types.ts'
import { duplicateMarkers, scan as scanNum } from './numerotation.ts'
import { classifyLink, scan as scanLiens } from './ref-morte-liens.ts'
import { scan as scanTexte } from './ref-morte-texte.ts'
import { checkBalance, scan as scanSyntaxe } from './syntaxe.ts'

function proofOf<T>(c: Candidate | undefined): T {
  return (c as Candidate).proof as T
}

const p = (...paragraphs: string[]) => paragraphs.map((t) => `<p>${t}</p>`).join('\n')

describe('ref-morte-liens', () => {
  const base = [
    // article citant (en vigueur)
    {
      id: 'LEGIARTI000000000001',
      num: 'L100-1',
      etat: 'VIGUEUR',
      debut: '2020-01-01',
      html: p("Les conditions prévues à l'article L. 200-1 sont applicables."),
    },
    // cible vivante : v1 MODIFIE puis v2 VIGUEUR (même lignée)
    {
      id: 'LEGIARTI000000000010',
      num: 'L200-1',
      etat: 'MODIFIE',
      debut: '2000-01-01',
      fin: '2015-01-01',
      versionIds: ['LEGIARTI000000000010'],
    },
    {
      id: 'LEGIARTI000000000011',
      num: 'L200-1',
      etat: 'VIGUEUR',
      debut: '2015-01-01',
      versionIds: ['LEGIARTI000000000010', 'LEGIARTI000000000011'],
    },
  ]

  test("un renvoi vers une version MODIFIE dont l'article est en vigueur n'est pas mort", () => {
    const ctx = ctxOf(base, [link('LEGIARTI000000000001', 'LEGIARTI000000000010', 'L200-1')])
    expect(scanLiens(ctx).candidates).toHaveLength(0)
    expect(classifyLink(ctx, link('x', 'LEGIARTI000000000010', 'L200-1')).cls).toBe('vivante')
  })

  test('cible abrogée (aucune version en vigueur) : candidat « abrogé » confirmé par le texte', () => {
    const ctx = ctxOf(
      [
        base[0] as never,
        { id: 'LEGIARTI000000000020', num: 'L200-1', etat: 'ABROGE', debut: '2000-01-01', fin: '2018-01-01' },
      ],
      [link('LEGIARTI000000000001', 'LEGIARTI000000000020', 'L200-1')],
    )
    const { candidates, stats } = scanLiens(ctx)
    expect(candidates).toHaveLength(1)
    const c = candidates[0]
    expect(c?.type).toBe('REF_MORTE')
    expect(c?.subtype).toBe('abrogé')
    expect(c?.legalUnits[0]).toBe('LEGIARTI000000000001@2020-01-01')
    const proof = c?.proof as {
      text_mentions: { count: number; first: { excerpt: string; start: number; end: number } }
      order_of_dates: string
    }
    expect(proof.text_mentions.count).toBe(1)
    // l'extrait est une sous-chaîne exacte du texte normalisé, la position désigne le numéro cité
    const text = ctx.versions.get('LEGIARTI000000000001')?.contentText ?? ''
    expect(text.slice(proof.text_mentions.first.start, proof.text_mentions.first.end)).toBe('L. 200-1')
    expect(text.includes(proof.text_mentions.first.excerpt)).toBe(true)
    expect(proof.order_of_dates).toBe('avant_le_debut_de_la_version_citante')
    expect((stats.liens_par_classe as Record<string, number>).morte).toBe(1)
  })

  test('transfert : sous-type « transféré », lien de fin de vie joint au certificat', () => {
    const ctx = ctxOf(
      [
        base[0] as never,
        {
          id: 'LEGIARTI000000000030',
          num: 'L200-1',
          etat: 'TRANSFERE',
          debut: '2000-01-01',
          fin: '2019-01-01',
        },
      ],
      [link('LEGIARTI000000000001', 'LEGIARTI000000000030', 'L200-1')],
      [
        {
          ...link('LEGIARTI000000000030', 'LEGIARTI000000000099', 'L300-1'),
          typeLien: 'TRANSFERE',
          sens: 'cible',
        },
      ],
    )
    const [c] = scanLiens(ctx).candidates
    expect(c?.subtype).toBe('transféré')
    expect(
      proofOf<{ end_of_life_links_of_last_version: unknown[] }>(c).end_of_life_links_of_last_version,
    ).toHaveLength(1)
  })

  test('numéro de la cible absent du texte : pas un finding, une note « écart lien / texte »', () => {
    const ctx = ctxOf(
      [
        {
          id: 'LEGIARTI000000000001',
          num: 'L100-1',
          etat: 'VIGUEUR',
          debut: '2020-01-01',
          html: p('Aucune citation ici.'),
        },
        { id: 'LEGIARTI000000000020', num: 'L200-1', etat: 'ABROGE', debut: '2000-01-01', fin: '2018-01-01' },
      ],
      [link('LEGIARTI000000000001', 'LEGIARTI000000000020', 'L200-1')],
    )
    const r = scanLiens(ctx)
    expect(r.candidates).toHaveLength(0)
    expect(r.notes?.ecarts_lien_texte).toHaveLength(1)
    expect(r.notes?.ecarts_lien_texte?.[0]?.dead_subtype).toBe('abrogé')
    expect(r.stats.liens_morts_non_confirmes_par_le_texte).toBe(1)
  })

  test('indice « dans sa rédaction antérieure » signalé sans écarter le candidat', () => {
    const ctx = ctxOf(
      [
        {
          id: 'LEGIARTI000000000001',
          num: 'L100-1',
          etat: 'VIGUEUR',
          debut: '2020-01-01',
          html: p(
            "Les cas prévus à l'article L. 200-1, dans sa rédaction antérieure à la loi de 2018, restent régis par ce texte.",
          ),
        },
        { id: 'LEGIARTI000000000020', num: 'L200-1', etat: 'ABROGE', debut: '2000-01-01', fin: '2018-01-01' },
      ],
      [link('LEGIARTI000000000001', 'LEGIARTI000000000020', 'L200-1')],
    )
    const [c] = scanLiens(ctx).candidates
    expect(c).toBeDefined()
    const hints = proofOf<{ hints: { near_citation: Array<{ id: string }> } }>(c).hints.near_citation
    expect(hints.some((h) => h.id === 'redaction_anterieure')).toBe(true)
  })

  test('abrogation différée (ABROGE_DIFF) : encore en vigueur, pas candidate ; version future : « à venir »', () => {
    const ctx = ctxOf(
      [
        base[0] as never,
        {
          id: 'LEGIARTI000000000040',
          num: 'L200-1',
          etat: 'ABROGE_DIFF',
          debut: '2000-01-01',
          fin: '2027-01-01',
        },
        { id: 'LEGIARTI000000000050', num: 'L300-1', etat: 'VIGUEUR_DIFF', debut: '2027-01-01' },
      ],
      [
        link('LEGIARTI000000000001', 'LEGIARTI000000000040', 'L200-1'),
        link('LEGIARTI000000000001', 'LEGIARTI000000000050', 'L300-1'),
      ],
    )
    const { candidates, stats } = scanLiens(ctx)
    expect(candidates).toHaveLength(0)
    expect((stats.liens_par_classe as Record<string, number>).vivante).toBe(1)
    expect((stats.liens_par_classe as Record<string, number>).a_venir).toBe(1)
  })

  test('cibles hors des codes ingérés : comptées, jamais jugées ; couverture', () => {
    const ctx = ctxOf(
      [base[0] as never, base[2] as never],
      [
        link('LEGIARTI000000000001', 'LEGIARTI000000000011', 'L200-1'),
        link('LEGIARTI000000000001', 'LEGIARTI000000999999', '12', { targetCid: 'LEGITEXT000006072050' }), // code du travail
        link('LEGIARTI000000000001', 'JORFTEXT000000000001', null, { targetCid: null }),
      ],
    )
    const { candidates, stats } = scanLiens(ctx)
    expect(candidates).toHaveLength(0)
    expect(stats.liens_citation_sortants).toBe(3)
    expect(stats.liens_resolus).toBe(1)
    expect((stats.liens_par_classe as Record<string, number>).hors_codes_ingeres).toBe(1)
  })

  test('version absente de la base mais article connu par son numéro : résolu par le numéro', () => {
    const ctx = ctxOf(
      [
        base[0] as never,
        { id: 'LEGIARTI000000000020', num: 'L200-1', etat: 'ABROGE', debut: '2000-01-01', fin: '2018-01-01' },
      ],
      [link('LEGIARTI000000000001', 'LEGIARTI000000777777', 'L200-1', { targetCid: TEXT_A })],
    )
    const res = classifyLink(
      ctx,
      link('LEGIARTI000000000001', 'LEGIARTI000000777777', 'L200-1', { targetCid: TEXT_A }),
    )
    expect(res.cls).toBe('morte')
    expect(res.via).toBe('numero')
  })

  test('numéro réutilisé par une lignée en vigueur : pas mort', () => {
    const ctx = ctxOf(
      [
        base[0] as never,
        { id: 'LEGIARTI000000000020', num: 'L200-1', etat: 'ABROGE', debut: '2000-01-01', fin: '2018-01-01' },
        { id: 'LEGIARTI000000000021', num: 'L200-1', etat: 'VIGUEUR', debut: '2019-01-01' },
      ],
      [link('LEGIARTI000000000001', 'LEGIARTI000000777777', 'L200-1', { targetCid: TEXT_A })],
    )
    expect(scanLiens(ctx).candidates).toHaveLength(0)
  })
  test.each([
    ['F-2026-0103', 'R*111-2', 'R. 111-2', 'R111-2', 'version'],
    ['F-2026-0238', 'R*111-2', 'R. 111-2', 'R*111-2', 'version'],
    ['F-2026-0241', 'R*111-2', 'R. 111-2', 'R111-2', 'version_ids'],
    ['F-2026-0286', 'R*111-2', 'R. 111-2', 'R111-2', 'version'],
    ['F-2026-0430', 'D136-1', 'D. 136-1', 'D136-1', 'version'],
  ])('%s : lien historique et numéro réattribué', (_id, oldNum, raw, currentNum, via) => {
    const sourceId = 'LEGIARTI000000000001'
    const historyId = 'LEGIARTI000000000020'
    const missingId = 'LEGIARTI000000000022'
    const presentId = 'LEGIARTI000000000021'
    const citation = link(sourceId, via === 'version_ids' ? missingId : historyId, oldNum)
    const ctx = ctxOf(
      [
        {
          id: sourceId,
          num: 'L100-1',
          etat: 'VIGUEUR',
          debut: '2020-01-01',
          html: p(`Voir l'article ${raw}.`),
        },
        {
          id: historyId,
          num: oldNum,
          etat: 'ABROGE',
          debut: '2000-01-01',
          fin: '2018-01-01',
          versionIds: [historyId, missingId],
        },
        { id: presentId, num: currentNum, etat: 'VIGUEUR', debut: '2021-01-01' },
      ],
      [citation],
    )
    const resolution = classifyLink(ctx, citation)
    expect(resolution).toMatchObject({ cls: 'numero_reattribue', via, lineage: { id: historyId } })
    expect(resolution.alternates?.map((l) => l.id)).toEqual([presentId])
    const liens = scanLiens(ctx)
    expect(liens.candidates).toEqual([])
    expect(liens.notes?.numeros_reattribues).toHaveLength(1)
    const texte = scanTexte(ctx)
    expect(texte.candidates).toEqual([])
    expect(texte.stats.couples_vivants).toBe(1)
  })
})

describe('ref-morte-texte', () => {
  const dead = {
    id: 'LEGIARTI000000000020',
    num: 'L200-1',
    etat: 'ABROGE',
    debut: '2000-01-01',
    fin: '2018-01-01',
  }
  const live = { id: 'LEGIARTI000000000021', num: 'L200-2', etat: 'VIGUEUR', debut: '2000-01-01' }
  const src = (html: string) => ({
    id: 'LEGIARTI000000000001',
    num: 'L100-1',
    etat: 'VIGUEUR',
    debut: '2020-01-01',
    html: p(html),
  })

  test('« du présent code » : candidat ; article vivant : rien', () => {
    const ctx = ctxOf([src('Aux articles L. 200-1 et L. 200-2 du présent code.'), dead, live])
    const { candidates } = scanTexte(ctx)
    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.subtype).toBe('abrogé')
    expect(candidates[0]?.claim).toContain('L. 200-1')
  })

  test('autre norme (loi, autre code, « même code », précité) : jamais jugé', () => {
    for (const t of [
      "l'article L. 200-1 du code du travail",
      "l'article L. 200-1 de la loi du 6 juillet 1989",
      "l'article L. 200-1 du même code",
      'les articles L. 200-1 et L. 200-2 précités',
    ]) {
      const ctx = ctxOf([src(t), dead, live])
      expect(scanTexte(ctx).candidates).toHaveLength(0)
    }
  })

  test("un numéro absent de la base n'est pas jugé", () => {
    const ctx = ctxOf([src("l'article L. 999-1"), live])
    const { candidates, stats } = scanTexte(ctx)
    expect(candidates).toHaveLength(0)
    expect(stats.couples_inconnus_de_la_base).toBe(1)
  })

  test('CGI : un numéro à préfixe sans désignation ne vise pas le CGI', () => {
    const ctx = ctxOf([
      {
        id: 'LEGIARTI000000000100',
        num: '39',
        etat: 'VIGUEUR',
        debut: '2000-01-01',
        textId: TEXT_B,
        html: p("l'article L. 200-1 est applicable ; l'article 40 aussi"),
      },
      {
        id: 'LEGIARTI000000000101',
        num: '40',
        etat: 'ABROGE',
        debut: '2000-01-01',
        fin: '2010-01-01',
        textId: TEXT_B,
      },
      dead,
    ])
    const { candidates } = scanTexte(ctx)
    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.claim).toContain('« 40 »')
  })

  test("« article 1er » sans désignation explicite n'est pas jugé", () => {
    const ctx = ctxOf([
      {
        id: 'LEGIARTI000000000100',
        num: '39',
        etat: 'VIGUEUR',
        debut: '2000-01-01',
        textId: TEXT_B,
        html: p("les titres visés à l'article 1er de la loi"),
      },
      {
        id: 'LEGIARTI000000000101',
        num: '1',
        etat: 'ABROGE',
        debut: '2000-01-01',
        fin: '2010-01-01',
        textId: TEXT_B,
      },
    ])
    expect(scanTexte(ctx).candidates).toHaveLength(0)
  })

  test('même numéro cité deux fois : un seul candidat, deux occurrences', () => {
    const ctx = ctxOf([src("l'article L. 200-1 puis encore l'article L. 200-1 du présent code"), dead])
    const { candidates } = scanTexte(ctx)
    expect(candidates).toHaveLength(1)
    expect(proofOf<{ citation: { occurrence_count: number } }>(candidates[0]).citation.occurrence_count).toBe(
      2,
    )
  })

  test('lien LEGI présent / absent signalé', () => {
    const withLink = ctxOf(
      [src("l'article L. 200-1"), dead],
      [link('LEGIARTI000000000001', 'LEGIARTI000000000020', 'L200-1')],
    )
    const without = ctxOf([src("l'article L. 200-1"), dead])
    const flag = (c: ReturnType<typeof ctxOf>) =>
      proofOf<{ legi_link_to_target: { present: boolean } }>(scanTexte(c).candidates[0]).legi_link_to_target
        .present
    expect(flag(withLink)).toBe(true)
    expect(flag(without)).toBe(false)
  })
})

describe('numerotation', () => {
  test('deux articles distincts en vigueur avec le même numéro : candidat', () => {
    const ctx = ctxOf([
      { id: 'LEGIARTI000000000001', num: 'L100-1', etat: 'VIGUEUR', debut: '2020-01-01' },
      { id: 'LEGIARTI000000000002', num: 'L. 100-1', etat: 'VIGUEUR', debut: '2021-01-01' },
    ])
    const { candidates, stats } = scanNum(ctx)
    expect(candidates.filter((c) => c.subtype === 'article_numero_duplique')).toHaveLength(1)
    expect(stats.numeros_dupliques).toBe(1)
  })

  test('deux versions simultanées du même article : pas un numéro dupliqué', () => {
    // Anomalie de dates DILA hypothétique : deux versions VIGUEUR d'une même lignée. (Le cas réel
    // CSS R611-2, version MODIFIE à fin ouverte, n'est plus « en vigueur » : voir isInForce.)
    const ctx = ctxOf([
      {
        id: 'LEGIARTI000000000001',
        num: 'R611-2',
        etat: 'VIGUEUR',
        debut: '2018-01-01',
        versionIds: ['LEGIARTI000000000001', 'LEGIARTI000000000002'],
      },
      {
        id: 'LEGIARTI000000000002',
        num: 'R611-2',
        etat: 'VIGUEUR',
        debut: '2023-01-01',
        versionIds: ['LEGIARTI000000000001', 'LEGIARTI000000000002'],
      },
    ])
    const { candidates, stats } = scanNum(ctx)
    expect(candidates).toHaveLength(0)
    expect(stats.groupes_de_numero_multiples_meme_lignee).toBe(1)
  })

  test("« 3° » répété au milieu d'une suite : candidat", () => {
    const d = duplicateMarkers([
      '1° Premier ;',
      '2° Deuxième ;',
      '3° Troisième ;',
      '3° Encore ;',
      '4° Quatrième.',
    ])
    expect(d).toHaveLength(1)
    expect(d[0]?.marker.value).toBe('3°')
  })

  test("marqueur composé « B. 1° » : le « 1° » compte, une suite 1° 2° sous B. n'est pas une répétition", () => {
    expect(duplicateMarkers(['A. Titre', '1° x', '2° y', 'B. 1° z', '2° t', '3° u'])).toHaveLength(0)
    expect(duplicateMarkers(['B. 1° z', '2° t', '3° u', '3° v'])).toHaveLength(1)
  })

  test('marqueurs romains composés « IV.- A.- » (tiret collé) : pas de répétition de « B. »', () => {
    expect(duplicateMarkers(['III. - A.-Un', 'B. - Deux', 'IV.- A.-Trois', 'B.-Quatre'])).toHaveLength(0)
  })

  test('restart légitime, sous-liste, bis, tableau : rien', () => {
    expect(duplicateMarkers(['I. - A', '1° x', '2° y', 'II. - B', '1° z', '2° t'])).toHaveLength(0)
    expect(duplicateMarkers(['1° x', 'a) un', 'b) deux', '2° y', 'a) un', 'b) deux'])).toHaveLength(0)
    expect(duplicateMarkers(['III. - Texte', 'III. bis - Autre'])).toHaveLength(0)
    expect(duplicateMarkers(['1. Désignation', '1. Désignation'])).toHaveLength(0)
    expect(duplicateMarkers(['1° x', '2° y', '2° bis Z', '3° w'])).toHaveLength(0)
  })

  test('F-2026-1118 : le premier c) est dans une citation, le second dans la liste englobante', () => {
    for (const [open, close] of [
      ['"', '"'],
      ['«', '»'],
    ]) {
      const paragraphs = [
        'a) Première adaptation',
        'b) Les alinéas sont ainsi rédigés :',
        `${open} Les dispositions suivantes s’appliquent :`,
        'a) Première disposition',
        'b) Deuxième disposition',
        `c) Dernière disposition ${close} ;`,
        'c) Troisième adaptation',
      ]
      expect(duplicateMarkers(paragraphs)).toEqual([])
      expect(duplicateMarkers([...paragraphs, 'c) Adaptation en double'])).toHaveLength(1)
    }
  })

  test('F-2026-1119 : III et III bis ouvrent des suites distinctes', () => {
    for (const parent of ['III bis.-1. Contrat', 'III. bis - 1. Contrat', 'III. bis.-1. Contrat']) {
      const paragraphs = ['III.-1. Plan', '2. Suite du plan', parent, '2. Suite du contrat']
      expect(duplicateMarkers(paragraphs)).toEqual([])
      expect(duplicateMarkers([...paragraphs, '2. Contrat en double'])).toHaveLength(1)
    }
  })

  test('titres romains suffixés : III et III bis ne sont pas des doublons', () => {
    expect(duplicateMarkers(['II. – Titre', 'III. – Titre', 'III. – bis (Abrogé).'])).toEqual([])
    expect(duplicateMarkers(['II.-Titre', 'III.-Titre', 'III. bis.-Autre titre'])).toEqual([])
  })

  test('annexes écartées', () => {
    const ctx = ctxOf([
      {
        id: 'LEGIARTI000000000001',
        num: 'Annexe I',
        etat: 'VIGUEUR',
        debut: '2020-01-01',
        html: p('1° a', '2° b', '3° c', '3° d'),
      },
    ])
    expect(scanNum(ctx).candidates).toHaveLength(0)
  })
})

describe('syntaxe', () => {
  test('énumérations « a) », « 1) », « i) », « 1°) » : pas de faux positif', () => {
    const { imbalances, exclusions } = checkBalance([
      'a) premier ;',
      'b) second ;',
      '1) un',
      'i) petit',
      '1°) ancien style',
      'a sexies-0) numéroté',
      'II.-a) après un tiret',
    ])
    expect(imbalances).toEqual([])
    expect(exclusions.enumeration_closers).toBe(7)
  })

  test('parenthèse non fermée, non ouverte', () => {
    expect(checkBalance(['Le montant (hors taxes est fixé.']).imbalances.map((i) => i.subtype)).toEqual([
      'parenthese_non_fermee',
    ])
    expect(checkBalance(['Le montant hors taxes) est fixé.']).imbalances.map((i) => i.subtype)).toEqual([
      'parenthese_non_ouverte',
    ])
    expect(checkBalance(['Un crochet [ ouvert']).imbalances.map((i) => i.subtype)).toEqual([
      'crochet_non_ferme',
    ])
  })

  test('citation sur plusieurs alinéas : « à chaque début, » à la fin seulement', () => {
    const r = checkBalance([
      'Il est ajouté : « Art. 1er. - Premier alinéa',
      '« Deuxième alinéa',
      '« Dernier alinéa. »',
    ])
    expect(r.imbalances).toEqual([])
    expect(r.exclusions.continued_quotes).toBe(2)
  })

  test('citation à guillemets droits sur plusieurs alinéas (chaque alinéa rouvre ") : pas de défaut', () => {
    const r = checkBalance(['Il est ajouté :', '" a) Premier', '" b) Suite', '" c) Fin. "'])
    expect(r.imbalances).toEqual([])
    expect(r.exclusions.continued_quotes).toBe(2)
  })

  test('citation à guillemets droits jamais refermée : signalée à l’alinéa qui l’ouvre', () => {
    const r = checkBalance(['Intro.', '" Premier alinéa', '" Deuxième alinéa'])
    expect(r.imbalances.map((i) => i.subtype)).toEqual(['guillemet_droit_non_apparie'])
    expect(r.imbalances[0]?.locations[0]?.paragraph).toBe(2)
  })

  test('guillemets français non fermés ; guillemet droit non apparié', () => {
    expect(checkBalance(['Les mots « abc sont remplacés']).imbalances.map((i) => i.subtype)).toEqual([
      'guillemet_non_ferme',
    ])
    expect(checkBalance(['Les mots " abc sont remplacés']).imbalances.map((i) => i.subtype)).toEqual([
      'guillemet_droit_non_apparie',
    ])
    expect(checkBalance(['Les mots " abc " sont remplacés']).imbalances).toEqual([])
  })

  test('détecteur : un candidat par article et sous-type, alinéa localisé', () => {
    const ctx = ctxOf([
      {
        id: 'LEGIARTI000000000001',
        num: 'L100-1',
        etat: 'VIGUEUR',
        debut: '2020-01-01',
        html: p('Premier alinéa.', 'Le montant (hors taxes est fixé.'),
      },
    ])
    const { candidates } = scanSyntaxe(ctx)
    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.type).toBe('SYNTAXE')
    expect(
      proofOf<{ defect: { locations: Array<{ paragraph: number }> } }>(candidates[0]).defect.locations[0]
        ?.paragraph,
    ).toBe(2)
  })
})
