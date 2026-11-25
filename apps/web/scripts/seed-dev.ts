/**
 * Données FICTIVES de développement pour le site web — base `bugdeloi_webdev` uniquement.
 *
 * Usage : bun run --filter @bugdeloi/web seed:dev   (ou : cd apps/web && bun scripts/seed-dev.ts)
 *
 * - Refuse de tourner sur une base dont le nom ne se termine pas par `_webdev` (jamais `bugdeloi`).
 * - Vide toutes les tables puis insère un petit arbre réaliste (~200 versions d'articles), des
 *   niveaux variés, des liens, des rejeux, de la couverture et des événements.
 * - Tout est marqué fictif : `ingest_run.source = 'FICTIF-DEV'` (le site affiche alors un bandeau),
 *   identifiants LEGIARTI/LEGISCTA préfixés 9999, textes commençant par « [Texte fictif] ».
 * - Déterministe (générateur pseudo-aléatoire à graine fixe).
 */
import { CODES, normalizeLegalText, sha256Hex } from '@bugdeloi/core/legi'
import { createDb } from '@bugdeloi/db'
import {
  articleStatus,
  event,
  finding,
  ingestRun,
  legalArticle,
  legalLink,
  legalSection,
  legalText,
  referenceCoverage,
  replicationRun,
} from '@bugdeloi/db/schema'
import { sql } from 'drizzle-orm'

const URL_DEFAULT = 'postgres://ubuntu@localhost:5432/bugdeloi_webdev?host=/var/run/postgresql'
const url = process.env.SEED_DATABASE_URL ?? URL_DEFAULT
const { db, sql: client } = createDb(url)

const FICTIONAL_SOURCE = 'FICTIF-DEV'

