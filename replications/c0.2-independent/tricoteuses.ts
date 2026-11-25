import { homedir } from 'node:os'
import { join } from 'node:path'

export const codes = ['CGI', 'CSS', 'CCH'] as const
export type Code = (typeof codes)[number]
export const sources = {
  CGI: {
    repository: 'code_general_des_impots',
    commit: 'b3c3c8f01c477624e497077d03da3bd5680c3592',
    date: '2026-11-21',
  },
  CSS: {
    repository: 'code_de_la_securite_sociale',
    commit: 'b2a09dd621ad9a33ca9a76fecb63f279855f28df',
    date: '2026-11-20',
  },
  CCH: {
    repository: 'code_de_la_construction_et_de_l_habitation',
    commit: 'ec16a9dc58e4fa036105081390e52e11ac29252e',
    date: '2026-10-09',
  },
} satisfies Record<Code, { repository: string; commit: string; date: string }>

export type Article = {
  id: string
  num: string
  state: string
  start: string
  end: string
  path: string
  paragraphs: string[]
}

export const datePattern = /^\d{4}-\d{2}-\d{2}$/
const entities: Record<string, string> = {
  amp: '&',
  apos: "'",
  quot: '"',
  lt: '<',
  gt: '>',
  nbsp: '\u00a0',
  laquo: '«',
  raquo: '»',
  ldquo: '“',
  rdquo: '”',
  rsquo: '’',
  ndash: '–',
  mdash: '—',
  deg: '°',
  thinsp: '\u2009',
  eacute: 'é',
}

export function paragraphs(markdown: string): string[] {
  return markdown
    .replace(/<\/?(?:br|p|div|li|tr|td|th|table|ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<\/?[a-z][\w:-]*(?:\s[^>]*)?\/?>/gi, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, key: string) => {
      if (!key.startsWith('#')) return entities[key] ?? entity
      const hexadecimal = key[1]?.toLowerCase() === 'x'
      const point = Number.parseInt(key.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10)
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity
    })
    .split(/\n\s*\n|\n(?=\s*$)/)
    .map((part) => part.replace(/\s+/gu, ' ').trim())
    .filter(Boolean)
}

export function parseArticle(raw: string, path: string): Article {
  const front = /^---\r?\n([\s\S]*?)\r?\n---\r?\n+(?:# [^\n]*\n)?/.exec(raw)
  if (!front?.[1]) throw new Error(`Métadonnées Tricoteuses absentes : ${path}`)
  const metadata = new Map(
    front[1].split(/\r?\n/).map((line) => {
      const separator = line.indexOf(': ')
      return [line.slice(0, separator), line.slice(separator + 2)]
    }),
  )
  const id = metadata.get('Identifiant')
  const num = metadata.get('Numéro')
  const state = metadata.get('État')
  const start = metadata.get('Date de début')
  const end = metadata.get('Date de fin')
  if (
    metadata.get('Nature') !== 'Article' ||
    !id ||
    !/^(LEGI|JORF)ARTI\d+$/.test(id) ||
    !num ||
    !state ||
    !start ||
    !end ||
    !datePattern.test(start) ||
    !datePattern.test(end)
  ) {
    throw new Error(`Métadonnées Tricoteuses non reconnues : ${path}`)
  }
  const body = raw.slice(front[0].length).split(/^#{2,3} (?:Nota\s*$|\[Autres formats\])/m)[0] ?? ''
  return { id, num, state, start, end, path, paragraphs: paragraphs(body) }
}

export function numberKey(num: string): string {
  return num
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[.\s*]/gu, '')
    .replace(/[‐‑‒–−]/gu, '-')
}

export class ArticleIndex {
  readonly byId = new Map<string, Article[]>()
  readonly byNumber = new Map<string, Article[]>()

  constructor(articles: Article[]) {
    for (const article of articles) {
      for (const [index, key] of [
        [this.byId, article.id],
        [this.byNumber, numberKey(article.num)],
      ] as const) {
        const existing = index.get(key)
        if (existing) existing.push(article)
        else index.set(key, [article])
      }
    }
  }

  target(ids: string[], numbers: string[]): Article[] {
    const identified = ids.flatMap((id) => this.byId.get(id) ?? [])
    const keys = new Set([...numbers, ...identified.map((article) => article.num)].map(numberKey))
    return [...new Set([...identified, ...Array.from(keys).flatMap((key) => this.byNumber.get(key) ?? [])])]
  }
}

function git(dir: string, args: string[], stdin?: Buffer): Buffer {
  const command = Bun.spawnSync(['git', '-C', dir, ...args], { stdin, stdout: 'pipe', stderr: 'pipe' })
  if (command.exitCode !== 0) throw new Error(command.stderr.toString().trim())
  return command.stdout
}

export function loadCorpus(): Record<Code, ArticleIndex> {
  const root = join(homedir(), '.cache/bugdeloi/ext/tricoteuses')
  const index = (code: Code) => {
    const { repository, commit } = sources[code]
    const dir = join(root, repository)
    const files = git(dir, ['ls-tree', '-rz', commit])
      .toString()
      .split('\0')
      .flatMap((entry) => {
        const [, hash, path] = /^\d+ blob ([a-f\d]+)\t((?:[^\n]*\/)?article_[^\n]+\.md)$/.exec(entry) ?? []
        return hash && path ? [{ hash, path }] : []
      })
    if (!files.length) throw new Error(`Aucun article dans ${repository} à ${commit}`)
    const blobs = git(
      dir,
      ['cat-file', '--batch'],
      Buffer.from(`${files.map(({ hash }) => hash).join('\n')}\n`),
    )
    let cursor = 0
    const articles = files.map(({ path, hash }) => {
      const newline = blobs.indexOf(10, cursor)
      const header = blobs.subarray(cursor, newline).toString()
      const [, actualHash, bytes] = /^([a-f\d]+) blob (\d+)$/.exec(header) ?? []
      if (actualHash !== hash || !bytes) throw new Error(`Blob Git illisible : ${repository}/${path}`)
      const end = newline + 1 + Number(bytes)
      const raw = blobs.subarray(newline + 1, end).toString('utf8')
      cursor = end + 1
      return parseArticle(raw, `${repository}/${path}`)
    })
    return new ArticleIndex(articles)
  }
  return { CGI: index('CGI'), CSS: index('CSS'), CCH: index('CCH') }
}
