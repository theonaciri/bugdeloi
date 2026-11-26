import { expect, test } from 'bun:test'
import { createWriteStream } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'
import { CODES, legalTextHash } from '@bugdeloi/core'
import { schema } from '@bugdeloi/db'
import { and, eq, inArray } from 'drizzle-orm'
import { pack } from 'tar-stream'
import {
  archiveFromName,
  type CodeFiles,
  documentPath,
  isDeleted,
  readArchive,
  stagedArticles,
} from './archive.ts'
import { applyCode, withIngestDatabase } from './database.ts'
import { projectTree } from './project.ts'
import { parseArticle } from './xml.ts'

const current = 'LEGIARTI999990000002'
const previous = 'LEGIARTI999990000001'
const rootArticle = 'LEGIARTI999990000004'
const parent = 'LEGISCTA999990000001'
const empty = 'LEGISCTA999990000002'
const textId = CODES.CGI.id
const target = `legi/global/code_et_TNC_en_vigueur/code_en_vigueur/LEGI/TEXT/00/00/06/06/95/${textId}`
const globalName = 'Freemium_legi_global_20240101-140000.tar.gz'
const incrementName = 'LEGI_20240102-210000.tar.gz'

const fixture = (name: string) => Bun.file(new URL(`./fixtures/${name}.xml`, import.meta.url)).text()

async function writeArchive(path: string, members: [string, string][]) {
  const tar = pack()
  const done = pipeline(tar, createGzip(), createWriteStream(path))
  for (const [name, data] of members) {
    await new Promise<void>((resolve, reject) => {
      tar.entry({ name }, data, (error) => (error ? reject(error) : resolve()))
    })
  }
  tar.finalize()
  await done
}

async function globalFixture(path: string) {
  const template = await fixture('article')
  const old = template
    .replace(`<ID>${current}</ID>`, `<ID>${previous}</ID>`)
    .replace('<ETAT>VIGUEUR</ETAT>', '<ETAT>MODIFIE</ETAT>')
    .replace('<DATE_DEBUT>2024-01-01</DATE_DEBUT>', '<DATE_DEBUT>2020-01-01</DATE_DEBUT>')
    .replace('<DATE_FIN>2999-01-01</DATE_FIN>', '<DATE_FIN>2024-01-01</DATE_FIN>')
  const root = template
    .replace(`<ID>${current}</ID>`, `<ID>${rootArticle}</ID>`)
    .replace('<NUM>42 A</NUM>', '<NUM/>')
    .replace('<DATE_DEBUT>2024-01-01</DATE_DEBUT>', '<DATE_DEBUT>2020-01-01</DATE_DEBUT>')
  await writeArchive(path, [
    ['20240101-140000/ignoré.xml', 'hors du périmètre'],
    [`20240101-140000/${target}/${documentPath(textId, 'text')}.xml`, await fixture('text')],
    [`20240101-140000/${target}/${documentPath(textId, 'structure')}.xml`, await fixture('structure')],
    [`20240101-140000/${target}/${documentPath(parent, 'structure')}.xml`, await fixture('section')],
    [
      `20240101-140000/${target}/${documentPath(empty, 'structure')}.xml`,
      `<SECTION_TA><ID>${empty}</ID><TITRE_TA>Section vide</TITRE_TA></SECTION_TA>`,
    ],
    [`20240101-140000/${target}/${documentPath(previous, 'article')}.xml`, old],
    [`20240101-140000/${target}/${documentPath(current, 'article')}.xml`, template],
    [`20240101-140000/${target}/${documentPath(rootArticle, 'article')}.xml`, root],
  ])
}

async function incrementFixture(path: string) {
  const template = await fixture('article')
  await writeArchive(path, [
    [
      '20240102-210000/liste_suppression_legi.dat',
      `${target}/${documentPath(rootArticle, 'article')}\n${target}/${documentPath(current, 'article')}\n`,
    ],
    [
      '20240102-210000/liste_suppression_legi_dossier.dat',
      `${target}/section_ta/LEGI/SCTA/99/99/90/00/00 D\n`,
    ],
    [
      `20240102-210000/${target}/${documentPath(textId, 'structure')}.xml`,
      `<TEXTELR><META><META_COMMUN><ID>${textId}</ID></META_COMMUN></META><STRUCT/></TEXTELR>`,
    ],
    [
      `20240102-210000/${target}/${documentPath(current, 'article')}.xml`,
      template.replace(/<LIENS>[\s\S]+?<\/LIENS>/, '<LIENS/>'),
    ],
  ])
}