// Générateur pseudo-aléatoire déterministe (mulberry32).
let seed = 0x5eed
function rand(): number {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

let artSeq = 0
let sctSeq = 0
const artId = () => `LEGIARTI9999${String(++artSeq).padStart(8, '0')}`
const sctId = () => `LEGISCTA9999${String(++sctSeq).padStart(8, '0')}`

interface SectionSpec {
  title: string
  /** Numéros d'articles rattachés directement à la section. */
  articles?: string[]
  children?: SectionSpec[]
}

const range = (prefix: string, from: number, to: number, suffix = '') =>
  Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}${suffix}`)

const CGI_TREE: SectionSpec[] = [
  {
    title: 'Livre premier : Assiette et liquidation de l’impôt',
    children: [
      {
        title: 'Première partie : Impôts d’État',
        children: [
          {
            title: 'Titre premier : Impôts directs et taxes assimilées',
            children: [
              {
                title: 'Chapitre premier : Impôt sur le revenu',
                children: [
                  {
                    title: 'Section I : Personnes imposables',
                    articles: ['4 A', '4 B', '4 bis', '5', '6', '7', '8'],
                  },
                  {
                    title: 'Section II : Revenus imposables',
                    articles: ['12', '13'],
                    children: [
                      { title: 'I : Bénéfices industriels et commerciaux', articles: range('', 34, 52) },
                      { title: 'II : Bénéfices non commerciaux', articles: range('', 92, 103) },
                      { title: 'III : Traitements et salaires', articles: range('', 79, 91) },
                    ],
                  },
                  {
                    title: 'Section V : Calcul de l’impôt',
                    children: [
                      {
                        title: 'I : Quotient familial',
                        articles: ['193', '193 bis', '194', '195', '196', '196 A bis'],
                      },
                      { title: 'II : Barème', articles: ['197', '197 A', '197 C'] },
                      {
                        title: 'III : Réductions et crédits d’impôt',
                        articles: [
                          '199 quater C',
                          '199 sexdecies',
                          '199 undecies A',
                          '199 undecies B',
                          '200',
                          '200 A',
                          '200 quater',
                          '200 sexies',
                        ],
                      },
                    ],
                  },
                ],
              },
              { title: 'Chapitre II : Impôt sur les bénéfices des sociétés', articles: range('', 205, 223) },
            ],
          },
          { title: 'Titre II : Taxes sur le chiffre d’affaires', articles: range('', 256, 283) },
        ],
      },
      {
        title: 'Deuxième partie : Impositions perçues au profit des collectivités locales',
        articles: range('', 1379, 1398),
      },
    ],
  },
  { title: 'Livre deuxième : Recouvrement de l’impôt', articles: range('', 1658, 1679) },
]

const CSS_TREE: SectionSpec[] = [
  {
    title: 'Livre 5 : Prestations familiales et prestations assimilées',
    children: [
      {
        title: 'Titre 1 : Champ d’application – Généralités',
        articles: range('L511-', 1, 1).concat(range('L512-', 1, 6)),
      },
      {
        title: 'Titre 2 : Prestations générales d’entretien',
        articles: range('L521-', 1, 3).concat(range('L522-', 1, 3)),
      },
      { title: 'Titre 3 : Prestation d’accueil du jeune enfant', articles: range('L531-', 1, 10) },
    ],
  },
]

interface ArticleRow {
  id: string
  textId: string
  sectionId: string
  num: string
  position: number
}

const sections: (typeof legalSection.$inferInsert)[] = []
const articles: ArticleRow[] = []

function walk(textId: string, specs: SectionSpec[], parentId: string | null, parentPath: string) {
  specs.forEach((spec, i) => {
    const id = sctId()
    const path = `${parentPath}.${id}`
    sections.push({
      id,
      textId,
      parentId,
      path,
      depth: path.split('.').length - 1,
      position: i + 1,
      title: spec.title,
      etat: 'VIGUEUR',
      dateDebut: '2026-01-01',
      dateFin: '2999-01-01',
    })
    spec.articles?.forEach((num, j) => {
      articles.push({ id: artId(), textId, sectionId: id, num: num.trim(), position: j + 1 })
    })
    if (spec.children) walk(textId, spec.children, id, path)
  })
}

const cgi = CODES.CGI.id
const css = CODES.CSS.id
walk(cgi, CGI_TREE, null, cgi)
walk(css, CSS_TREE, null, css)

function fictionalHtml(num: string, code: string): string {
  const amount = Math.round(rand() * 90 + 10) * 100
  const rate = Math.round(rand() * 40 + 5)
  return [
    `<p>[Texte fictif de démonstration — ne décrit pas la loi.] Article ${num} du ${code}.</p>`,
    `<p>I. – Le montant mentionné au présent article est fixé à ${amount.toLocaleString('fr-FR')} € pour l’année de référence.</p>`,
    `<p>II. – Ce montant est réduit de ${rate} % lorsque les conditions prévues au I sont remplies.<br/>Les modalités d’application sont précisées par décret.</p>`,
    rand() < 0.15
      ? '<table><tr><th>Tranche</th><th>Taux</th></tr><tr><td>Jusqu’à 10 000 €</td><td>0 %</td></tr><tr><td>Au-delà</td><td>11 %</td></tr></table>'
      : '',
    rand() < 0.05
      ? '<p onclick="alert(1)">Paragraphe avec attribut à retirer.<script>alert("xss")</script></p>'
      : '',
  ].join('')
}

const now = new Date()
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000)

async function main() {
  const [{ name }] = (await client`select current_database() as name`) as unknown as [{ name: string }]
  if (!name.endsWith('_webdev')) {
    console.error(
      `Refus : la base « ${name} » n'est pas une base de développement web (suffixe _webdev attendu).`,
    )
    process.exit(2)
  }

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`truncate table ${finding}, ${event}, ${legalLink}, ${articleStatus}, ${referenceCoverage}, ${legalArticle}, ${legalSection}, ${legalText}, ${ingestRun}, ${replicationRun} restart identity cascade`,
    )

    const [run] = await tx
      .insert(ingestRun)
      .values({
        source: FICTIONAL_SOURCE,
        archive: 'donnees-fictives-seed-dev (aucune archive DILA)',
        scope: [cgi, css],
        startedAt: ago(95),
        finishedAt: ago(93),
        status: 'success',
        stats: {},
      })
      .returning({ id: ingestRun.id })

    await tx.insert(legalText).values([
      {
        id: cgi,
        title: 'Code général des impôts (données fictives)',
        shortTitle: 'CGI',
        nature: 'CODE',
        etat: 'VIGUEUR',
      },
      {
        id: css,
        title: 'Code de la sécurité sociale (données fictives)',
        shortTitle: 'CSS',
        nature: 'CODE',
        etat: 'VIGUEUR',
      },
    ])
    await tx.insert(legalSection).values(sections.map((s) => ({ ...s, lastRunId: run?.id })))

    // Versions : ~1 article sur 6 a une version antérieure (MODIFIE) en plus de la version en vigueur.
    const rows: (typeof legalArticle.$inferInsert)[] = []
    for (const a of articles) {
      const code = a.textId === cgi ? 'CGI' : 'CSS'
      const current = fictionalHtml(a.num, code)
      const versionIds = [a.id]
      if (rand() < 0.17) {
        const oldId = artId()
        versionIds.push(oldId)
        const oldHtml = fictionalHtml(a.num, code)
        rows.push({
          id: oldId,
          textId: a.textId,
          sectionId: a.sectionId,
          num: a.num,
          articleKey: `${a.textId}:${a.num}`,
          etat: 'MODIFIE',
          type: 'AUTONOME',
          dateDebut: '2019-01-01',
          dateFin: '2025-12-31',
          position: a.position,
          contentHtml: oldHtml,
          contentText: normalizeLegalText(oldHtml),
          textSha256: sha256Hex(normalizeLegalText(oldHtml)),
          versionIds: [],
          lastRunId: run?.id,
        })
      }
      rows.push({
        id: a.id,
        textId: a.textId,
        sectionId: a.sectionId,
        num: a.num,
        articleKey: `${a.textId}:${a.num}`,
        etat: 'VIGUEUR',
        type: 'AUTONOME',
        dateDebut: '2026-01-01',
        dateFin: '2999-01-01',
        position: a.position,
        contentHtml: current,
        contentText: normalizeLegalText(current),
        textSha256: sha256Hex(normalizeLegalText(current)),
        notaHtml:
          rand() < 0.1
            ? '<p>[Nota fictif] Ces dispositions s’appliquent aux impositions établies à compter de 2026.</p>'
            : null,
        versionIds,
        lastRunId: run?.id,
      })
    }
    // Les versions anciennes connaissent aussi la liste complète.
    for (const r of rows) {
      if (r.etat === 'MODIFIE')
        r.versionIds = rows.find((x) => x.etat === 'VIGUEUR' && x.versionIds?.includes(r.id))?.versionIds ?? [
          r.id,
        ]
    }
    await tx.insert(legalArticle).values(rows)

    // Niveaux : la plupart restent N0 ; quelques-uns montent, ★ sur le quotient familial (couvert par Inria).
    const byNum = (num: string) => articles.find((a) => a.num === num && a.textId === cgi) as ArticleRow
    const statuses: (typeof articleStatus.$inferInsert)[] = []
    const set = (a: ArticleRow, level: string, flags: string[] = []) =>
      statuses.push({
        articleId: a.id,
        level,
        flags,
        evidence: { fictif: true },
        updatedAt: ago(Math.round(rand() * 60)),
      })
    for (const n of ['193', '193 bis', '194', '195', '196']) set(byNum(n), 'REF')
    set(byNum('197'), 'N4')
    for (const n of ['197 A', '197 C', '196 A bis']) set(byNum(n), 'N3')
    for (const n of ['4 A', '4 B', '5', '6']) set(byNum(n), 'N2')
    set(byNum('7'), 'N2', ['contested'])
    for (const n of range('', 79, 86)) set(byNum(n), 'N1')
    for (const a of articles.filter((x) => x.textId === css).slice(0, 4)) set(a, 'N1')
    await tx.insert(articleStatus).values(statuses)

    // Liens LEGI : citations internes, une citation vers une cible absente, une modification par une loi.
    const links: (typeof legalLink.$inferInsert)[] = []
    const cgiArticles = articles.filter((a) => a.textId === cgi)
    for (let i = 0; i < 60; i++) {
      const src = cgiArticles[Math.floor(rand() * cgiArticles.length)] as ArticleRow
      const dst = cgiArticles[Math.floor(rand() * cgiArticles.length)] as ArticleRow
      if (src.id === dst.id) continue
      links.push({
        articleId: src.id,
        typeLien: 'CITATION',
        sens: 'source',
        targetId: dst.id,
        targetCid: cgi,
        targetNum: dst.num,
        targetNature: 'CODE',
        label: `Code général des impôts, CGI. - art. ${dst.num} (fictif)`,
      })
    }
    links.push(
      {
        articleId: byNum('197').id,
        typeLien: 'CITATION',
        sens: 'source',
        targetId: 'LEGIARTI999999999999',
        targetNum: '196 B',
        targetNature: 'CODE',
        label: 'Code général des impôts, CGI. - art. 196 B (cible fictive absente de la base)',
      },
      {
        articleId: byNum('197').id,
        typeLien: 'MODIFIE',
        sens: 'cible',
        targetId: 'JORFTEXT999900000001',
        targetTextNum: '2025-0000',
        targetNature: 'LOI',
        targetDate: '2025-12-30',
        label: 'LOI n° 2025-0000 du 30 décembre 2025 de finances pour 2026 (fictive)',
      },
    )
    await tx.insert(legalLink).values(links)

    await tx.insert(referenceCoverage).values([
      ...['193', '193 bis', '194', '195', '196', '197'].map((n, i) => ({
        source: 'inria/catala-examples',
        sourceCommit: '0000000000000000000000000000000000fictif',
        legiarti: byNum(n).id,
        file: 'impot_revenu/fictif.catala_fr',
        line: 10 + i * 40,
        heading: `Article ${n} (fictif)`,
      })),
      {
        source: 'inria/catala-examples',
        sourceCommit: '0000000000000000000000000000000000fictif',
        legiarti: 'LEGIARTI999988887777',
        file: 'allocations_familiales/fictif.catala_fr',
        line: 1,
        heading: 'Version absente de la base (fictif)',
      },
    ])

    await tx.insert(replicationRun).values([
      {
        kind: 'C0.1-inria-replay',
        subject: 'catala-examples@fictif/impot_revenu',
        catalaVersion: '1.3.2',
        imageDigest: 'sha256:fictif',
        startedAt: ago(70),
        finishedAt: ago(66),
        status: 'passed',
        summary: { fictif: true, tests: 42, passed: 42 },
      },
      {
        kind: 'C0.1-inria-replay',
        subject: 'catala-examples@fictif/aides_logement',
        catalaVersion: '1.3.2',
        imageDigest: 'sha256:fictif',
        startedAt: ago(60),
        finishedAt: ago(52),
        status: 'failed',
        summary: { fictif: true, tests: 120, passed: 117 },
      },
    ])

    await tx.insert(finding).values({
      id: 'F-2026-9999',
      type: 'REF_MORTE',
      status: 'candidate',
      claim: '[Fictif] Candidat non qualifié : ne doit apparaître dans aucun compteur public.',
      legalUnits: [byNum('197').id],
      certificate: { fictif: true },
      detector: 'seed-dev@0',
    })

    await tx.insert(event).values([
      {
        ts: ago(95),
        type: 'ingest.started',
        actor: 'system:seed-dev',
        payload: { summary: 'Données fictives de développement.' },
      },
      {
        ts: ago(93),
        type: 'ingest.finished',
        actor: 'system:seed-dev',
        subject: String(run?.id ?? ''),
        payload: { summary: `${rows.length} versions d’articles fictives chargées.` },
      },
      {
        ts: ago(70),
        type: 'replication.started',
        actor: 'system:seed-dev',
        subject: 'catala-examples@fictif/impot_revenu',
        payload: {},
      },
      {
        ts: ago(66),
        type: 'replication.passed',
        actor: 'system:seed-dev',
        subject: 'catala-examples@fictif/impot_revenu',
        payload: { summary: '42 tests sur 42 (fictif).' },
      },
      {
        ts: ago(52),
        type: 'replication.failed',
        actor: 'system:seed-dev',
        subject: 'catala-examples@fictif/aides_logement',
        payload: { summary: '117 tests sur 120 (fictif).' },
      },
      {
        ts: ago(40),
        type: 'coverage.recorded',
        actor: 'system:seed-dev',
        payload: { summary: '7 identifiants cités (fictif).' },
      },
      {
        ts: ago(30),
        type: 'finding.candidate',
        actor: 'system:seed-dev',
        subject: 'F-2026-9999',
        payload: { summary: 'Ne doit pas apparaître publiquement.' },
      },
      {
        ts: ago(20),
        type: 'level.changed',
        actor: 'github:exemple-fictif',
        subject: byNum('197').id,
        payload: { summary: 'N3 → N4 (fictif).' },
      },
      {
        ts: ago(10),
        type: 'level.changed',
        actor: 'github:exemple-fictif',
        subject: byNum('7').id,
        payload: { summary: 'Objection ouverte : niveau gelé (fictif).' },
      },
    ])
  })

  const [counts] = (await client`select
      (select count(*) from legal_section)::int as sections,
      (select count(*) from legal_article)::int as versions,
      (select count(*) from legal_article where etat = 'VIGUEUR')::int as en_vigueur,
      (select count(*) from event)::int as events`) as unknown as [Record<string, number>]
  console.log(`seed-dev : base ${name} remplie (données FICTIVES)`, counts)
}

try {
  await main()
} finally {
  await client.end()
}
