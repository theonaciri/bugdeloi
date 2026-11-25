/**
 * `ref-morte-liens` — REF_MORTE par liens LEGI.
 *
 * Sens des liens (établi sur les données, contrôlé par symétrie et sur le texte de CSS L521-1) :
 * pour un lien `CITATION`, `sens = 'source'` signifie « CET article cite la cible » ;
 * `sens = 'cible'` signifie « la cible cite cet article ». Seuls les `source` sont lus.
 *
 * Un lien pointe vers une *version*. La cible est résolue au niveau de l'*article* (lignée, voir
 * context.ts). Une citation n'est candidate que si **aucune** version de la lignée cible n'est en
 * vigueur à la date de projection de son code et qu'aucune n'est annoncée pour plus tard.
 * Les cibles hors des codes ingérés ne sont pas résolues : elles sont comptées (couverture), jamais
 * jugées.
 *
 * Écart lien / texte : beaucoup de liens LEGI pointent vers un article que le texte actuel de la version
 * ne cite pas (liens hérités d'une rédaction antérieure). Si le numéro de la cible mort ne figure pas
 * dans le texte, il n'y a pas de renvoi mort à lire : le constat est une note (`notes.ecarts_lien_texte`),
 * pas un finding.
 */
import { legifranceArticleUrl } from '@bugdeloi/core/legi'
import { hintsAround, legalUnit, lineageRef, versionRef } from '../certificate.ts'
import { citationsOf, normalizeNum } from '../citations.ts'
import { deadSubtype, statusOf } from '../resolve.ts'
import { excerptAround } from '../text.ts'
import type {
  Candidate,
  Detector,
  Lineage,
  LinkRow,
  ScanOptions,
  ScanResult,
  SweepContext,
  Version,
} from '../types.ts'

export const NAME = 'ref-morte-liens'
export const VERSION = '1.0.0'

export type LinkClass =
  | 'vivante'
  | 'a_venir'
  | 'morte'
  | 'inconnue_dans_nos_codes'
  | 'hors_codes_ingeres'
  | 'texte_ou_section'
  | 'sans_cible'

/** Comment la cible a été rattachée à un article. */
export type Via = 'version' | 'version_ids' | 'numero'

export interface Resolution {
  cls: LinkClass
  via?: Via
  /** Lignée retenue (la plus récemment terminée si plusieurs lignées portent le numéro). */
  lineage?: Lineage
  /** Autres lignées de même numéro (réutilisation d'un numéro), pour le certificat. */
  alternates?: Lineage[]
  cited?: Version
}

/**
 * Résout la cible d'un lien. Un lien désigne une version précise ; la base n'a pas toujours cette
 * version (le stock ne contient pas tout l'historique). Ordre : version connue → identifiant listé par
 * un bloc VERSIONS → à défaut, numéro et code portés par le lien. Une cible dont le numéro est porté par
 * plusieurs lignées n'est « morte » que si toutes le sont.
 */
export function classifyLink(ctx: SweepContext, link: LinkRow): Resolution {
  const id = link.targetId
  if (!id) return { cls: 'sans_cible' }
  if (!id.startsWith('LEGIARTI')) return { cls: 'texte_ou_section' }
  const cited = ctx.versions.get(id)
  const lineage = ctx.lineageOf.get(id)
  if (lineage) {
    const st = statusOf([lineage])
    return { ...st, via: cited ? 'version' : 'version_ids', cited, alternates: [] }
  }
  const ingested = ctx.codes.some((c) => c.textId === link.targetCid)
  if (!ingested) return { cls: 'hors_codes_ingeres' }
  const byNum = link.targetNum
    ? ctx.lineagesByNum.get(`${link.targetCid}|${normalizeNum(link.targetNum)}`)
    : undefined
  if (!byNum || byNum.length === 0) return { cls: 'inconnue_dans_nos_codes' }
  return { ...statusOf(byNum), via: 'numero' }
}

const linkRef = (l: LinkRow) => ({
  type_lien: l.typeLien,
  sens: l.sens,
  target_id: l.targetId,
  target_cid: l.targetCid,
  target_num: l.targetNum,
  target_nature: l.targetNature,
  label: l.label,
})

