import { join } from 'node:path'
import { sourceCommit, sourceUrl, withSource } from '../c0.1/source.ts'
import { readLegiArticles } from './legi-db.ts'
import { writeJson } from './packet.ts'

export type Kind = 'todo_juridique' | 'dependance_bofip'

export interface Annotation {
  kind: Kind
  suite: string
  file: string
  line: number
  nearestLegiarti: string | null
  bofipRef?: string
  excerpt: string
}

export interface GroundTruthItem extends Annotation {
  id: string
  inBugdeloiDb: boolean
}

export interface GroundTruth {
  sourceUrl: string
  sourceCommit: string
  databaseChecked: boolean
  items: GroundTruthItem[]
}

type NoteLine = { line: number; text: string }
const todo = /\bTODO\b/i
const bofip = /\bBOI-[A-Z]+(?:-[A-Z0-9]+)*/gi

function isLegalTodo(excerpt: string) {
  const note = excerpt
    .replace(/^\s*#\s*/gm, '')
    .replace(/\s+/g, ' ')
    .normalize('NFC')
    .toLowerCase()
    .split(/\btodo\b/, 2)[1]
    ?.trim()
  if (!note) return false

  // Les annotations mixtes peuvent ne demander qu'un changement de structure.
  if (
    /^(?:(?:informatique et juridique|juridique et informatique|juridique)\s*:?\s*)?:?\s*(?:trouver une meilleure? place|brancher le champ|test à vérifier|utiliser date\.|comment implémenter|où stocker|détecter dans la liste)/u.test(
      note,
    )
  ) {
    return false
  }
  if (/^(?:informatique et juridique|juridique)\b/.test(note)) return true
  if (/^informatique\b/.test(note)) return false

  return /recherche juridique|phrase est très ambiguë|angle mort|quelle date|vérifier ce critère|qu'est-ce que ça veut dire|on ne donne les sanctions|sous quelles conditions|texte de la spec|quid des outre-mer|nombre de jours plutôt|aggre?ger les aides/u.test(
    note,
  )
}

