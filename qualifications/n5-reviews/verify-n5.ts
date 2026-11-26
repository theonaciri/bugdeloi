// Contrôle mécanique N5 (AGENTS.md §4.1, `check human`).
// N5 exige une revue humaine signée. Un fichier de revue sans signature cryptographique valide du commit qui
// l'introduit ou le modifie n'accorde jamais N5, quel que soit son contenu.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

export type ReviewStatus =
  | 'VALID_SIGNED'
  | 'UNSIGNED_COMMIT'
  | 'BAD_SIGNATURE'
  | 'UNCOMMITTED'
  | 'INVALID_SCHEMA'

export interface ReviewResult {
  file: string
  status: ReviewStatus
  node: string | null
  verdict: 'approved' | 'changes_requested' | null
  commit: string | null
  /** Vrai seulement si signature valide, schéma valide et verdict `approved`. */
  grantsN5: boolean
  errors: string[]
}

const LEGIARTI = /^LEGIARTI\d{12}$/
const SHA256 = /^[0-9a-f]{64}$/
const GIT_SHA = /^[0-9a-f]{40}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const VERDICTS = ['approved', 'changes_requested']

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Valide le schéma d'une revue. Renvoie la liste des erreurs (vide si valide). */
export function validateReview(doc: unknown): string[] {
  if (!isRecord(doc)) return ['Le document doit être un objet YAML.']
  const errors: string[] = []

  if (!nonEmptyString(doc.node)) errors.push('node : chaîne non vide requise.')
  if (!nonEmptyString(doc.catala_file)) errors.push('catala_file : chaîne non vide requise.')
  if (!(typeof doc.catala_commit === 'string' && GIT_SHA.test(doc.catala_commit)))
    errors.push('catala_commit : SHA Git de 40 caractères hexadécimaux minuscules requis.')

  if (!Array.isArray(doc.legal_units) || doc.legal_units.length === 0) {
    errors.push('legal_units : liste non vide requise.')
  } else {
    doc.legal_units.forEach((unit, i) => {
      if (!isRecord(unit)) {
        errors.push(`legal_units[${i}] : objet requis.`)
        return
      }
      if (!(typeof unit.legiarti === 'string' && LEGIARTI.test(unit.legiarti)))
        errors.push(`legal_units[${i}].legiarti : format LEGIARTI + 12 chiffres requis.`)
      if (!(typeof unit.text_sha256 === 'string' && SHA256.test(unit.text_sha256)))
        errors.push(
          `legal_units[${i}].text_sha256 : SHA-256 de 64 caractères hexadécimaux minuscules requis.`,
        )
    })
  }

  if (!isRecord(doc.reviewer)) {
    errors.push('reviewer : objet requis (name, handle, credentials, affiliation).')
  } else {
    for (const field of ['name', 'handle', 'credentials', 'affiliation']) {
      if (!nonEmptyString(doc.reviewer[field])) errors.push(`reviewer.${field} : chaîne non vide requise.`)
    }
  }

  if (
    !(
      typeof doc.reviewed_at === 'string' &&
      DATE.test(doc.reviewed_at) &&
      !Number.isNaN(Date.parse(doc.reviewed_at))
    )
  )
    errors.push('reviewed_at : date AAAA-MM-JJ requise.')

  if (!Array.isArray(doc.interpretation_choices_checked) || doc.interpretation_choices_checked.length === 0) {
    errors.push('interpretation_choices_checked : liste non vide requise.')
  } else if (!doc.interpretation_choices_checked.every(nonEmptyString)) {
    errors.push('interpretation_choices_checked : chaque élément doit être une chaîne non vide.')
  }

  if (typeof doc.verdict !== 'string' || !VERDICTS.includes(doc.verdict)) {
    errors.push(`verdict : l'une des valeurs ${VERDICTS.join(' | ')} requise.`)
  } else if (doc.verdict === 'changes_requested' && !nonEmptyString(doc.note)) {
    errors.push('note : motif obligatoire quand verdict = changes_requested.')
  }
  if (doc.note !== undefined && doc.note !== null && typeof doc.note !== 'string')
    errors.push('note : chaîne requise si présente.')

  return errors
}

