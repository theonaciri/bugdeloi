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
 * - Pour une traduction dont la fiche d'analyse existe (`corpus/analyses/<LEGIARTI>.md`) :
 *   le texte cité dans la fiche (dont l'empreinte égale celle de LEGI) figure à l'identique dans le
 *   fichier, et le champ d'application de l'interface figée est déclaré. Sans base LEGI : la fiche
 *   fusionnée fait foi, `promote-corpus` recontrôle contre LEGI après fusion.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeLegalText, sha256Hex } from '../packages/core/src/legi.ts'

/** Même normalisation que `promote-corpus` : espaces et apostrophes unifiés. */
function normalize(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Texte officiel et interface figée d'une fiche d'analyse, si sa citation a l'empreinte LEGI. */
function frozenAnalysis(legiarti: string): { text: string; scope: string | null } | null {
  const path = join(workdir, 'analyses', `${legiarti}.md`)
  if (!existsSync(path)) return null
  const fiche = readFileSync(path, 'utf8')
  const hash = /SHA-256\s*`([0-9a-f]{64})`/.exec(fiche)?.[1]
  const quote = fiche
    .split('\n')
    .filter((l) => l.startsWith('>'))
    .map((l) => l.replace(/^>\s?/, ''))
    .join('\n')
  if (!hash || !quote || sha256Hex(normalizeLegalText(quote)) !== hash) return null
  const section = fiche.split(/^##\s+Interface[^\n]*\n/im)[1]?.split(/^##\s+/m)[0] ?? ''
  const scope = /`(\p{Lu}[\p{L}\p{N}_]*)@v\d+`/u.exec(section)?.[1] ?? null
  return { text: quote, scope }
}

const workdir = 'corpus'
const files = Array.from(new Bun.Glob('**/*.catala_fr').scanSync({ cwd: workdir })).sort()

if (files.length === 0) {
  console.error('[ECHEC] Aucun fichier .catala_fr trouvé dans corpus/.')
  process.exit(1)
}

const seenLegiarti = new Map<string, string>()
const seenSymbols = new Map<string, string>()
const declRe = /^\s*déclaration\s+(structure|énumération|champ d'application)\s+([^\s:]+)\s*:/gm
// Mots-clés d'un seul mot du lexer français de Catala 1.3.2 (compiler/surface/lexer_fr.cppo.ml) qu'un
// agent est tenté d'employer comme nom : le compilateur n'en donne qu'une erreur de syntaxe obscure.
const RESERVED = new Set([
  'résultat',
  'entrée',
  'interne',
  'contexte',
  'donnée',
  'condition',
  'conséquence',
  'état',
  'étiquette',
  'exception',
  'type',
  'règle',
  'structure',
  'somme',
  'contenu',
  'date',
  'durée',
  'argent',
  'entier',
  'décimal',
  'booléen',
  'an',
  'mois',
  'jour',
  'minimum',
  'maximum',
  'définition',
  'assertion',
])
// Champ de structure, entrée, sortie ou variable interne : `donnée <nom> contenu`, `entrée <nom> contenu`…
const fieldRe =
  /^\s*(donnée|entrée|résultat|interne|contexte)\s+(?:(?:entrée|résultat)\s+)?([^\s]+)\s+contenu\b/gm

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
    for (const match of block.matchAll(fieldRe)) {
      const name = match[2]
      if (name && RESERVED.has(name)) {
        console.error(
          `[N2 ECHEC] ${file} : « ${name} » est un mot réservé de Catala et ne peut pas servir de nom (ligne « ${match[1]} ${name} contenu … » ; préfère « ${name}_du_… »). Voir corpus/CATALA.md, « Mots réservés ».`,
        )
        process.exit(1)
      }
    }
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

  const prose = normalize(raw.replace(/```catala[\s\S]*?```/g, ' '))
  const declaredScopes = new Set(
    codeBlocks.flatMap((b) =>
      [...b.matchAll(/^\s*déclaration\s+champ d'application\s+([^\s:]+)\s*:/gm)].map((m) => m[1]),
    ),
  )
  for (const legiarti of headings) {
    const frozen = legiarti && !isInterface ? frozenAnalysis(legiarti) : null
    if (frozen && !prose.includes(normalize(frozen.text))) {
      console.error(
        `[N2 ECHEC] ${file} : le texte de ${legiarti} diffère de celui de corpus/analyses/${legiarti}.md (texte LEGI). Recopie-le à l'identique.`,
      )
      process.exit(1)
    }
    if (frozen?.scope && !declaredScopes.has(frozen.scope)) {
      console.error(
        `[N2 ECHEC] ${file} : aucun « déclaration champ d'application ${frozen.scope} » alors que l'interface figée de ${legiarti} est ${frozen.scope}.`,
      )
      process.exit(1)
    }
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