test('XML LEGI : contenu brut, versions, normalisation et attributs des liens', async () => {
  const xml = (await fixture('article')).replace(
    '<VERSIONS>',
    '<VERSIONS><VERSION etat="INITIALE"><LIEN_ART id="JORFARTI999990000001"/></VERSION>',
  )
  const { article, links } = parseArticle(xml, current, textId)
  expect(article).toMatchObject({
    id: current,
    articleKey: `${textId}:42 A`,
    dateFin: '2999-01-01',
    contentHtml: '<p class="test">Texte d’essai&#160;&amp; suite</p><p>Fin<br/></p>',
    contentText: "Texte d'essai & suite Fin",
    notaHtml: '<i>Note de la version</i>',
    versionIds: [previous, current],
  })
  expect(article.textSha256).toBe(legalTextHash(article.contentHtml ?? ''))
  expect(links).toEqual([
    {
      articleId: current,
      typeLien: 'CITATION',
      sens: 'source',
      targetId: 'LEGIARTI999990000003',
      targetCid: 'LEGITEXT999990000009',
      targetNum: '3',
      targetTextNum: '2023-123',
      targetNature: 'LOI',
      targetNor: 'TEST1234567L',
      targetDate: '2023-12-30',
      label: 'Loi & exemple',
    },
    {
      articleId: current,
      typeLien: 'MODIFIE',
      sens: 'cible',
      targetId: null,
      targetCid: null,
      targetNum: null,
      targetTextNum: null,
      targetNature: null,
      targetNor: null,
      targetDate: null,
      label: null,
    },
  ])
  expect(() => parseArticle('<ARTICLE></TEXTE_VERSION>', current, textId)).toThrow()
})

