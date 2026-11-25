/**
 * `ref-morte-texte` — REF_MORTE par citations écrites dans le texte.
 *
 * Précision avant rappel : on ne retient que « article <numéro> » (ou une liste) dont la norme visée
 * est certaine — « du présent code », un des trois codes nommés, ou rien (même code que le texte).
 * Tout ce qui peut viser une autre norme (loi, décret, directive, annexe, sigle, « du même code »,
 * « précité ») est écarté et compté. L'article « 1er » sans désignation explicite est écarté aussi (c'est
 * presque toujours l'article 1er d'une loi). Un numéro sans préfixe L/R/D n'est jamais cherché dans le CSS ou
 * le CCH, et un numéro à préfixe jamais dans le CGI sans désignation explicite : le préfixe suffit à
 * trancher la norme et évite les faux positifs d'un numéro cité d'un autre code.
 * Un numéro absent de la base n'est pas jugé (il peut s'agir d'une version antérieure à LEGI).
 */
import { legifranceArticleUrl } from '@bugdeloi/core/legi'
import { hintsAround, legalUnit, lineageRef, versionRef } from '../certificate.ts'
import { citationsOf, type TextCitation } from '../citations.ts'
import { deadSubtype, inForceWithNum, lineagesWithNum, statusOf } from '../resolve.ts'
import { excerptAround } from '../text.ts'
import type {
  Candidate,
  Detector,
  Lineage,
  ScanOptions,
  ScanResult,
  SweepContext,
  Version,
} from '../types.ts'

export const NAME = 'ref-morte-texte'
export const VERSION = '1.1.0'

const PREFIXED = /^[ldra]\d/
const MAX_OCCURRENCES = 8

export function targetTextId(ctx: SweepContext, source: Version, c: TextCitation): string | null {
  const d = c.designation
  if (d.kind === 'other') return null
  // « l'article 1er » désigne presque toujours l'article 1er d'une loi : jamais jugé sans désignation explicite.
  if (c.num === '1' && d.kind === 'none') return null
  const prefixed = PREFIXED.test(c.num)
  if (d.kind === 'code') return ctx.codes.find((k) => k.code === d.code)?.textId ?? null
  // self ou aucune désignation : même code que le texte
  if (source.code === 'CGI') {
    if (prefixed && d.kind === 'none') return null // L./R./D. sans désignation dans le CGI : autre norme probable
    if (prefixed) return null // « L. 80 A du présent code » : numérotation absente du CGI
    return source.textId
  }
  return prefixed ? source.textId : null
}

export function scan(ctx: SweepContext, options: ScanOptions = {}): ScanResult {
  const candidates: Candidate[] = []
  const asOfByText = new Map(ctx.codes.map((c) => [c.textId, c.asOf]))
  // Compteurs d'occurrences (citations_*) et de couples (article citant, numéro cité) distincts (couples_*).
  const stats = {
    articles_controles: 0,
    citations_extraites: 0,
    ecartees_autre_norme: 0,
    ecartees_prefixe: 0,
    citations_jugees: 0,
    couples_inconnus_de_la_base: 0,
    couples_resolus: 0,
    couples_vivants: 0,
    couples_a_venir: 0,
    couples_morts: 0,
  }
  const subtypes: Record<string, number> = {}
  const designations: Record<string, number> = {}

  for (const source of ctx.inForce) {
    if (options.only && !options.only.has(source.id)) continue
    if (options.codes && !options.codes.has(source.code)) continue
    stats.articles_controles++
    const groups = new Map<string, { textId: string; num: string; cits: TextCitation[] }>()
    for (const c of citationsOf(source)) {
      stats.citations_extraites++
      const textId = targetTextId(ctx, source, c)
      if (!textId) {
        if (c.designation.kind === 'other') stats.ecartees_autre_norme++
        else stats.ecartees_prefixe++
        continue
      }
      const key = `${textId}|${c.num}`
      const g = groups.get(key) ?? { textId, num: c.num, cits: [] }
      g.cits.push(c)
      groups.set(key, g)
    }
    for (const g of groups.values()) {
      const lineages = lineagesWithNum(ctx, g.textId, g.num)
      if (lineages.length === 0) {
        stats.couples_inconnus_de_la_base++
        continue
      }
      stats.couples_resolus++
      stats.citations_jugees += g.cits.length
      // Une version en vigueur qui porte ce numéro prime sur une ancienne identité renumérotée.
      const current = inForceWithNum(lineages, g.num)[0]
      const st = statusOf(current ? [current, ...lineages.filter((l) => l !== current)] : lineages)
      if (st.cls === 'vivante') stats.couples_vivants++
      else if (st.cls === 'a_venir') stats.couples_a_venir++
      else {
        stats.couples_morts++
        const sub = deadSubtype(st.lineage)
        subtypes[sub] = (subtypes[sub] ?? 0) + 1
        const k = g.cits[0]?.designation.kind ?? 'none'
        designations[k] = (designations[k] ?? 0) + 1
        candidates.push(
          buildCandidate(ctx, source, g, st.lineage, st.alternates, sub, asOfByText.get(source.textId) ?? ''),
        )
      }
    }
  }
  return {
    candidates,
    stats: { ...stats, candidats_par_sous_type: subtypes, candidats_par_designation: designations },
  }
}

