import { execFileSync } from 'node:child_process'
import { lstatSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import {
  FINDING_ID_RE,
  type FindingQualification,
  findingQualification,
  isQualificationVerdict,
  isReviewer,
  QUALIFICATION_FILE_RE,
  qualifiedStatus,
  type VerdictEntry,
} from '@bugdeloi/core/findings'
import { type Db, event, finding } from '@bugdeloi/db'
import { eq, inArray } from 'drizzle-orm'
import { parseDocument } from 'yaml'

export function parseVerdicts(yaml: string): VerdictEntry[] {
  const document = parseDocument(yaml, { schema: 'core' })
  if (document.errors.length || document.warnings.length) {
    throw new Error(`YAML invalide : ${(document.errors[0] ?? document.warnings[0])?.message}`)
  }
  const entries: unknown = document.toJS({ maxAliasCount: 0 })
  if (!Array.isArray(entries) || entries.length === 0) throw new Error('Liste de verdicts non vide attendue.')
  const seen = new Set<string>()
  return entries.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).length !== 4) {
      throw new Error(`Verdict ${index + 1} : champs id, verdict, note et reviewer attendus.`)
    }
    const { id, verdict, note, reviewer } = entry
    if (
      typeof id !== 'string' ||
      !FINDING_ID_RE.test(id) ||
      !isQualificationVerdict(verdict) ||
      typeof note !== 'string' ||
      !note.trim() ||
      !isReviewer(reviewer)
    )
      throw new Error(`Verdict ${index + 1} : id, verdict, note ou reviewer invalide.`)
    if (seen.has(id)) throw new Error(`Verdict répété pour ${id}.`)
    seen.add(id)
    return { id, verdict, note, reviewer }
  })
}

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })

export function readCommittedVerdicts(filename: string, cwd = process.cwd()) {
  const root = git(cwd, 'rev-parse', '--show-toplevel').toString().trim()
  const absolute = resolve(cwd, filename)
  const file = relative(root, absolute)
  const handle = QUALIFICATION_FILE_RE.exec(file)?.[1]
  if (!isReviewer(handle)) {
    throw new Error('Fichier attendu : qualifications/verdicts/AAAA-MM-JJ-handle.yaml.')
  }
  const date = file.slice('qualifications/verdicts/'.length, 'qualifications/verdicts/'.length + 10)
  const parsedDate = new Date(`${date}T00:00:00Z`)
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    throw new Error(`Date de fichier invalide : ${date}.`)
  }
  const head = git(root, 'rev-parse', 'HEAD').toString().trim()
  let contents: Buffer
  try {
    contents = git(root, 'cat-file', 'blob', `${head}:${file}`)
  } catch {
    throw new Error(`Fichier de verdicts non commité : ${file}.`)
  }
  try {
    git(root, 'diff', '--cached', '--quiet', head, '--', file)
    git(root, 'diff', '--quiet', head, '--', file)
    if (!lstatSync(absolute).isFile() || !readFileSync(absolute).equals(contents)) {
      throw new Error('Contenu différent du commit')
    }
  } catch {
    throw new Error(`Fichier de verdicts modifié localement : ${file}.`)
  }
  const entries = parseVerdicts(new TextDecoder('utf-8', { fatal: true }).decode(contents))
  for (const { id, reviewer } of entries) {
    if (reviewer.toLowerCase() !== handle.toLowerCase()) {
      throw new Error(`${id} : le reviewer doit correspondre au handle du nom de fichier.`)
    }
  }
  const commit = git(root, 'log', '-1', '--format=%H', head, '--', file).toString().trim()
  return { file, commit, entries }
}

type VerdictBatch = ReturnType<typeof readCommittedVerdicts>

export async function qualifyFindings(db: Db, batch: VerdictBatch, dryRun = false) {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(finding)
      .where(
        inArray(
          finding.id,
          batch.entries.map(({ id }) => id),
        ),
      )
      .orderBy(finding.id)
      .for('update')
    const byId = new Map(rows.map((r) => [r.id, r]))
    const now = new Date()
    const results = []
    for (const { id, verdict, note, reviewer } of batch.entries) {
      const row = byId.get(id)
      if (!row) throw new Error(`Finding inconnu : ${id}.`)
      const status = qualifiedStatus(verdict)
      const existing = findingQualification(row.certificate)
      const alreadyApplied =
        (row.status === status || (status === 'qualified' && row.status === 'published')) &&
        existing?.commit === batch.commit &&
        existing.file === batch.file &&
        existing.verdict === verdict &&
        existing.reviewer === reviewer &&
        existing.note === note
      if (alreadyApplied) {
        results.push({ id, status: row.status, changed: false })
        continue
      }
      if (row.status === 'candidate') throw new Error(`${id} : reproduire d'abord (statut candidate).`)
      if (row.status !== 'reproduced') throw new Error(`${id} : statut ${row.status}, reproduced attendu.`)
      const qualification: FindingQualification = {
        verdict,
        reviewer,
        note,
        file: batch.file,
        commit: batch.commit,
        qualified_at: now.toISOString(),
      }
      if (!dryRun) {
        await tx
          .update(finding)
          .set({
            status,
            updatedAt: now,
            certificate: { ...row.certificate, qualification },
          })
          .where(eq(finding.id, id))
        await tx.insert(event).values({
          type: `finding.${status}`,
          subject: id,
          actor: `github:${reviewer}`,
          payload: { id, type: row.type, verdict },
        })
      }
      results.push({ id, status, changed: true })
    }
    return results
  })
}

export async function publishFindings(db: Db, ids: string[]) {
  if (!ids.length || ids.some((id) => !FINDING_ID_RE.test(id)))
    throw new Error('Identifiants de findings attendus.')
  return db.transaction(async (tx) => {
    const distinct = [...new Set(ids)]
    const rows = await tx
      .select()
      .from(finding)
      .where(inArray(finding.id, distinct))
      .orderBy(finding.id)
      .for('update')
    const byId = new Map(rows.map((row) => [row.id, row]))
    const now = new Date()
    const results = []
    for (const id of distinct) {
      const row = byId.get(id)
      if (!row) throw new Error(`Finding inconnu : ${id}.`)
      if (row.status === 'published') {
        results.push({ id, status: 'published', changed: false })
        continue
      }
      if (row.status !== 'qualified') throw new Error(`${id} : statut ${row.status}, qualified attendu.`)
      const qualification = findingQualification(row.certificate)
      if (!qualification || qualifiedStatus(qualification.verdict) !== 'qualified') {
        throw new Error(`${id} : qualification humaine favorable absente du certificat.`)
      }
      await tx.update(finding).set({ status: 'published', updatedAt: now }).where(eq(finding.id, id))
      await tx.insert(event).values({
        type: 'finding.published',
        subject: id,
        actor: 'system:publish',
        payload: { id, type: row.type, verdict: qualification.verdict },
      })
      results.push({ id, status: 'published', changed: true })
    }
    return results
  })
}
