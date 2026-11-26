#!/usr/bin/env bun
/**
 * Contrôle léger du corpus Catala (sans PostgreSQL requis), conçu pour les contributeurs externes
 * et la CI GitHub Actions sur les Pull Requests touchant `corpus/`.
 *
 * Vérifie :
 * - Présence d'un en-tête `#### Article …|LEGIARTI…` pour chaque fichier hors `interfaces/`
 * - Présence d'au moins un bloc ```catala avec une déclaration/définition/règle
 * - Unicité de chaque `LEGIARTI` dans tout `corpus/`
 * - Unicité de chaque déclaration Catala (structure, énumération, champ d'application hors Test*)
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const workdir = 'corpus'
const files = Array.from(new Bun.Glob('**/*.catala_fr').scanSync({ cwd: workdir })).sort()

if (files.length === 0) {
  console.error('[ECHEC] Aucun fichier .catala_fr trouvé dans corpus/.')
  process.exit(1)
}

const seenLegiarti = new Map<string, string>()
const seenSymbols = new Map<string, string>()
const declRe = /^\s*déclaration\s+(structure|énumération|champ d'application)\s+([^\s:]+)\s*:/gm

for (const file of files) {
  const raw = readFileSync(join(workdir, file), 'utf8')
  const isInterface = file.startsWith('interfaces/')
  const headings = [...raw.matchAll(/^#{1,6}\s+.*\|(LEGIARTI\d+)\s*$/gm)].map((m) => m[1]).filter(Boolean)
  if (!isInterface && headings.length === 0) {
    console.error(`[N1 ECHEC] En-tête LEGIARTI introuvable dans ${file}`)
    process.exit(1)
  }

  const codeBlocks = [...raw.matchAll(/```catala\n([\s\S]*?)```/g)].map((m) => m[1] ?? '')
  const hasCatalaCode = codeBlocks.some((b) =>
    /\b(déclaration|champ d'application|définition|règle|assertion)\b/.test(b),
  )
  if (!hasCatalaCode) {
    console.error(`[N1 ECHEC] Aucun bloc Catala formalisé dans ${file}`)
    process.exit(1)
  }

  for (const block of codeBlocks) {
    for (const match of block.matchAll(declRe)) {
      const kind = match[1]
      const name = match[2]
      if (!kind || !name || name.startsWith('Test')) continue
      const key = `${kind} ${name}`
      const prev = seenSymbols.get(key)
      if (prev && prev !== file) {
        console.error(`[N1 DOUBLON] "${key}" est déjà défini dans ${prev} et redéfini dans ${file}.`)
        process.exit(1)
      }
      seenSymbols.set(key, file)
    }
  }

  for (const legiarti of headings) {
    const prev = seenLegiarti.get(legiarti)
    if (prev && prev !== file) {
      console.error(`[N1 DOUBLON] ${legiarti} est déjà formalisé dans ${prev} et redéfini dans ${file}.`)
      process.exit(1)
    }
    seenLegiarti.set(legiarti, file)
  }
}

console.log(
  `[OK] Corpus PR check : ${files.length} fichiers, ${seenLegiarti.size} LEGIARTI uniques, ${seenSymbols.size} déclarations Catala uniques.`,
)
