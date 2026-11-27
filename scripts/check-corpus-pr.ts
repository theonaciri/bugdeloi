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
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeLegalText, sha256Hex } from '../packages/core/src/legi.ts'
import { validateOracleCases } from '../packages/core/src/oracles.ts'

/** Même normalisation que `promote-corpus` : espaces et apostrophes unifiés. */
function normalize(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Fiche la plus récente d'un article : `<LEGIARTI>.vN.md` remplace `<LEGIARTI>.md` (v1). */
function latestAnalysisPath(legiarti: string): string | null {
  const dir = join(workdir, 'analyses')
  if (!existsSync(dir)) return null
  let best: { path: string; version: number } | null = null
  for (const name of readdirSync(dir)) {
    const match = /^(LEGIARTI\d{12})(?:\.v(\d+))?\.md$/.exec(name)
    if (match?.[1] !== legiarti) continue
    const version = match[2] ? Number(match[2]) : 1
    if (!best || version > best.version) best = { path: join(dir, name), version }
  }
  return best?.path ?? null
}

/**
 * Déclarations Catala d'un texte, par en-tête (`déclaration structure X:`) : lignes sans commentaire ni
 * espaces de tête. Pour un champ d'application, seules ses entrées et ses sorties comptent (l'interface) ;
 * ses variables `interne` relèvent de la traduction.
 */
function declarations(code: string): Map<string, string> {
  const found = new Map<string, string>()
  let head: string | null = null
  let body: string[] = []
  const flush = () => {
    if (head) found.set(head, body.join('\n'))
    head = null
    body = []
  }
  for (const rawLine of code.split('\n')) {
    const line = rawLine.replace(/#.*/, '').trimEnd()
    if (/^déclaration\s/.test(line)) {
      flush()
      head = line.trim()
    } else if (head && /^\s+\S/.test(line)) {
      const content = line.trim()
      if (!/^interne\s/.test(content)) body.push(content.replace(/\s+/g, ' '))
    } else if (head && line.trim() !== '') {
      flush()
    }
  }
  flush()
  return found
}

/** Texte officiel et interface figée d'une fiche d'analyse, si sa citation a l'empreinte LEGI. */
function frozenAnalysis(legiarti: string): {
  text: string
  scope: string | null
  version: string | null
  file: string
  declared: Map<string, string> | null
} | null {
  const path = latestAnalysisPath(legiarti)
  if (!path) return null
  const fiche = readFileSync(path, 'utf8')
  const hash = /SHA-256\s*`([0-9a-f]{64})`/.exec(fiche)?.[1]
  const quote = fiche
    .split('\n')
    .filter((l) => l.startsWith('>'))
    .map((l) => l.replace(/^>\s?/, ''))
    .join('\n')
  if (!hash || !quote || sha256Hex(normalizeLegalText(quote)) !== hash) return null
  const section = fiche.split(/^##\s+Interface[^\n]*\n/im)[1]?.split(/^##\s+/m)[0] ?? ''
  const block = /```catala\n([\s\S]*?)```/.exec(section)?.[1]
  const prose = section.replace(/```catala\n[\s\S]*?```/g, ' ')
  const named = /`(\p{Lu}[\p{L}\p{N}_]*)@(v\d+)`/u.exec(prose)
  return {
    text: quote,
    scope: named?.[1] ?? null,
    version: named ? `${named[1]}@${named[2]}` : null,
    file: path,
    declared: block ? declarations(block) : null,
  }
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

// AGENTS.md §8 : une constante de la règle (montant, taux, seuil, durée, date, rang) est précédée, dans
// les trois lignes au-dessus (ou sur sa ligne), d'un commentaire qui cite sa source. Les champs
// d'application de test en sont dispensés : leurs valeurs sont annoncées comme synthétiques.
const numberRe = /(?<![\p{L}\p{N}_])\d/u
const citationRe = /#.*(CGI|CSS|CCH|LEGIARTI|[Aa]rticle|Source|interface)/
function uncitedConstants(raw: string): { line: number; text: string }[] {
  const found: { line: number; text: string }[] = []
  for (const block of raw.matchAll(/```catala\n([\s\S]*?)```/g)) {
    const first = raw.slice(0, block.index).split('\n').length + 1
    const lines = (block[1] ?? '').split('\n')
    let inTest = false
    let nextIsTest = false
    lines.forEach((line, i) => {
      if (/^#\[test\]/.test(line)) {
        nextIsTest = true
        return
      }
      const head = /^(?:déclaration\s+)?(?:champ d'application|structure|énumération)\s+(\S+?):?\s*$/.exec(
        line,
      )
      if (head) {
        inTest = nextIsTest || (head[1] ?? '').startsWith('Test')
        nextIsTest = false
        return
      }
      const code = line.replace(/#.*/, '')
      if (inTest || !numberRe.test(code) || /^\s*(entrée|résultat|interne|contexte|donnée)\b/.test(code))
        return
      if (!lines.slice(Math.max(0, i - 3), i + 1).some((l) => citationRe.test(l))) {
        found.push({ line: first + i, text: line.trim() })
      }
    })
  }
  return found
}

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

  const uncited = uncitedConstants(raw)
  if (!isInterface && uncited.length) {
    console.error(
      `[N2 ECHEC] ${file} : constante sans citation dans les trois lignes au-dessus (AGENTS.md §8). Place un commentaire « # CGI, article …, alinéa … : … » juste avant :\n${uncited.map((u) => `  ligne ${u.line} : ${u.text}`).join('\n')}`,
    )
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
    if (frozen?.declared) {
      // Interface figée par un bloc de déclaration (fiche v2 et suivantes) : la traduction la déclare à
      // l'identique et cite la même version ; les oracles, écrits contre ce bloc, se branchent sans adaptation.
      const own = declarations(codeBlocks.join('\n'))
      for (const [head, body] of frozen.declared) {
        const mine = own.get(head)
        if (mine === undefined || mine !== body) {
          console.error(
            `[N2 ECHEC] ${file} : « ${head} » ${mine === undefined ? 'manque' : 'diffère de la déclaration figée'} (${frozen.file}). Recopie la déclaration de la fiche à l'identique ; seules les variables interne s'y ajoutent.`,
          )
          process.exit(1)
        }
      }
      const cited = /Interface `([^`]+@v\d+)`/.exec(prose)?.[1] ?? null
      if (frozen.version && cited !== frozen.version) {
        console.error(
          `[N2 ECHEC] ${file} : le fichier cite l'interface ${cited ?? '(aucune)'} alors que l'interface figée est ${frozen.version} (${frozen.file}).`,
        )
        process.exit(1)
      }
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

const oracleFiles = Array.from(new Bun.Glob('oracles/**/*.yaml').scanSync({ cwd: workdir })).sort()
let oracleCasesCount = 0
for (const file of oracleFiles) {
  let parsed: unknown
  try {
    parsed = Bun.YAML.parse(readFileSync(join(workdir, file), 'utf8'))
  } catch (err) {
    console.error(`[N3 ORACLE YAML] ${file} : ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
  const res = validateOracleCases(parsed, `corpus/${file}`)
  if (res.errors.length > 0) {
    for (const err of res.errors) console.error(`[N3 ORACLE SCHEMA] ${err}`)
    process.exit(1)
  }
  oracleCasesCount += res.cases.length
}

console.log(
  `[OK] Corpus PR check : ${files.length} fichiers, ${seenLegiarti.size} LEGIARTI uniques, ${seenSymbols.size} déclarations Catala uniques, ${oracleFiles.length} fichiers d'oracles (${oracleCasesCount} cas).`,
)