/** Classe le code `%G?` de Git. `G` (bonne) et `U` (bonne, confiance inconnue) valent signature valide. */
export function classifySignature(code: string): 'VALID_SIGNED' | 'UNSIGNED_COMMIT' | 'BAD_SIGNATURE' {
  const c = code.trim()
  if (c === 'G' || c === 'U') return 'VALID_SIGNED'
  if (c === 'N' || c === '') return 'UNSIGNED_COMMIT'
  // B (mauvaise), X/Y (expirée), R (révoquée), E (non vérifiable) : jamais accepté.
  return 'BAD_SIGNATURE'
}

export interface GitInfo {
  /** Code `%G?` du dernier commit touchant le fichier ; null si le fichier n'est pas suivi ou est modifié. */
  signatureCode: string | null
  commit: string | null
  dirty: boolean
}

function git(cwd: string, args: string[]): { ok: boolean; out: string } {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' })
  return { ok: r.status === 0, out: (r.stdout ?? '').trim() }
}

export function readGitInfo(file: string): GitInfo {
  const abs = resolve(file)
  const cwd = dirname(abs)
  const name = basename(abs)
  const log = git(cwd, ['log', '-1', '--format=%G?%n%H', '--', name])
  const [code, hash] = log.out.split('\n')
  const status = git(cwd, ['status', '--porcelain', '--', name])
  const dirty = status.out.length > 0
  if (!log.ok || !hash) return { signatureCode: null, commit: null, dirty }
  return { signatureCode: code ?? '', commit: hash, dirty }
}

export function reviewResult(file: string, yamlText: string, info: GitInfo): ReviewResult {
  const base = {
    file,
    node: null as string | null,
    verdict: null as ReviewResult['verdict'],
    commit: info.commit,
  }
  let doc: unknown
  try {
    doc = Bun.YAML.parse(yamlText)
  } catch (error) {
    return {
      ...base,
      status: 'INVALID_SCHEMA',
      grantsN5: false,
      errors: [`YAML illisible : ${(error as Error).message}`],
    }
  }
  const errors = validateReview(doc)
  const record = isRecord(doc) ? doc : {}
  const node = nonEmptyString(record.node) ? record.node : null
  const verdict = VERDICTS.includes(record.verdict as string)
    ? (record.verdict as ReviewResult['verdict'])
    : null
  if (errors.length > 0) return { ...base, node, verdict, status: 'INVALID_SCHEMA', grantsN5: false, errors }

  if (info.signatureCode === null || info.commit === null || info.dirty) {
    const why = info.dirty
      ? 'Fichier modifié depuis son dernier commit : commite-le (signé) avant le contrôle.'
      : "Fichier absent de l'historique Git : commite-le (signé) avant le contrôle."
    return { ...base, node, verdict, status: 'UNCOMMITTED', grantsN5: false, errors: [why] }
  }
  const status = classifySignature(info.signatureCode)
  const errors2 =
    status === 'VALID_SIGNED'
      ? []
      : [
          `Commit ${info.commit} : signature Git « ${info.signatureCode || 'absente'} » non acceptée (attendu G ou U).`,
        ]
  return {
    ...base,
    node,
    verdict,
    status,
    grantsN5: status === 'VALID_SIGNED' && verdict === 'approved',
    errors: errors2,
  }
}

export async function verifyDirectory(dir: string): Promise<ReviewResult[]> {
  if (!existsSync(dir)) return []
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .sort()
  const results: ReviewResult[] = []
  for (const f of files) {
    const path = join(dir, f)
    results.push(reviewResult(path, await Bun.file(path).text(), readGitInfo(path)))
  }
  return results
}

if (import.meta.main) {
  const dir = resolve(process.argv[2] ?? import.meta.dir)
  const results = await verifyDirectory(dir)
  for (const r of results) {
    console.log(
      `${r.status}\t${r.grantsN5 ? 'N5' : '--'}\t${r.node ?? '?'}\t${r.verdict ?? '?'}\t${basename(r.file)}`,
    )
    for (const e of r.errors) console.log(`  - ${e}`)
  }
  const granted = new Set(results.filter((r) => r.grantsN5).map((r) => r.node))
  console.log(
    `${results.length} revue(s), ${granted.size} nœud(s) avec N5 : ${[...granted].join(', ') || 'aucun'}`,
  )
  process.exit(results.some((r) => r.status !== 'VALID_SIGNED') ? 1 : 0)
}
