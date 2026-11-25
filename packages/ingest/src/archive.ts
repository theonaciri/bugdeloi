import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, open, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { createInterface } from 'node:readline'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'
import { CODES } from '@bugdeloi/core'
import { extract } from 'tar-stream'
import {
  type ArticleDocument,
  parseArticle,
  parseStructure,
  parseText,
  type Structure,
  type TextDocument,
} from './xml.ts'

export const DILA_URL = 'https://echanges.dila.gouv.fr/OPENDATA/LEGI/'
const cacheDir = join(homedir(), '.cache', 'bugdeloi', 'dila')
const archiveName = /^(Freemium_legi_global|LEGI)_(\d{8}-\d{6})\.tar\.gz$/
export type Code = keyof typeof CODES
export type Archive = { name: string; stamp: string; kind: 'global' | 'increment'; path?: string }

export function archiveFromName(path: string): Archive {
  const name = basename(path)
  const match = archiveName.exec(name)
  if (!match?.[2]) throw new Error(`Nom d’archive LEGI invalide : ${name}`)
  return { name, stamp: match[2], kind: match[1] === 'LEGI' ? 'increment' : 'global' }
}

export async function listArchives(): Promise<Archive[]> {
  const response = await fetch(DILA_URL, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`Catalogue DILA : HTTP ${response.status}`)
  const html = await response.text()
  const names = [...html.matchAll(/href="([^"]+\.tar\.gz)"/g)].flatMap((match) =>
    match[1] && archiveName.test(match[1]) ? [match[1]] : [],
  )
  return [...new Set(names)].map(archiveFromName).sort((a, b) => a.stamp.localeCompare(b.stamp))
}

export async function openArchive(archive: Archive): Promise<{ path: string; sha256: string }> {
  const path = archive.path ?? join(cacheDir, archive.name)
  if (!archive.path) {
    await mkdir(cacheDir, { recursive: true })
    // Le verrou couvre la reprise et la publication du fichier dans le cache partagé.
    const child = Bun.spawn(
      [
        'flock',
        `${path}.lock`,
        'sh',
        '-c',
        'if [ ! -f "$1" ]; then curl -fSs --retry 3 --continue-at - --output "$1.part" "$2" && mv "$1.part" "$1"; fi',
        'dila',
        path,
        new URL(archive.name, DILA_URL).href,
      ],
      { stderr: 'inherit' },
    )
    if (await child.exited) throw new Error(`Téléchargement échoué : ${archive.name}`)
  }

  const hash = createHash('sha256')
  for await (const part of createReadStream(path)) hash.update(part)
  const sha256 = hash.digest('hex')
  if (!archive.path) {
    const record = `${path}.sha256`
    const previous = await readFile(record, 'utf8').catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error
      return null
    })
    if (previous !== null && previous.trim() !== sha256) {
      throw new Error(`Empreinte du cache différente pour ${archive.name}`)
    }
    if (previous === null) {
      const temp = `${record}.${randomUUID()}.part`
      await writeFile(temp, `${sha256}\n`)
      await rename(temp, record)
    }
  }
  return { path, sha256 }
}

type ArticleIndex = Pick<ArticleDocument['article'], 'id' | 'etat' | 'dateDebut' | 'dateFin'> & {
  linkTypes: Record<string, number>
}

export type CodeFiles = {
  text?: TextDocument
  structures: Map<string, Structure>
  articles: Map<string, ArticleIndex>
  articleFile?: string
  deletedFiles: Set<string>
  deletedDirectories: Set<string>
}

export function emptyCodeFiles(): CodeFiles {
  return {
    structures: new Map(),
    articles: new Map(),
    deletedFiles: new Set(),
    deletedDirectories: new Set(),
  }
}

function selectedPath(path: string) {
  return /(?:^|\/)LEGI\/TEXT\/(?:\d{2}\/){5}(LEGITEXT\d{12})(?:\/([^\s]*))?$/.exec(path)
}

function relativeDocument(path: string) {
  return /^(article\/LEGI\/ARTI\/(?:\d{2}\/){5}(LEGIARTI\d{12})|section_ta\/LEGI\/SCTA\/(?:\d{2}\/){5}(LEGISCTA\d{12})|texte\/(struct|version)\/(LEGITEXT\d{12}))\.xml$/.exec(
    path,
  )
}

export function documentPath(id: string, kind: 'article' | 'structure' | 'text'): string {
  if (id.startsWith('LEGITEXT')) return `texte/${kind === 'text' ? 'version' : 'struct'}/${id}`
  const folders = id.slice(8, -2).match(/../g)?.join('/')
  return id.startsWith('LEGIARTI')
    ? `article/LEGI/ARTI/${folders}/${id}`
    : `section_ta/LEGI/SCTA/${folders}/${id}`
}

export function isDeleted(files: CodeFiles, relativePath: string): boolean {
  if (files.deletedFiles.has(relativePath)) return true
  if (files.deletedDirectories.has('')) return true
  let boundary = relativePath.lastIndexOf('/')
  while (boundary > 0) {
    if (files.deletedDirectories.has(relativePath.slice(0, boundary))) return true
    boundary = relativePath.lastIndexOf('/', boundary - 1)
  }
  return false
}

