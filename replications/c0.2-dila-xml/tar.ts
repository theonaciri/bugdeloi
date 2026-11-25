/**
 * Lecteur tar en flux (ustar, extensions GNU « L » et pax « x »), sans dépendance.
 *
 * On lui donne des morceaux de l'archive décompressée ; il appelle `wants(path)` à chaque en-tête et
 * ne garde en mémoire que le contenu des fichiers retenus. Les autres sont sautés octet par octet.
 */

export interface TarEntry {
  path: string
  /** '0' fichier ordinaire, '5' répertoire, etc. */
  type: string
  size: number
}

type Sink = (entry: TarEntry, data: Uint8Array) => void

const BLOCK = 512
const decoder = new TextDecoder('utf-8')

function readString(buf: Uint8Array, start: number, len: number): string {
  let end = start
  const stop = start + len
  while (end < stop && buf[end] !== 0) end++
  return decoder.decode(buf.subarray(start, end))
}

function readOctal(buf: Uint8Array, start: number, len: number): number {
  // Extension base 256 (GNU) : premier octet 0x80.
  if ((buf[start] ?? 0) & 0x80) {
    let v = 0
    for (let i = start + 1; i < start + len; i++) v = v * 256 + (buf[i] ?? 0)
    return v
  }
  const s = readString(buf, start, len).trim()
  return s === '' ? 0 : Number.parseInt(s, 8)
}

function isZeroBlock(buf: Uint8Array, start: number): boolean {
  for (let i = start; i < start + BLOCK; i++) if (buf[i] !== 0) return false
  return true
}

/** Extrait le chemin d'un enregistrement pax (`<len> path=<valeur>\n`). */
export function paxPath(data: Uint8Array): string | null {
  const text = decoder.decode(data)
  let i = 0
  while (i < text.length) {
    const sp = text.indexOf(' ', i)
    if (sp < 0) break
    const len = Number.parseInt(text.slice(i, sp), 10)
    if (!Number.isFinite(len) || len <= 0) break
    const record = text.slice(sp + 1, i + len - 1)
    if (record.startsWith('path=')) return record.slice(5)
    i += len
  }
  return null
}

export class TarStream {
  private pending: Uint8Array[] = []
  private pendingLen = 0
  /** Octets de données restant à lire (ou sauter) pour l'entrée courante, puis bourrage. */
  private remaining = 0
  private padding = 0
  private current: TarEntry | null = null
  private keep = false
  private chunks: Uint8Array[] = []
  private longName: string | null = null
  private readingMeta: 'L' | 'x' | null = null
  entries = 0

  constructor(
    private readonly wants: (path: string, type: string) => boolean,
    private readonly sink: Sink,
  ) {}

  push(chunk: Uint8Array): void {
    let off = 0
    while (off < chunk.length) {
      if (this.remaining > 0) {
        const n = Math.min(this.remaining, chunk.length - off)
        if (this.keep || this.readingMeta) this.chunks.push(chunk.subarray(off, off + n).slice())
        this.remaining -= n
        off += n
        if (this.remaining === 0) this.finishEntry()
        continue
      }
      if (this.padding > 0) {
        const n = Math.min(this.padding, chunk.length - off)
        this.padding -= n
        off += n
        continue
      }
      // Lecture d'un en-tête de 512 octets, éventuellement à cheval sur deux morceaux.
      const need = BLOCK - this.pendingLen
      const n = Math.min(need, chunk.length - off)
      this.pending.push(chunk.subarray(off, off + n))
      this.pendingLen += n
      off += n
      if (this.pendingLen === BLOCK) {
        const header = concat(this.pending, BLOCK)
        this.pending = []
        this.pendingLen = 0
        this.header(header)
      }
    }
  }

  private header(h: Uint8Array): void {
    if (isZeroBlock(h, 0)) {
      // Deux blocs nuls marquent la fin ; un seul suffit pour nous arrêter de lire des en-têtes utiles.
      return
    }
    const name = readString(h, 0, 100)
    const size = readOctal(h, 124, 12)
    const type = String.fromCharCode(h[156] ?? 48) || '0'
    const magic = readString(h, 257, 6)
    const prefix = magic.startsWith('ustar') ? readString(h, 345, 155) : ''
    let path = prefix ? `${prefix}/${name}` : name
    if (this.longName !== null) {
      path = this.longName
      this.longName = null
    }
    this.padding = (BLOCK - (size % BLOCK)) % BLOCK
    this.remaining = size
    this.chunks = []
    if (type === 'L' || type === 'x') {
      this.readingMeta = type
      this.keep = false
      this.current = { path, type, size }
    } else {
      this.readingMeta = null
      this.entries++
      this.current = { path, type: type === '\0' ? '0' : type, size }
      this.keep = this.wants(path, this.current.type)
    }
    if (size === 0) this.finishEntry()
  }

  private finishEntry(): void {
    const entry = this.current
    if (!entry) return
    if (this.readingMeta) {
      const data = concat(this.chunks, entry.size)
      if (this.readingMeta === 'L') this.longName = readString(data, 0, data.length)
      else {
        const p = paxPath(data)
        if (p !== null) this.longName = p
      }
      this.readingMeta = null
    } else if (this.keep) {
      this.sink(entry, concat(this.chunks, entry.size))
    }
    this.chunks = []
    this.keep = false
    this.current = null
  }
}

function concat(parts: Uint8Array[], total: number): Uint8Array {
  if (parts.length === 1 && parts[0]?.length === total) return parts[0]
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}
