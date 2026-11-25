import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { isInForce, legalTextHash, normalizeLegalText } from '@bugdeloi/core/legi'
import { createDb, legalArticle, legalLink } from '@bugdeloi/db'
import { and, eq, inArray, or } from 'drizzle-orm'
import { parseArticle } from '../../packages/ingest/src/xml.ts'
import { articleHeadings } from '../c0.1/coverage.ts'
import { withSource } from '../c0.1/source.ts'
import { sourceFolder } from './adapter.ts'
import { task } from './check.ts'

const stock = 'Freemium_legi_global_20261108-140000.tar.gz'
const stockUrl = `https://echanges.dila.gouv.fr/OPENDATA/LEGI/${stock}`
const css = 'LEGITEXT000006073189'

const stockArticles = {
  LEGIARTI000038901859: 'LEGITEXT000006071191', // Code de l'éducation, L131-1
  LEGIARTI000006524422: 'LEGITEXT000006071191', // Version antérieure à la rentrée 2019
  LEGIARTI000036330048: 'JORFTEXT000000227447', // Décret Mayotte, article 7
  LEGIARTI000036326574: 'JORFTEXT000000227447', // Décret Mayotte, annexe
  LEGIARTI000034109930: 'JORFTEXT000000409831', // Ordonnance Mayotte, article 7
} as const

type Article = ReturnType<typeof parseArticle>['article']

async function coverage() {
  return withSource(async (source) => {
    const directory = join(source, sourceFolder)
    const ids = new Set<string>()
    const dates = new Set<string>()
    for await (const path of new Bun.Glob('**/*.catala_fr').scan(directory)) {
      const content = await Bun.file(join(directory, path)).text()
      for (const heading of articleHeadings(content)) {
        if (heading.formalized) ids.add(heading.legiarti)
      }
      if (path.startsWith('tests/')) {
        for (const [, date] of content.matchAll(
          /définition f\.(?:i_)?date_courante égal à \|(\d{4}-\d\d-\d\d)\|/g,
        )) {
          if (date) dates.add(date)
        }
      }
    }
    if (!ids.size || !dates.size) throw new Error('Aucun article ou date de calcul dans la suite.')
    return { ids: [...ids].sort(), dates: [...dates].sort() }
  })
}

