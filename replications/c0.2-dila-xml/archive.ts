/**
 * Lecture en flux des archives LEGI de la DILA (stock « Freemium » puis incréments quotidiens),
 * restreinte aux fichiers article des trois codes. Rien n'est décompressé sur disque : `gzip -dc`
 * (lancé sous `nice`) alimente le lecteur tar de `tar.ts`.
 */
import { basename } from 'node:path'
import { type ArticleRecord, CODE_BY_TEXT, type CodeName, parseArticle } from './legi-xml.ts'
import { TarStream } from './tar.ts'

export interface ArchiveInfo {
  name: string
  sha256: string
  /** Empreinte publiée par la DILA à côté de l'archive (fichier `.sha256`). */
  expected: string | null
}

export async function sha256File(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256')
  for await (const chunk of Bun.file(path).stream()) hasher.update(chunk)
  return hasher.digest('hex')
}

export async function verifyArchive(path: string): Promise<ArchiveInfo> {
  const sha256 = await sha256File(path)
  const side = Bun.file(`${path}.sha256`)
  const expected = (await side.exists()) ? ((await side.text()).trim().split(/\s+/)[0] ?? null) : null
  return { name: basename(path), sha256, expected }
}

/** Retire le préfixe d'horodatage des incréments (`20261124-221545/legi/…` → `legi/…`). */
export function canonicalPath(path: string): string {
  return path.replace(/^\.?\/?\d{8}-\d{6}\//, '').replace(/^\.\//, '')
}

const CODE_DIR = /\/(LEGITEXT000006069577|LEGITEXT000006073189|LEGITEXT000006074096)\//

export function codeOfPath(path: string): CodeName | null {
  const m = CODE_DIR.exec(path)
  return m?.[1] ? (CODE_BY_TEXT[m[1]] ?? null) : null
}

export interface StoredArticle {
  rec: ArticleRecord
  code: CodeName
  /** Archive qui a écrit cette version en dernier. */
  archive: string
  /** Ordre d'écriture global (départage deux chemins portant le même identifiant). */
  seq: number
}

let seqCounter = 0

export interface ArchiveStats {
  name: string
  articleFiles: number
  otherCodeFiles: number
  deletionsListed: number
  deletionsInCodes: number
  deletionsApplied: number
  deletedButWrittenSameArchive: number
  dirDeletionsInCodes: number
  /** Identifiants LEGIARTI dont la suppression est annoncée dans les trois codes. */
  deletedIds: string[]
  parseFailures: number
  categories: Record<string, number>
  ms: number
}

/** État courant : clé = chemin canonique sans `.xml`. */
export type LegiState = Map<string, StoredArticle>

export async function applyArchive(
  path: string,
  state: LegiState,
  withText: Set<string>,
  log: (s: string) => void = () => {},
): Promise<ArchiveStats> {
  const t0 = performance.now()
  const name = basename(path)
  const stats: ArchiveStats = {
    name,
    articleFiles: 0,
    otherCodeFiles: 0,
    deletionsListed: 0,
    deletionsInCodes: 0,
    deletionsApplied: 0,
    deletedButWrittenSameArchive: 0,
    dirDeletionsInCodes: 0,
    deletedIds: [],
    parseFailures: 0,
    categories: {},
    ms: 0,
  }
  const deletions: string[] = []
  const dirDeletions: string[] = []
  const written = new Set<string>()
  const decoder = new TextDecoder('utf-8')

  const tar = new TarStream(
    (raw, type) => {
      if (type !== '0') return false
      const p = canonicalPath(raw)
      if (p === 'liste_suppression_legi.dat' || p === 'liste_suppression_legi_dossier.dat') return true
      if (!codeOfPath(p)) return false
      if (p.includes('/article/') && p.endsWith('.xml')) return true
      stats.otherCodeFiles++
      return false
    },
    (entry, data) => {
      const p = canonicalPath(entry.path)
      if (p === 'liste_suppression_legi.dat') {
        for (const line of decoder.decode(data).split(/\r?\n/)) if (line.trim()) deletions.push(line.trim())
        return
      }
      if (p === 'liste_suppression_legi_dossier.dat') {
        for (const line of decoder.decode(data).split(/\r?\n/))
          if (line.trim()) dirDeletions.push(line.trim())
        return
      }
      const code = codeOfPath(p)
      if (!code) return
      const category = p.split('/').slice(2, 4).join('/')
      stats.categories[category] = (stats.categories[category] ?? 0) + 1
      const id = basename(p, '.xml')
      const rec = parseArticle(decoder.decode(data), { withText: withText.has(id) })
      if (!rec || rec.id !== id) {
        stats.parseFailures++
        return
      }
      stats.articleFiles++
      const key = p.slice(0, -'.xml'.length)
      state.set(key, { rec, code, archive: name, seq: ++seqCounter })
      written.add(key)
    },
  )

  const proc = Bun.spawn(['nice', '-n', '10', 'gzip', '-dc', path], { stdout: 'pipe', stderr: 'pipe' })
  for await (const chunk of proc.stdout) tar.push(chunk)
  const code = await proc.exited
  if (code !== 0) throw new Error(`gzip -dc ${name} : code ${code} ${await new Response(proc.stderr).text()}`)

  stats.deletionsListed = deletions.length
  for (const d of deletions) {
    const key = canonicalPath(d).replace(/\.xml$/, '')
    if (!codeOfPath(key)) continue
    stats.deletionsInCodes++
    stats.deletedIds.push(basename(key))
    if (written.has(key)) stats.deletedButWrittenSameArchive++
    if (state.delete(key)) stats.deletionsApplied++
  }
  for (const line of dirDeletions) {
    const dir = canonicalPath(line.split(/\s+/)[0] ?? '')
    if (!dir || !codeOfPath(`${dir}/`)) continue
    stats.dirDeletionsInCodes++
    for (const key of [...state.keys()]) if (key.startsWith(`${dir}/`)) state.delete(key)
  }
  stats.ms = Math.round(performance.now() - t0)
  log(
    `${name} : ${stats.articleFiles} articles des trois codes, ${stats.deletionsInCodes} suppressions visant ces codes (${stats.deletionsApplied} appliquées), ${stats.ms} ms`,
  )
  return stats
}
