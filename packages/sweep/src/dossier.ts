import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { findingArticle, findingEvidence } from '@bugdeloi/core/finding-certificate'
import { FINDING_TYPE_LABEL, FINDING_TYPES, type FindingType } from '@bugdeloi/core/findings'
import { type Db, finding } from '@bugdeloi/db'
import { and, eq } from 'drizzle-orm'

interface DossierOptions {
  status?: string
  type?: string
  limit?: string
  seed?: string
}

const markdown = (text: string) =>
  text
    .replace(/[\r\n]+/g, ' ')
    .replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c)
    .replace(/[\\`*_{}[\]()#+.!|~]/g, '\\$&')

const questions: Partial<Record<FindingType, string>> = {
  REF_MORTE:
    'À la date de projection, le renvoi vise-t-il une rédaction antérieure ou une disposition transitoire, ou faut-il corriger le texte ?',
  NUMEROTATION:
    'Les numéros se répètent-ils dans la même série, ou appartiennent-ils à des subdivisions distinctes ?',
  SYNTAXE:
    'La ponctuation signalée laisse-t-elle un signe sans pendant dans la version officielle, compte tenu de la structure des citations et des alinéas ?',
}

function dossierEntry(row: typeof finding.$inferSelect) {
  const evidence = findingEvidence(row.certificate)
  const { source, target, excerpts, hints, reproduction } = evidence
  const versionLine = (ref: NonNullable<typeof source>) => {
    const title = [ref.code, ref.num, ref.id].filter(Boolean).join(' · ')
    return `[${markdown(title)}](${ref.url}) · état ${markdown(ref.etat ?? 'inconnu')} · début ${markdown(ref.dateDebut ?? 'inconnu')} · fin ${markdown(ref.dateFin ?? 'inconnue')}`
  }
  const units = row.legalUnits.flatMap((unit) => {
    const ref = findingArticle(unit)
    return ref ? [`[${markdown(unit)}](${ref.url})`] : []
  })
  const type = FINDING_TYPES.find((type) => type === row.type)
  const verdict =
    typeof reproduction.verdict === 'string' ? markdown(reproduction.verdict) : 'absent du certificat'
  return [
    `## ${markdown(row.id)} · ${markdown(type ? FINDING_TYPE_LABEL[type] : row.type)}`,
    '',
    markdown(row.claim),
    '',
    `- **Statut** · ${row.status === 'reproduced' ? 'reproduit' : 'candidat'}`,
    `- **Date de projection** · ${markdown(evidence.projectionDate ?? 'absente du certificat')}`,
    `- **Article source** · ${source ? versionLine(source) : 'version non détaillée dans le certificat'}`,
    `- **Dernière version connue de la cible** · ${target ? versionLine(target) : 'aucune cible dans le certificat'}`,
    `- **Unités légales** · ${units.join(', ') || 'absentes du certificat'}`,
    `- **Indices** · ${hints.map((hint) => `« ${markdown(hint)} »`).join(', ') || 'aucun indice textuel consigné'}`,
    `- **Verdict de la reproduction indépendante** · ${verdict}`,
    '',
    '**Extraits du certificat**',
    '',
    ...(excerpts.length
      ? excerpts.flatMap(({ before, marked, after }) => [
          `> ${markdown(before)}**${markdown(marked)}**${markdown(after)}`,
          '',
        ])
      : ['Aucun extrait dans le certificat.', '']),
    `**Question à trancher** · ${(type && questions[type]) || 'Le constat du certificat justifie-t-il un verdict de défaut du texte ou de lacune ? Quel motif le justifie ?'}`,
    '',
  ].join('\n')
}

export async function writeDossier(db: Db, options: DossierOptions) {
  const status = options.status ?? 'reproduced'
  const limit = options.limit === undefined ? 25 : Number(options.limit)
  const type = FINDING_TYPES.find((t) => t === options.type)
  if (status !== 'reproduced' && status !== 'candidate')
    throw new Error('--status doit valoir reproduced ou candidate.')
  if (options.type !== undefined && !type) throw new Error(`Type inconnu : ${options.type}`)
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('--limit doit être un entier positif.')

  const rows = await db
    .select()
    .from(finding)
    .where(and(eq(finding.status, status), type && eq(finding.type, type)))
  const priority = rows.map((row) => ({
    row,
    hasHints: Number(findingEvidence(row.certificate).hints.length > 0),
    order:
      options.seed === undefined
        ? row.id
        : createHash('sha256').update(options.seed).update('\0').update(row.id).digest('hex'),
  }))
  priority.sort(
    (a, b) => a.hasHints - b.hasHints || a.order.localeCompare(b.order) || a.row.id.localeCompare(b.row.id),
  )
  const selected = priority.slice(0, limit)
  const date = new Date().toISOString().slice(0, 10)
  const directory = 'qualifications/dossiers'
  const filename = `${directory}/${date}-${type ?? 'tous'}.md`
  const content = [
    `# Dossier de qualification · ${date} · ${type ? FINDING_TYPE_LABEL[type] : 'Tous types'}`,
    '',
    'Dossier de travail pour la revue humaine. Les passages sont tirés des certificats du balayage.',
    '',
    ...(selected.length
      ? selected.map(({ row }) => dossierEntry(row))
      : ['Aucun dossier correspondant au statut et au type demandés.', '']),
  ].join('\n')
  await mkdir(directory, { recursive: true })
  await writeFile(filename, content, 'utf8')
  return { filename, count: selected.length }
}