async function databaseArticles(ids: string[], testDates: string[]) {
  const { db, sql } = createDb()
  try {
    return await db.transaction(
      async (tx) => {
        const external = new Set<string>(Object.keys(stockArticles))
        const directIds = ids.filter((id) => !external.has(id))
        const primary = await tx.select().from(legalArticle).where(inArray(legalArticle.id, directIds))
        if (primary.length !== directIds.length)
          throw new Error('Un article de référence manque dans Postgres.')

        const active = (article: Article) => testDates.some((date) => isInForce(article, date))
        const keys = primary.flatMap((article) => article.articleKey ?? [])
        const historical = (
          await tx.select().from(legalArticle).where(inArray(legalArticle.articleKey, keys))
        ).filter(active)
        // Renvois à des articles omis de certains blocs LIENS, et articles de contexte du CSS.
        const supplemental = [
          'L161-25',
          'L511-1',
          'L512-1',
          'L512-2',
          'L551-1',
          'L755-3',
          'L755-11',
          'R521-2',
          'R532-1',
          'R532-2',
          'R532-3',
          'R532-4',
          'R532-5',
          'R532-6',
          'R532-7',
        ]
        const anchors = [...new Set([...primary, ...historical].map((article) => article.id))]
        const links = await tx
          .select()
          .from(legalLink)
          .where(
            and(
              inArray(legalLink.articleId, anchors),
              eq(legalLink.typeLien, 'CITATION'),
              eq(legalLink.sens, 'source'),
            ),
          )
        const exactTargets = links.flatMap((link) =>
          link.targetId?.startsWith('LEGIARTI') ? [link.targetId] : [],
        )
        const targetKeys = links.flatMap((link) =>
          link.targetCid && link.targetNum ? [`${link.targetCid}:${link.targetNum}`] : [],
        )
        const references = (
          await tx
            .select()
            .from(legalArticle)
            .where(
              or(
                inArray(legalArticle.id, exactTargets),
                inArray(legalArticle.articleKey, targetKeys),
                and(eq(legalArticle.textId, css), inArray(legalArticle.num, supplemental)),
              ),
            )
        ).filter(active)
        const found = new Set(
          [...primary, ...historical, ...references].flatMap((article) => [article.id, article.articleKey]),
        )
        const unresolved = links
          .filter(
            (link) =>
              !external.has(link.targetId ?? '') &&
              !found.has(link.targetId) &&
              !found.has(`${link.targetCid}:${link.targetNum}`),
          )
          .map(({ articleId, targetId, targetCid, targetNum, label }) => ({
            articleId,
            targetId,
            targetCid,
            targetNum,
            label,
          }))
        return {
          articles: [
            ...new Map(
              [...primary, ...historical, ...references].map((article) => [article.id, article]),
            ).values(),
          ],
          unresolved,
        }
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    )
  } finally {
    await sql.end()
  }
}

function serialize(article: Article, primary: boolean, source: string) {
  const formatted = article.contentHtml
    ?.replace(/<br\s*\/?>|<\/p>/gi, '\n')
    .split('\n')
    .map(normalizeLegalText)
    .filter(Boolean)
    .join('\n')
  const text = formatted && legalTextHash(formatted) === article.textSha256 ? formatted : article.contentText
  if (!text || legalTextHash(text) !== article.textSha256)
    throw new Error(`Empreinte incohérente : ${article.id}.`)
  return {
    legiarti: article.id,
    code: article.textId,
    article: article.num,
    début: article.dateDebut,
    fin_exclue: article.dateFin,
    périmètre_initial: primary,
    source,
    sha256_normalisé: article.textSha256,
    texte: text,
    ...(article.notaHtml ? { nota: normalizeLegalText(article.notaHtml) } : {}),
    ...(article.contentHtml && /<table[\s>]/i.test(article.contentHtml)
      ? { tableau_html_dila: article.contentHtml }
      : {}),
  }
}

if (import.meta.main) {
  const { resolve } = await import('node:path')
  const { withWorkspace } = await import('./check.ts')
  const archive = resolve(process.argv[2] ?? join(homedir(), '.cache/bugdeloi/dila', stock))
  if (basename(archive) !== stock) throw new Error(`Stock DILA attendu : ${stock}.`)
  const { ids, dates } = await coverage()
  const { articles, unresolved } = await databaseArticles(ids, dates)
  const external = await withWorkspace(async (dir) => {
    const paths = Object.keys(stockArticles).map((id) => `*/${id}.xml`)
    const extract = Bun.spawn(['nice', 'tar', '-xz', '--wildcards', '-C', dir, '-f', archive, ...paths], {
      stdout: 'ignore',
      stderr: 'pipe',
    })
    const [code, diagnostic] = await Promise.all([extract.exited, new Response(extract.stderr).text()])
    if (code !== 0) throw new Error(diagnostic)
    return Promise.all(
      Object.entries(stockArticles).map(async ([id, textId]) => {
        const matches = Array.from(new Bun.Glob(`**/${id}.xml`).scanSync(dir))
        const path = matches[0]
        if (!path || matches.length !== 1) throw new Error(`XML LEGI absent ou dupliqué : ${id}.`)
        return parseArticle(await Bun.file(join(dir, path)).text(), id, textId).article
      }),
    )
  })
  const corpus = [
    ...articles.map((article) =>
      serialize(article, ids.includes(article.id), 'DILA LEGI, projection Postgres bugdeloi'),
    ),
    ...external.map((article) => serialize(article, ids.includes(article.id), stockUrl)),
  ].sort(
    (a, b) =>
      a.code.localeCompare(b.code) ||
      (a.article ?? '').localeCompare(b.article ?? '') ||
      (a.début ?? '').localeCompare(b.début ?? '') ||
      a.legiarti.localeCompare(b.legiarti),
  )
  await Bun.write(
    join(task, 'articles.json'),
    `${JSON.stringify(
      {
        période: { début: dates[0], fin_incluse: dates.at(-1) },
        articles: corpus,
        renvois_non_résolus: unresolved.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      },
      null,
      2,
    )}\n`,
  )
  console.log(
    `${ids.length} articles repérés, ${corpus.length} versions fournies, ${unresolved.length} renvois non résolus.`,
  )
}
