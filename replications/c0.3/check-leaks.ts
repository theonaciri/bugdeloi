import { join } from 'node:path'
import { withSource } from '../c0.1/source.ts'
import { task } from './check.ts'

function normalize(line: string) {
  return line.normalize('NFKC').toLowerCase().replaceAll(/\s+/g, '')
}

function* substantiveLines(content: string) {
  for (const [index, line] of content.split('\n').entries()) {
    const normalized = normalize(line)
    // Écarte les délimiteurs, mots-clés seuls, accolades et lignes de ponctuation.
    if (normalized.length >= 16 && (line.match(/[\p{L}\p{N}_]+/gu)?.length ?? 0) >= 2) {
      yield [index + 1, normalized] as const
    }
  }
}

function* stringValues(value: unknown): Generator<string> {
  if (typeof value === 'string') yield value
  else if (value && typeof value === 'object') {
    for (const child of Object.values(value)) yield* stringValues(child)
  }
}

export async function checkLeaks(source: string, directory = task) {
  const fingerprints = new Set<string>()
  for await (const path of new Bun.Glob('**/*.catala_*').scan(source)) {
    const original = await Bun.file(join(source, path)).text()
    for (const [, block] of original.matchAll(/^```catala(?:[-\w]*)[ \t]*\r?\n([\s\S]*?)^```[ \t]*\r?$/gm)) {
      if (block) for (const [, line] of substantiveLines(block)) fingerprints.add(line)
    }
    for (const directive of original.match(/^> (?:Usage|Inclusion|Module)[^\n]*/gm) ?? []) {
      fingerprints.add(normalize(directive))
    }
  }
  if (!fingerprints.size) throw new Error('Aucune ligne Catala Inria à comparer.')
  const leaks: string[] = []
  for await (const file of new Bun.Glob('**/*').scan({ cwd: directory, dot: true })) {
    const content = await Bun.file(join(directory, file)).text()
    const lines = file.endsWith('.json') ? [...stringValues(JSON.parse(content))].join('\n') : content
    for (const [number, line] of substantiveLines(lines)) {
      if (fingerprints.has(line)) leaks.push(`${file}:${number}`)
    }
  }
  if (leaks.length)
    throw new Error(`Lignes Catala Inria dans le paquet aveugle (JSON décodé) : ${leaks.join(', ')}.`)
}

if (import.meta.main) {
  await withSource((source) => checkLeaks(source))
  console.log('Paquet aveugle : aucun recoupement de ligne Catala.')
}