export function scan(ctx: SweepContext, options: ScanOptions = {}): ScanResult {
  const candidates: Candidate[] = []
  const gaps: Array<Record<string, unknown>> = []
  const classes: Record<string, number> = {}
  const subtypes: Record<string, number> = {}
  const perCode: Record<string, number> = {}
  const via: Record<string, number> = {}
  let articles = 0
  const asOfByText = new Map(ctx.codes.map((c) => [c.textId, c.asOf]))

  for (const source of ctx.inForce) {
    if (options.only && !options.only.has(source.id)) continue
    if (options.codes && !options.codes.has(source.code)) continue
    articles++
    perCode[source.code] = (perCode[source.code] ?? 0) + 1
    const dead = new Map<string, { lineage: Lineage; links: Array<{ link: LinkRow; res: Resolution }> }>()
    for (const link of ctx.citations.get(source.id) ?? []) {
      const res = classifyLink(ctx, link)
      classes[res.cls] = (classes[res.cls] ?? 0) + 1
      if (res.via) via[res.via] = (via[res.via] ?? 0) + 1
      if (res.cls !== 'morte' || !res.lineage) continue
      const entry = dead.get(res.lineage.id) ?? { lineage: res.lineage, links: [] }
      entry.links.push({ link, res })
      dead.set(res.lineage.id, entry)
    }
    for (const { lineage, links } of dead.values()) {
      const candidate = buildCandidate(
        source,
        lineage,
        links,
        deadSubtype(lineage),
        ctx,
        asOfByText.get(source.textId) ?? '',
      )
      if (candidate === null) {
        // Lien vers un article mort, mais le numéro n'est pas dans le texte : écart de métadonnées DILA,
        // pas une anomalie du texte. Publié en note, jamais en finding.
        gaps.push({
          source_id: source.id,
          source_num: source.num,
          code: source.code,
          target_lineage: lineage.id,
          target_num: lineage.last.num,
          target_code: lineage.last.code,
          dead_subtype: deadSubtype(lineage),
          last_version_etat: lineage.last.etat,
          last_version_end: lineage.last.dateFin,
          labels: links.map((l) => l.link.label),
        })
        continue
      }
      candidates.push(candidate)
      subtypes[candidate.subtype] = (subtypes[candidate.subtype] ?? 0) + 1
    }
  }
  const resolved = (classes.vivante ?? 0) + (classes.a_venir ?? 0) + (classes.morte ?? 0)
  const total = Object.values(classes).reduce((a, b) => a + b, 0)
  return {
    candidates,
    notes: { ecarts_lien_texte: gaps },
    stats: {
      articles_controles: articles,
      articles_par_code: perCode,
      liens_citation_sortants: total,
      liens_par_classe: classes,
      liens_resolus: resolved,
      resolution_par: via,
      candidats_par_sous_type: subtypes,
      liens_morts_non_confirmes_par_le_texte: gaps.length,
    },
  }
}

function buildCandidate(
  source: Version,
  lineage: Lineage,
  links: Array<{ link: LinkRow; res: Resolution }>,
  subtype: string,
  ctx: SweepContext,
  asOf: string,
): Candidate | null {
  const wanted = new Set<string>(lineage.nums)
  for (const { link } of links) if (link.targetNum) wanted.add(normalizeNum(link.targetNum))
  const mentions = citationsOf(source)
    .filter((c) => wanted.has(c.num) && c.designation.kind !== 'other')
    .map((c) => ({ ...excerptAround(source.contentText, c.start, c.end), designation: c.designation }))
  const first = mentions[0]
  if (!first) return null
  const hints = hintsAround(source.contentText, first.start, first.end)
  const endedBefore =
    lineage.last.dateFin && source.dateDebut
      ? lineage.last.dateFin <= source.dateDebut
        ? 'avant_le_debut_de_la_version_citante'
        : 'apres_le_debut_de_la_version_citante'
      : 'indeterminee'
  const eol = (ctx.endOfLife.get(lineage.last.id) ?? []).map(linkRef)
  const proof = {
    method: `${NAME}@${VERSION}`,
    reading:
      "Lien LEGI CITATION de sens « source » : l'article porteur cite la cible. La cible est résolue au niveau article (groupe de versions).",
    projection_date: asOf,
    source: { ...versionRef(source), text_sha256: source.textSha256 },
    links: links.map(({ link, res }) => ({
      ...linkRef(link),
      resolved_by: res.via,
      cited_version: res.cited ? versionRef(res.cited) : null,
      other_lineages_with_same_num: (res.alternates ?? []).map((l) => l.id),
    })),
    target_lineage: lineageRef(lineage),
    target_versions_in_force: 0,
    outcome: {
      subtype,
      last_version_etat: lineage.last.etat,
      last_version_end: lineage.last.dateFin,
    },
    end_of_life_links_of_last_version: eol,
    order_of_dates: endedBefore,
    text_mentions: {
      count: mentions.length,
      first: {
        start: first.start,
        end: first.end,
        cited: first.cited,
        excerpt: first.text,
        excerpt_offset: first.offset,
        designation: first.designation,
      },
    },
    hints: {
      near_citation: hints,
      source_etat: source.etat,
    },
    urls: {
      source: legifranceArticleUrl(source.id),
      last_version_of_target: legifranceArticleUrl(lineage.last.id),
    },
  }
  const num = (v: Version) => v.num ?? '(sans numéro)'
  const end =
    lineage.last.dateFin && lineage.last.dateFin !== '2999-01-01' ? ` ; fin le ${lineage.last.dateFin}` : ''
  return {
    type: 'REF_MORTE',
    subtype,
    fingerprintParts: ['liens', source.id, lineage.id],
    claim:
      `Au ${asOf}, l'article ${num(source)} du ${source.code} (${source.id}) a un lien de citation vers ` +
      `l'article ${num(lineage.last)} du ${lineage.last.code} (${lineage.last.id}) : aucune version de cet article n'est en vigueur, ` +
      `la dernière a l'état ${lineage.last.etat ?? 'inconnu'}${end}. Le texte de la version cite ce numéro.`,
    legalUnits: [legalUnit(source), legalUnit(lineage.last)],
    sourceId: source.id,
    proof,
  }
}

export const detector: Detector = {
  name: NAME,
  version: VERSION,
  family: 'liens',
  types: ['REF_MORTE'],
  describe:
    "Citations (liens LEGI CITATION, sens source) d'une version en vigueur vers un article dont aucune version n'est en vigueur.",
  scan,
}