export function parseSourceFile(file: string, content: string) {
  const suite = file.split('/')[0] ?? file
  const annotations: Annotation[] = []
  const comments: string[] = []
  const seen = new Set<string>()
  let nearestLegiarti: string | null = null
  let fence: { marker: string; catala: boolean } | undefined
  let block: NoteLine[] = []
  let blockType: 'comment' | 'prose' | undefined

  function add(kind: Kind, line: number, excerpt: string, bofipRef?: string) {
    const key = JSON.stringify([kind, nearestLegiarti, bofipRef, excerpt.trim()])
    // Garde les TODO à leur emplacement, même lorsque la même question revient dans un fichier.
    if (kind === 'dependance_bofip' && seen.has(key)) return
    seen.add(key)
    annotations.push({ kind, suite, file, line, nearestLegiarti, ...(bofipRef ? { bofipRef } : {}), excerpt })
  }

  function flush() {
    const excerpt = block.map(({ text }) => text).join('\n')
    if (blockType === 'comment') comments.push(excerpt)
    const starts = block.filter(({ text }) => todo.test(text)).map(({ line }) => line)
    for (const [index, line] of starts.entries()) {
      const end = starts[index + 1] ?? Number.POSITIVE_INFINITY
      const note = block
        .filter((entry) => entry.line >= line && entry.line < end)
        .map(({ text }) => text)
        .join('\n')
      if (isLegalTodo(note)) {
        const context = index === 0 && /sur le sujet\./i.test(note) ? excerpt : note
        add('todo_juridique', line, context)
      }
      comments.push(note)
    }

    const refs = new Map<string, number>()
    for (const { line, text } of block) {
      for (const [raw] of text.matchAll(bofip)) {
        // Les liens peuvent suffixer l'identifiant de la date d'édition.
        const ref = raw.toUpperCase().replace(/-\d{7,8}$/, '')
        if (!refs.has(ref)) refs.set(ref, line)
      }
    }
    for (const [ref, line] of refs) add('dependance_bofip', line, excerpt, ref)
    if (refs.size && blockType === 'prose') comments.push(excerpt)
    block = []
    blockType = undefined
  }

  for (const [index, text] of content.split(/\r?\n/).entries()) {
    const line = index + 1
    const delimiter = text.match(/^\s*(`{3,}|~{3,})\s*(.*?)\s*$/)
    if (delimiter?.[1] && !fence) {
      flush()
      fence = { marker: delimiter[1], catala: /^catala(?:-metadata)?(?:\s|$)/.test(delimiter[2] ?? '') }
      continue
    }
    if (delimiter?.[1]?.startsWith(fence?.marker ?? '') && fence && !delimiter[2]) {
      flush()
      fence = undefined
      continue
    }
    if (!fence) {
      const heading = text.match(/^\s{0,3}#+\s+/)
      if (heading) {
        flush()
        const id = /^\s{0,3}#+\s+[^|]+\|\s*(LEGIARTI\d{12})(?!\w)/.exec(text)?.[1]
        if (id) nearestLegiarti = id
        continue
      }
    }

    if (fence && !fence.catala) continue
    // Un # dans une chaîne ou dans #[test] ne commence pas un commentaire.
    const comment = fence ? /^(?:"(?:[^"\\]|\\.)*"|[^"#])*?(#(?!\[).*)$/.exec(text)?.[1] : undefined
    const type = fence ? 'comment' : 'prose'
    const note = fence ? comment : text
    if (!note?.trim() || /^#\s*$/.test(note)) {
      flush()
      continue
    }
    if (type !== blockType || /^# Justification du plafonnement\s*:/i.test(note)) flush()
    blockType = type
    block.push({ line, text: comment && text.trimStart() === comment ? text : note })
  }
  flush()
  annotations.sort((a, b) => a.line - b.line)
  return { annotations, comments }
}

export function readSourceAnnotations() {
  return withSource(async (directory) => {
    const paths = Array.from(new Bun.Glob('**/*.catala_fr').scanSync(directory)).sort()
    const annotations: Annotation[] = []
    const comments: string[] = []
    for (const file of paths) {
      const parsed = parseSourceFile(file, await Bun.file(join(directory, file)).text())
      annotations.push(...parsed.annotations)
      comments.push(...parsed.comments)
    }
    if (annotations.length === 0) throw new Error('Aucune annotation extraite du corpus épinglé.')
    return { annotations, comments }
  })
}

export function annotationArticleIds(items: Annotation[]) {
  return [...new Set(items.flatMap(({ nearestLegiarti }) => nearestLegiarti ?? []))].sort()
}

export async function extractGroundTruth(withDb: boolean): Promise<GroundTruth> {
  const { annotations } = await readSourceAnnotations()
  const articles = withDb ? await readLegiArticles(annotationArticleIds(annotations)) : []
  const present = new Set(articles.map(({ legiarti }) => legiarti))
  const counts = { todo_juridique: 0, dependance_bofip: 0 }
  const items = annotations.map((annotation) => {
    const { kind, nearestLegiarti } = annotation
    const slug = kind === 'todo_juridique' ? 'todo' : 'bofip'
    const index = String(++counts[kind]).padStart(3, '0')
    return {
      id: `c04-${slug}-${index}`,
      ...annotation,
      inBugdeloiDb: nearestLegiarti !== null && present.has(nearestLegiarti),
    }
  })
  return { sourceUrl, sourceCommit, databaseChecked: withDb, items }
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  if (args.length > 1 || (args.length === 1 && args[0] !== '--with-db')) {
    throw new Error('Usage : bun replications/c0.4/extract-ground-truth.ts [--with-db]')
  }
  const groundTruth = await extractGroundTruth(args.includes('--with-db'))
  await writeJson('ground-truth.json', groundTruth)
  console.log(`${groundTruth.items.length} annotations extraites.`)
}