function readDeletions(source: string, directory: boolean, selected: Map<string, CodeFiles>) {
  for (const line of source.split(/\r?\n/)) {
    const path = line.trim().replace(/\s+D$/, '').replace(/\/$/, '')
    const entry = selectedPath(path)
    const files = selected.get(entry?.[1] ?? '')
    if (!files) continue
    const relativePath = (entry?.[2] ?? '').replace(/\.xml$/, '')
    if (directory) files.deletedDirectories.add(relativePath)
    else files.deletedFiles.add(relativePath)
  }
}

export async function* stagedArticles(path: string | undefined): AsyncGenerator<ArticleDocument> {
  if (!path) return
  const input = createReadStream(path, { encoding: 'utf8' })
  const lines = createInterface({ input, crlfDelay: Infinity })
  try {
    for await (const line of lines) yield JSON.parse(line) as ArticleDocument
  } finally {
    lines.close()
    input.destroy()
  }
}

function stageArticles(path: string) {
  // Un seul document peut dépasser la taille du tampon, mais jamais la limite tar.
  const pending: string[] = []
  let length = 0
  async function flush() {
    const file = await open(path, 'a')
    try {
      await file.appendFile(pending.join(''))
    } finally {
      await file.close()
    }
    pending.length = 0
    length = 0
  }
  return {
    append(entry: ArticleDocument) {
      const line = `${JSON.stringify(entry)}\n`
      pending.push(line)
      length += line.length
      if (length >= 1024 * 1024) return flush()
    },
    finish() {
      if (pending.length) return flush()
    },
  }
}

const MAX_ENTRY_BYTES = 64 * 1024 * 1024
const utf8 = new TextDecoder('utf-8', { fatal: true })

export async function readArchive(
  path: string,
  codes: Code[],
  progress: (message: string) => void,
  stageDir?: string,
): Promise<Map<string, CodeFiles>> {
  const selected = new Map<string, CodeFiles>(codes.map((code) => [CODES[code].id, emptyCodeFiles()]))
  const shortTitles = new Map<string, Code>(codes.map((code) => [CODES[code].id, code]))
  const staging = new Map<string, ReturnType<typeof stageArticles>>()
  if (stageDir) {
    for (const [id, files] of selected) {
      files.articleFile = join(stageDir, `${id}.jsonl`)
      staging.set(id, stageArticles(files.articleFile))
    }
  }
  const tar = extract()
  const done = pipeline(createReadStream(path), createGunzip(), tar)
  // Attacher le gestionnaire avant la première erreur du flux. L'attente finale la propage.
  void done.catch(() => {})
  let parsed = 0
  try {
    for await (const entry of tar) {
      if (entry.header.type !== 'file') {
        entry.resume()
        continue
      }
      const name = entry.header.name
      const deletion = /(?:^|\/)liste_suppression_legi(_dossier)?\.dat$/.exec(name)
      const target = selectedPath(name)
      const textId = target?.[1]
      const files = textId && selected.get(textId)
      const doc = files && relativeDocument(target[2] ?? '')
      if (!doc && !deletion) {
        entry.resume()
        continue
      }
      try {
        const size = entry.header.size
        if (size === undefined || !Number.isSafeInteger(size) || size < 0 || size > MAX_ENTRY_BYTES) {
          throw new Error(`Taille d’entrée tar invalide : ${size}`)
        }
        const data = Buffer.allocUnsafe(size)
        let offset = 0
        for await (const chunk of entry) {
          offset += Buffer.from(chunk as Uint8Array).copy(data, offset)
        }
        if (offset !== size) throw new Error('Entrée tar incomplète')
        const xml = utf8.decode(data)
        if (deletion) {
          readDeletions(xml, Boolean(deletion[1]), selected)
          continue
        }
        if (!doc || !files || !textId) continue
        const [, , articleId, sectionId, textKind, documentId] = doc
        if (articleId) {
          if (files.articles.has(articleId)) throw new Error(`Document répété : ${articleId}`)
          const document = parseArticle(xml, articleId, textId)
          const { id, etat, dateDebut, dateFin } = document.article
          const linkTypes: Record<string, number> = Object.create(null)
          if (!stageDir) {
            for (const { typeLien } of document.links) linkTypes[typeLien] = (linkTypes[typeLien] ?? 0) + 1
          }
          files.articles.set(id, { id, etat, dateDebut, dateFin, linkTypes })
          const flushed = staging.get(textId)?.append(document)
          if (flushed) await flushed
        } else if (sectionId) files.structures.set(sectionId, parseStructure(xml, sectionId, false))
        else {
          const code = shortTitles.get(textId)
          if (documentId !== textId || !code) throw new Error('Identifiant du document texte inattendu')
          if (textKind === 'version') files.text = parseText(xml, textId, code)
          else files.structures.set(textId, parseStructure(xml, textId, true))
        }
        if (++parsed % 2_000 === 0) {
          // Limite les objets XML et chaînes mortes entre deux collectes Bun.
          Bun.gc(true)
          if (parsed % 10_000 === 0) progress(`  ${parsed} documents LEGI lus`)
        }
      } catch (error) {
        throw new Error(`${name} : ${error instanceof Error ? error.message : error}`, { cause: error })
      }
    }
    await done
    for (const [id, stage] of staging) {
      await stage.finish()
      const files = selected.get(id)
      if (files && files.articles.size === 0) delete files.articleFile
    }
    return selected
  } catch (error) {
    tar.destroy()
    await done.catch(() => {})
    throw error
  }
}
