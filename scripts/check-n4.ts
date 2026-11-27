#!/usr/bin/env bun
/**
 * Contrôle N4 Éprouvé (`corpus/redteam/<module>.yaml`) :
 * Vérifie les trois critères cumulatifs d'AGENTS.md §4.1 :
 * 1. Différentiel sur >= 10 000 entrées (dont seuils ± 1 €), 0 divergence non expliquée.
 * 2. Score de mutation >= 80 %.
 * 3. Fenêtre de red team ouverte >= 7 jours sans contre-exemple accepté.
 *
 * Tant que la fenêtre de 7 jours n'est pas écoulée, l'article reste N3 et le script
 * renvoie le dossier en `pendingRedteam` (avec date d'échéance) pour traçabilité.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface N4Manifest {
  id: string
  module: string
  legal_units: string[]
  differential_report: string
  mutation_report: string
  redteam_opened_at: string
  accepted_counterexamples: unknown[]
}

export interface N4ArticleStatus {
  legiarti: string
  manifestId: string
  differentialCases: number
  unexplainedDivergences: number
  mutationScorePct: number
  redteamOpenedAt: string
  redteamEligibleAt: string
  elapsedDays: number
  acceptedCounterexamples: number
  eligible: boolean
}

export interface N4CheckResult {
  ok: boolean
  errors: string[]
  eligibleN4: N4ArticleStatus[]
  pendingN4: N4ArticleStatus[]
}

const MIN_DIFFERENTIAL_CASES = 10_000
const MIN_MUTATION_PCT = 80
const MIN_REDTEAM_DAYS = 7

export function runN4Checks(workdir = 'corpus', now = new Date()): N4CheckResult {
  const errors: string[] = []
  const eligibleN4: N4ArticleStatus[] = []
  const pendingN4: N4ArticleStatus[] = []

  const manifests = Array.from(new Bun.Glob('redteam/*.yaml').scanSync({ cwd: workdir })).sort()
  for (const rel of manifests) {
    const full = join(workdir, rel)
    let raw: unknown
    try {
      raw = Bun.YAML.parse(readFileSync(full, 'utf8'))
    } catch (e) {
      errors.push(`${rel} : YAML illisible (${e instanceof Error ? e.message : String(e)})`)
      continue
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push(`${rel} : un objet YAML est attendu.`)
      continue
    }
    const m = raw as Partial<N4Manifest>
    if (!m.id || !m.module || !Array.isArray(m.legal_units) || m.legal_units.length === 0) {
      errors.push(`${rel} : champs id, module et legal_units obligatoires.`)
      continue
    }
    if (!m.differential_report || !existsSync(m.differential_report)) {
      errors.push(`${rel} : differential_report introuvable (${m.differential_report ?? 'absent'}).`)
      continue
    }
    if (!m.mutation_report || !existsSync(m.mutation_report)) {
      errors.push(`${rel} : mutation_report introuvable (${m.mutation_report ?? 'absent'}).`)
      continue
    }
    const openedMs = Date.parse(String(m.redteam_opened_at ?? ''))
    if (!Number.isFinite(openedMs)) {
      errors.push(`${rel} : redteam_opened_at doit être une date ISO-8601 valide.`)
      continue
    }

    const diff = JSON.parse(readFileSync(m.differential_report, 'utf8')) as {
      totalCases?: number
      unexplainedDivergences?: number
    }
    const mut = JSON.parse(readFileSync(m.mutation_report, 'utf8')) as {
      killScorePct?: number
    }

    const differentialCases = Number(diff.totalCases ?? 0)
    const unexplainedDivergences = Number(diff.unexplainedDivergences ?? -1)
    const mutationScorePct = Number(mut.killScorePct ?? 0)
    const acceptedCounterexamples = Array.isArray(m.accepted_counterexamples)
      ? m.accepted_counterexamples.length
      : 0

    const elapsedDays = Math.max(0, (now.getTime() - openedMs) / (1000 * 60 * 60 * 24))
    const eligibleAt = new Date(openedMs + MIN_REDTEAM_DAYS * 24 * 60 * 60 * 1000).toISOString()

    const meetsMechanical =
      differentialCases >= MIN_DIFFERENTIAL_CASES &&
      unexplainedDivergences === 0 &&
      mutationScorePct >= MIN_MUTATION_PCT &&
      acceptedCounterexamples === 0

    const eligible = meetsMechanical && elapsedDays >= MIN_REDTEAM_DAYS

    for (const legiarti of m.legal_units) {
      const entry: N4ArticleStatus = {
        legiarti,
        manifestId: m.id,
        differentialCases,
        unexplainedDivergences,
        mutationScorePct,
        redteamOpenedAt: new Date(openedMs).toISOString(),
        redteamEligibleAt: eligibleAt,
        elapsedDays: Math.round(elapsedDays * 100) / 100,
        acceptedCounterexamples,
        eligible,
      }
      if (eligible) eligibleN4.push(entry)
      else if (meetsMechanical) pendingN4.push(entry)
    }
  }

  return { ok: errors.length === 0, errors, eligibleN4, pendingN4 }
}

if (import.meta.main) {
  const res = runN4Checks('corpus')
  if (!res.ok) {
    for (const err of res.errors) console.error(`[N4 ECHEC] ${err}`)
    process.exit(1)
  }
  console.log(
    `[N4 OK] ${res.eligibleN4.length} article(s) éligibles N4 Éprouvé, ${res.pendingN4.length} en fenêtre red team 7 j.`,
  )
  for (const a of res.eligibleN4) {
    console.log(
      `  - ${a.legiarti} [ELIGIBLE N4] : ${a.differentialCases} cas (0 div.), mutation ${a.mutationScorePct} %, red team ${a.elapsedDays} j`,
    )
  }
  for (const a of res.pendingN4) {
    console.log(
      `  - ${a.legiarti} [RED TEAM EN COURS] : ${a.differentialCases} cas (0 div.), mutation ${a.mutationScorePct} %, ${a.elapsedDays}/7 j (échéance ${a.redteamEligibleAt})`,
    )
  }
}
