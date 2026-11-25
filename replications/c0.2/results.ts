import type { finding } from '@bugdeloi/db'
import type { RunSummary, SweepContext } from '@bugdeloi/sweep'
import type { TriageEntry } from './report.ts'

type FindingRow = typeof finding.$inferSelect

export interface CandidateSummary {
  id: string
  fingerprint: string
  type: string
  subtype: string
  detector: string
  code: string
  article: string | null
  source_id: string
  legifrance_url: string
  cited: string | null
  extrait: string
  lien_legi: boolean | null
  indices: string[]
}

const SHORT = 220

export function summarizeFinding(row: FindingRow): CandidateSummary {
  const cert = row.certificate as {
    subtype: string
    fingerprint: string
    source_id: string
    // biome-ignore lint/suspicious/noExplicitAny: certificat JSON hétérogène selon le détecteur
    proof: Record<string, any>
  }
  const proof = cert.proof
  const source = proof.source ?? proof.versions?.[0] ?? {}
  const cit = proof.citation
  const first = proof.text_mentions?.first ?? cit?.occurrences?.[0]
  let extrait = ''
  if (first) {
    const at = (first.start ?? 0) - (first.excerpt_offset ?? 0)
    extrait = String(first.excerpt).slice(Math.max(0, at - 90), at + 110)
  } else if (proof.defect) extrait = String(proof.defect.locations?.[0]?.excerpt ?? '')
  else if (proof.duplicate)
    extrait = `${String(proof.previous.text).slice(0, 100)} ⟶ ${String(proof.duplicate.text).slice(0, 100)}`
  const hints = [...(proof.hints?.near_citation ?? [])].map((h: { id: string }) => h.id)
  return {
    id: row.id,
    fingerprint: cert.fingerprint,
    type: row.type,
    subtype: cert.subtype,
    detector: row.detector,
    code: source.code ?? '',
    article: source.num ?? null,
    source_id: cert.source_id,
    legifrance_url: proof.urls?.source ?? '',
    cited: cit?.raw ?? proof.links?.[0]?.target_num ?? null,
    extrait: extrait.replace(/\s+/g, ' ').trim().slice(0, SHORT),
    lien_legi: proof.legi_link_to_target ? proof.legi_link_to_target.present : proof.links ? true : null,
    indices: [...new Set<string>(hints)].sort(),
  }
}

const count = <T>(items: T[], key: (t: T) => string) => {
  const out: Record<string, number> = {}
  for (const i of items) out[key(i)] = (out[key(i)] ?? 0) + 1
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
}

export function buildResults(input: {
  summary: RunSummary
  ctx: SweepContext
  candidates: CandidateSummary[]
  ecartsCount: number
  triage: TriageEntry[]
  totalMs: number
  contextMs: number
  scanMs: Record<string, number>
  peakRssMb: number
}) {
  const { summary, ctx, candidates } = input
  const liens = input.summary.outcomes.find((o) => o.detector.startsWith('ref-morte-liens'))
  const texte = input.summary.outcomes.find((o) => o.detector.startsWith('ref-morte-texte'))
  const liensKeys = new Set(
    candidates
      .filter((c) => c.detector.startsWith('ref-morte-liens'))
      .map((c) => `${c.source_id}|${c.cited?.toLowerCase().replace(/[.\s*]/g, '')}`),
  )
  const overlap = candidates
    .filter((c) => c.detector.startsWith('ref-morte-texte'))
    .filter((c) => liensKeys.has(`${c.source_id}|${c.cited?.toLowerCase().replace(/[.\s*]/g, '')}`)).length
  return {
    generatedAt: new Date().toISOString(),
    sweepRunId: summary.runId,
    projection: ctx.codes
      .filter((c) => summary.codes.includes(c.code))
      .map((c) => ({
        code: c.code,
        textId: c.textId,
        asOf: c.asOf,
        archive: c.archive,
        archiveSha256: c.archiveSha256,
      })),
    versionsLoaded: ctx.versions.size,
    articlesChecked: summary.articlesChecked,
    durationMs: summary.durationMs,
    totalMs: input.totalMs,
    contextMs: input.contextMs,
    scanMs: input.scanMs,
    peakRssMb: input.peakRssMb,
    detectors: summary.outcomes.map((o) => ({
      detector: o.detector,
      candidates: o.candidates,
      new: o.new,
      alreadyKnown: o.alreadyKnown,
      bySubtype: o.bySubtype,
      stats: o.stats,
    })),
    candidatesByTypeAndSubtype: count(candidates, (c) => `${c.type} / ${c.subtype}`),
    candidatesByDetector: count(candidates, (c) => c.detector),
    refMorteTexteAvecLienLegi: candidates.filter(
      (c) => c.detector.startsWith('ref-morte-texte') && c.lien_legi,
    ).length,
    refMorteTexteRecoupeLesLiens: overlap,
    refMorteTexteTotal: texte?.candidates ?? 0,
    refMorteLiensTotal: liens?.candidates ?? 0,
    ecartsLienTexte: input.ecartsCount,
    triage: {
      size: input.triage.length,
      byStratumAndVerdict: count(input.triage, (t) => `${t.stratum} / ${t.verdict}`),
    },
  }
}

export type Results = ReturnType<typeof buildResults>