test('tar en flux : périmètre, sections imbriquées et suppressions DILA', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bugdeloi-legi-test-'))
  try {
    const path = join(dir, globalName)
    await globalFixture(path)
    const [files] = (await readArchive(path, ['CGI'], () => {}, dir)).values()
    expect(files?.articles.size).toBe(3)
    if (!files) throw new Error('Stock attendu')
    const tree = projectTree(textId, files.structures, new Set(files.articles.keys()), '2024-01-01')
    expect(tree.sections.get(empty)).toMatchObject({
      path: `${textId}.${parent}.${empty}`,
      depth: 2,
      parentId: parent,
      position: 2,
    })
    expect(tree.placements.get(current)).toEqual({ id: current, sectionId: parent, position: 1 })
    expect(tree.placements.get(rootArticle)).toEqual({ id: rootArticle, sectionId: null, position: 1 })
    expect(tree.placements.has(previous)).toBe(false)
    expect(tree.duplicatePlacements).toBe(1)
    // Une version dont les métadonnées propres la disent hors vigueur (ex. MODIFIE à fin ouverte,
    // cas CSS R611-2) n'est pas placée, même si le lien de sa section la dit en vigueur.
    const stale = new Map([[current, { etat: 'MODIFIE', dateDebut: '2020-01-01', dateFin: '2999-01-01' }]])
    const strict = projectTree(textId, files.structures, new Set(files.articles.keys()), '2024-01-01', stale)
    expect(strict.placements.has(current)).toBe(false)
    expect(strict.placements.get(rootArticle)).toEqual({ id: rootArticle, sectionId: null, position: 1 })
    const entries = await Array.fromAsync(stagedArticles(files.articleFile))
    expect(entries.find(({ article }) => article.id === rootArticle)?.article.articleKey).toBeNull()

    const deltaPath = join(dir, incrementName)
    await incrementFixture(deltaPath)
    const [delta] = (await readArchive(deltaPath, ['CGI'], () => {})).values()
    if (!delta) throw new Error('Incrément attendu')
    expect(isDeleted(delta, documentPath(rootArticle, 'article'))).toBe(true)
    expect(isDeleted(delta, documentPath(parent, 'structure'))).toBe(true)
    expect(isDeleted(delta, documentPath(textId, 'structure'))).toBe(false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

const { legalArticle, legalLink, legalSection, articleStatus, legiState, legiStructure, legalText } = schema
const TEST_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://ubuntu@localhost:5432/bugdeloi_test?host=/var/run/postgresql'
const testTextId = 'LEGITEXT999990000001'

async function rekey(files: CodeFiles, articleFile: string): Promise<CodeFiles> {
  const root = files.structures.get(textId)
  if (!root) throw new Error('Fixture de structure incomplète')
  files.structures.delete(textId)
  files.structures.set(testTextId, { ...root, id: testTextId })
  if (files.text) files.text = { ...files.text, id: testTextId }
  const articles = await Array.fromAsync(stagedArticles(files.articleFile))
  for (const { article } of articles) {
    article.textId = testTextId
    article.articleKey = article.num ? `${testTextId}:${article.num}` : null
  }
  await writeFile(articleFile, articles.map((item) => JSON.stringify(item)).join('\n'))
  return { ...files, articleFile }
}

test('Postgres : reprise idempotente, projection historique et incrément avec retrait', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bugdeloi-legi-db-test-'))
  try {
    const path = join(dir, globalName)
    await globalFixture(path)
    const [global] = (await readArchive(path, ['CGI'], () => {}, dir)).values()
    if (!global) throw new Error('Stock attendu')
    const files = await rekey(global, join(dir, 'global.jsonl'))
    const deltaPath = join(dir, incrementName)
    const stageDelta = await mkdtemp(join(dir, 'delta-'))
    await incrementFixture(deltaPath)
    const [increment] = (await readArchive(deltaPath, ['CGI'], () => {}, stageDelta)).values()
    if (!increment) throw new Error('Incrément attendu')
    const delta = await rekey(increment, join(dir, 'increment.jsonl'))

    await withIngestDatabase(async (db) => {
      const input = { archive: archiveFromName(globalName), asOf: '2024-01-01', sha256: 'fixture-stock' }
      const existing = await db.select().from(legalText).where(eq(legalText.id, testTextId))
      if (existing.length) throw new Error('Identifiant LEGI de test déjà occupé')
      const levels = () =>
        db
          .select()
          .from(articleStatus)
          .where(inArray(articleStatus.articleId, [previous, current, rootArticle]))
      const links = () =>
        db
          .select()
          .from(legalLink)
          .where(inArray(legalLink.articleId, [previous, current, rootArticle]))
      try {
        const initial = await applyCode(db, testTextId, files, input, 4100)
        expect(initial).toMatchObject({ versions: 3, active: 2, sections: 2, depth: 2, rootArticles: 1 })
        expect((await levels()).map(({ level }) => level)).toEqual(['N0', 'N0', 'N0'])
        const originalLinks = await links()
        expect(originalLinks).toHaveLength(6)
        await db.update(articleStatus).set({ level: 'N3' }).where(eq(articleStatus.articleId, current))
        expect(await applyCode(db, testTextId, files, input, 4101)).toEqual(initial)
        expect(await links()).toEqual(originalLinks)
        await applyCode(db, testTextId, files, { ...input, asOf: '2023-12-31' }, 4102)
        const [oldPlacement] = await db.select().from(legalArticle).where(eq(legalArticle.id, previous))
        expect(oldPlacement).toMatchObject({ sectionId: parent, position: 1 })
        const [newPlacement] = await db.select().from(legalArticle).where(eq(legalArticle.id, current))
        expect(newPlacement).toMatchObject({ sectionId: null, position: 0 })

        const next = { ...input, archive: archiveFromName(incrementName), sha256: 'fixture-increment' }
        await applyCode(db, testTextId, delta, next, 4103)
        expect(await links()).toHaveLength(2)
        expect(await db.select().from(legalSection).where(eq(legalSection.textId, testTextId))).toEqual([])
        const [state] = await db.select().from(legiState).where(eq(legiState.textId, testTextId))
        expect(state).toMatchObject({ archive: incrementName, asOf: input.asOf })
        expect((await levels()).find(({ articleId }) => articleId === current)?.level).toBe('N3')
        expect((await levels()).some(({ articleId }) => articleId === rootArticle)).toBe(false)
        const [updated] = await db
          .select()
          .from(legalArticle)
          .where(and(eq(legalArticle.textId, testTextId), eq(legalArticle.id, current)))
        expect(updated).toMatchObject({ sectionId: null, lastRunId: 4103 })
      } finally {
        await db.delete(legalSection).where(eq(legalSection.textId, testTextId))
        await db.delete(legalArticle).where(eq(legalArticle.textId, testTextId))
        await db.delete(legiStructure).where(eq(legiStructure.textId, testTextId))
        await db.delete(legiState).where(eq(legiState.textId, testTextId))
        await db.delete(legalText).where(eq(legalText.id, testTextId))
      }
    }, TEST_URL)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}, 15_000)