function buildCandidate(
  ctx: SweepContext,
  source: Version,
  g: { textId: string; num: string; cits: TextCitation[] },
  lineage: Lineage,
  alternates: Lineage[],
  subtype: string,
  asOf: string,
): Candidate {
  const first = g.cits[0] as TextCitation
  const occurrences = g.cits
    .slice(0, MAX_OCCURRENCES)
    .map((c) => excerptAround(source.contentText, c.start, c.end))
  const lineageIds = new Set([lineage, ...alternates].map((l) => l.id))
  const links = (ctx.citations.get(source.id) ?? []).filter((l) => {
    const target = l.targetId ? ctx.lineageOf.get(l.targetId) : undefined
    return target ? lineageIds.has(target.id) : false
  })
  const hints = g.cits
    .slice(0, MAX_OCCURRENCES)
    .flatMap((c) => hintsAround(source.contentText, c.start, c.end))
  const targetCode = lineage.code
  const proof = {
    method: `${NAME}@${VERSION}`,
    reading:
      "Numéro d'article cité dans le texte normalisé de la version ; résolu dans le code visé par son numéro normalisé (minuscules, sans points ni astérisque).",
    projection_date: asOf,
    source: { ...versionRef(source), text_sha256: source.textSha256 },
    citation: {
      raw: first.raw,
      normalized_num: g.num,
      target_text_id: g.textId,
      designation: first.designation,
      occurrence_count: g.cits.length,
      occurrences: occurrences.map((o, i) => ({
        start: o.start,
        end: o.end,
        cited: o.cited,
        excerpt: o.text,
        excerpt_offset: o.offset,
        range_role: g.cits[i]?.rangeRole ?? null,
      })),
    },
    target_lineage: lineageRef(lineage),
    other_lineages_with_same_num: alternates.map((l) => l.id),
    target_versions_in_force: 0,
    outcome: { subtype, last_version_etat: lineage.last.etat, last_version_end: lineage.last.dateFin },
    end_of_life_links_of_last_version: (ctx.endOfLife.get(lineage.last.id) ?? []).map((l) => ({
      type_lien: l.typeLien,
      sens: l.sens,
      target_id: l.targetId,
      target_num: l.targetNum,
      label: l.label,
    })),
    legi_link_to_target: {
      present: links.length > 0,
      links: links.map((l) => ({ target_id: l.targetId, target_num: l.targetNum, label: l.label })),
    },
    hints: { near_citation: hints, source_etat: source.etat },
    urls: {
      source: legifranceArticleUrl(source.id),
      last_version_of_target: legifranceArticleUrl(lineage.last.id),
    },
  }
  const end =
    lineage.last.dateFin && lineage.last.dateFin !== '2999-01-01' ? ` ; fin le ${lineage.last.dateFin}` : ''
  return {
    type: 'REF_MORTE',
    subtype,
    fingerprintParts: ['texte', source.id, g.textId, g.num],
    claim:
      `Au ${asOf}, le texte de l'article ${source.num ?? '(sans numéro)'} du ${source.code} (${source.id}) cite l'article « ${first.raw} » ` +
      `du ${targetCode} : aucune version de cet article n'est en vigueur, la dernière (${lineage.last.id}) a l'état ${lineage.last.etat ?? 'inconnu'}${end}.`,
    legalUnits: [legalUnit(source), legalUnit(lineage.last)],
    sourceId: source.id,
    proof,
  }
}

export const detector: Detector = {
  name: NAME,
  version: VERSION,
  family: 'texte',
  types: ['REF_MORTE'],
  describe:
    "Numéros d'articles cités dans le texte (« l'article L. 521-1 du présent code ») qui désignent un article du même code sans version en vigueur.",
  scan,
}
