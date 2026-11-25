/**
 * Index des articles des trois codes (lu depuis les XML DILA) et verdict par candidat REF_MORTE.
 * Fonctions pures : `checks.test.ts` les exerce sur de petits XML construits.
 */
import {
  type ArticleRecord,
  CODE_BY_TEXT,
  type CodeName,
  inForce,
  normalizeForMatch,
  normalizeNum,
  subtypeOf,
  TERMINAL_STATES,
  type VersionRef,
} from './legi-xml.ts'

export type Verdict = 'confirmé' | 'infirmé' | 'indéterminé'

/** Faits d'une version, tirés de son propre fichier (`file`) ou à défaut d'un bloc VERSIONS (`versions`). */
export interface VersionFacts {
  id: string
  num: string
  etat: string
  debut: string
  fin: string
  code: CodeName
  from: 'file' | 'versions'
}

export class LegiIndex {
  readonly files = new Map<string, { rec: ArticleRecord; code: CodeName }>()
  private readonly fromVersions = new Map<string, VersionRef & { code: CodeName }>()
  private readonly parent = new Map<string, string>()
  private readonly byNum = new Map<string, Set<string>>()
  /** Écarts entre les métadonnées d'un fichier et celles que d'autres fichiers donnent dans VERSIONS. */
  metaConflicts = 0

  add(rec: ArticleRecord, code: CodeName): void {
    this.files.set(rec.id, { rec, code })
    this.indexNum(code, rec.num, rec.id)
    for (const v of rec.versions) {
      if (!this.fromVersions.has(v.id)) this.fromVersions.set(v.id, { ...v, code })
      this.union(rec.id, v.id)
      this.indexNum(code, v.num, v.id)
    }
  }

  /** À appeler une fois tous les fichiers ajoutés. */
  finish(): void {
    for (const [id, v] of this.fromVersions) {
      const f = this.files.get(id)?.rec
      if (f && (f.etat !== v.etat || f.debut !== v.debut || f.fin !== v.fin)) this.metaConflicts++
    }
  }

  private indexNum(code: CodeName, num: string, id: string): void {
    if (!num) return
    const key = `${code}:${normalizeNum(num)}`
    let s = this.byNum.get(key)
    if (!s) {
      s = new Set()
      this.byNum.set(key, s)
    }
    s.add(id)
  }

  private find(x: string): string {
    let r = x
    while (true) {
      const p = this.parent.get(r)
      if (p === undefined || p === r) break
      r = p
    }
    // compression
    let c = x
    while (c !== r) {
      const p = this.parent.get(c) ?? r
      this.parent.set(c, r)
      c = p
    }
    return r
  }

  private union(a: string, b: string): void {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent.set(ra, rb)
  }

  /** L'identifiant est-il connu (fichier ou bloc VERSIONS) ? */
  knows(id: string): boolean {
    return this.files.has(id) || this.fromVersions.has(id)
  }

  facts(id: string): VersionFacts | null {
    const f = this.files.get(id)
    if (f) {
      const r = f.rec
      return { id, num: r.num, etat: r.etat, debut: r.debut, fin: r.fin, code: f.code, from: 'file' }
    }
    const v = this.fromVersions.get(id)
    if (v) return { id, num: v.num, etat: v.etat, debut: v.debut, fin: v.fin, code: v.code, from: 'versions' }
    return null
  }

  private idsCache: string[] | null = null
  private lineageCache: Map<string, string[]> | null = null

  private allIds(): string[] {
    if (!this.idsCache) this.idsCache = [...new Set([...this.files.keys(), ...this.fromVersions.keys()])]
    return this.idsCache
  }

  /** Lignées regroupées par racine (calcul unique, puis lecture). */
  lineageOf(id: string): string[] {
    if (!this.knows(id)) return []
    if (!this.lineageCache) {
      this.lineageCache = new Map()
      for (const x of this.allIds()) {
        const r = this.find(x)
        let l = this.lineageCache.get(r)
        if (!l) {
          l = []
          this.lineageCache.set(r, l)
        }
        l.push(x)
      }
    }
    return this.lineageCache.get(this.find(id)) ?? []
  }

  /** Numéros (bruts) d'un code dont la forme normalisée commence par `prefix` (diagnostic). */
  numsStartingWith(code: CodeName, prefix: string): string[] {
    const p = `${code}:${normalizeNum(prefix)}`
    return [...this.byNum.keys()].filter((k) => k.startsWith(p)).map((k) => k.slice(code.length + 1))
  }

  idsWithNum(code: CodeName, num: string): string[] {
    return [...(this.byNum.get(`${code}:${normalizeNum(num)}`) ?? [])]
  }
}

export type TargetClaim =
  | { kind: 'link'; id: string | null; num: string | null; textCid: string | null }
  | { kind: 'num'; num: string; textCid: string }

export interface Candidate {
  id: string
  detector: string
  subtype: string
  sourceId: string
  excerpts: string[]
  target: TargetClaim
  /** Identifiant de la dernière version de la cible selon le certificat (pour information). */
  claimedLastId: string | null
}

export interface CheckResult {
  id: string
  detector: string
  subtype: string
  verdict: Verdict
  reason: string
  facts: {
    source?: VersionFacts | null
    source_in_force?: boolean
    excerpts_found?: number
    excerpts_total?: number
    excerpt_match?: 'exact' | 'sans_espaces' | 'aucun'
    source_has_legi_link_to_target?: boolean | null
    target_code?: CodeName | null
    target_versions?: number
    target_lineages?: number
    target_in_force?: VersionFacts[]
    target_announced?: VersionFacts[]
    target_last?: VersionFacts | null
    target_last_subtype?: string | null
    claimed_last_id?: string | null
  }
}

function lastVersion(vs: VersionFacts[]): VersionFacts | null {
  let best: VersionFacts | null = null
  for (const v of vs) {
    if (v.etat === 'MODIFIE_MORT_NE') continue
    if (!best || v.debut > best.debut || (v.debut === best.debut && v.fin > best.fin)) best = v
  }
  return best
}

function describe(v: VersionFacts): string {
  return `${v.id} (n° ${v.num || '?'}, ${v.etat}, ${v.debut} → ${v.fin}, ${v.from === 'file' ? 'fichier article' : 'bloc VERSIONS'})`
}

export function checkCandidate(c: Candidate, idx: LegiIndex, refDate: string): CheckResult {
  const base = { id: c.id, detector: c.detector, subtype: c.subtype }
  const facts: CheckResult['facts'] = {}
  const out = (verdict: Verdict, reason: string): CheckResult => ({ ...base, verdict, reason, facts })

  // (a) version source
  const srcFile = idx.files.get(c.sourceId)
  if (!srcFile) return out('indéterminé', `version source ${c.sourceId} absente des XML des trois codes`)
  const src = idx.facts(c.sourceId)
  facts.source = src
  facts.source_in_force = src ? inForce(src, refDate) : false
  if (src && !facts.source_in_force) {
    return out('infirmé', `version source non en vigueur au ${refDate} selon son XML : ${describe(src)}`)
  }

  // (b) extrait
  const text = srcFile.rec.text ?? ''
  const compact = text.replace(/ /g, '')
  let exact = 0
  let loose = 0
  for (const e of c.excerpts) {
    const n = normalizeForMatch(e)
    if (!n) continue
    if (text.includes(n)) exact++
    else if (compact.includes(n.replace(/ /g, ''))) loose++
  }
  facts.excerpts_total = c.excerpts.length
  facts.excerpts_found = exact + loose
  facts.excerpt_match = exact + loose === 0 ? 'aucun' : loose === 0 ? 'exact' : 'sans_espaces'
  if (c.excerpts.length > 0 && exact + loose === 0) {
    return out(
      'infirmé',
      `aucun des ${c.excerpts.length} extraits cités n'est dans le texte XML de ${c.sourceId}`,
    )
  }
  if (c.excerpts.length === 0) return out('indéterminé', 'le certificat ne cite aucun extrait')

  // (c) cible
  const code =
    c.target.textCid && CODE_BY_TEXT[c.target.textCid]
      ? CODE_BY_TEXT[c.target.textCid]
      : c.target.kind === 'link' && c.target.id
        ? (idx.facts(c.target.id)?.code ?? null)
        : null
  facts.target_code = code ?? null
  if (!code) return out('indéterminé', `cible hors des trois codes (${c.target.textCid ?? 'texte inconnu'})`)

  const ids = new Set<string>()
  const lineageRoots: string[][] = []
  const addLineage = (id: string) => {
    const l = idx.lineageOf(id)
    if (l.length && !l.some((x) => ids.has(x))) lineageRoots.push(l)
    for (const x of l) ids.add(x)
  }
  let primary: string[] = []
  if (c.target.kind === 'link' && c.target.id && idx.knows(c.target.id)) {
    primary = idx.lineageOf(c.target.id)
    addLineage(c.target.id)
  }
  const num =
    c.target.num ?? (c.target.kind === 'link' && c.target.id ? (idx.facts(c.target.id)?.num ?? null) : null)
  if (num) {
    for (const id of idx.idsWithNum(code, num)) {
      if (idx.facts(id)?.code !== code) continue
      addLineage(id)
    }
    if (primary.length === 0) primary = [...ids]
  }
  if (ids.size === 0) {
    return out(
      'indéterminé',
      `cible introuvable dans les XML du ${code} (id ${c.target.kind === 'link' ? (c.target.id ?? '—') : '—'}, n° ${num ?? '—'})`,
    )
  }

  const linkTargetId = c.target.kind === 'link' ? c.target.id : null
  facts.source_has_legi_link_to_target =
    linkTargetId && srcFile.rec.links ? srcFile.rec.links.some((l) => l.id === linkTargetId) : null

  const all = [...ids].map((id) => idx.facts(id)).filter((v): v is VersionFacts => v !== null)
  facts.target_versions = all.length
  facts.target_lineages = lineageRoots.length
  const alive = all.filter((v) => inForce(v, refDate))
  facts.target_in_force = alive
  facts.target_announced = all.filter((v) => v.debut > refDate && !TERMINAL_STATES.has(v.etat))
  const primaryFacts = primary.map((id) => idx.facts(id)).filter((v): v is VersionFacts => v !== null)
  const last = lastVersion(primaryFacts.length ? primaryFacts : all)
  facts.target_last = last
  facts.target_last_subtype = last ? subtypeOf(last.etat) : null
  facts.claimed_last_id = c.claimedLastId

  if (alive.length > 0) {
    const sameNum = alive.filter((v) => !primary.includes(v.id))
    const which = sameNum.length > 0 && primary.length > 0 ? ' (article du même numéro, autre lignée)' : ''
    return out(
      'infirmé',
      `la cible a une version en vigueur au ${refDate}${which} : ${alive.map(describe).join(' ; ')}`,
    )
  }
  if ((facts.target_announced?.length ?? 0) > 0) {
    return out(
      'infirmé',
      `la cible a une version annoncée après le ${refDate} : ${facts.target_announced?.map(describe).join(' ; ')}`,
    )
  }
  if (!last) return out('indéterminé', 'aucune version datable de la cible')
  if (!TERMINAL_STATES.has(last.etat)) {
    // Ex. MODIFIE : l'état annonce une version suivante que les XML ne contiennent pas. L'absence de
    // version en vigueur peut venir d'un trou des données plutôt que de la fin de l'article.
    return out(
      'indéterminé',
      `dernier état non terminal « ${last.etat} » sans version suivante dans les XML (lignée incomplète) : ${describe(last)}`,
    )
  }
  const sub = subtypeOf(last.etat)
  if (sub !== c.subtype) {
    return out(
      'infirmé',
      `dernier état de la cible « ${sub} » ≠ sous-type annoncé « ${c.subtype} » : ${describe(last)}`,
    )
  }
  return out(
    'confirmé',
    `source en vigueur, extrait retrouvé (${facts.excerpt_match}), aucune des ${all.length} versions de la cible (${lineageRoots.length} lignée(s)) n'est en vigueur ; dernière : ${describe(last)}`,
  )
}

/** Lecture des énoncés à contrôler depuis un certificat C0.2 (les faits viennent ensuite des XML). */
export function candidateFromCertificate(
  id: string,
  detector: string,
  cert: Record<string, unknown>,
): Candidate | null {
  const proof = (cert.proof ?? {}) as Record<string, unknown>
  const source = (proof.source ?? {}) as Record<string, unknown>
  const sourceId = String(cert.source_id ?? source.id ?? '')
  if (!sourceId) return null
  const subtype = String(cert.subtype ?? '')
  const lineage = (proof.target_lineage ?? {}) as Record<string, unknown>
  const last = (lineage.derniere_version ?? {}) as Record<string, unknown>
  const claimedLastId = typeof last.id === 'string' ? last.id : null
  const excerpts: string[] = []
  const citation = proof.citation as Record<string, unknown> | undefined
  if (citation) {
    for (const o of (citation.occurrences ?? []) as Record<string, unknown>[]) {
      if (typeof o.excerpt === 'string') excerpts.push(o.excerpt)
    }
    return {
      id,
      detector,
      subtype,
      sourceId,
      excerpts,
      target: {
        kind: 'num',
        num: String(citation.normalized_num ?? citation.raw ?? ''),
        textCid: String(citation.target_text_id ?? ''),
      },
      claimedLastId,
    }
  }
  const links = (proof.links ?? []) as Record<string, unknown>[]
  const link = links[0]
  if (!link) return null
  const mentions = (proof.text_mentions ?? {}) as Record<string, unknown>
  const first = mentions.first as Record<string, unknown> | undefined
  if (first && typeof first.excerpt === 'string') excerpts.push(first.excerpt)
  return {
    id,
    detector,
    subtype,
    sourceId,
    excerpts,
    target: {
      kind: 'link',
      id: typeof link.target_id === 'string' ? link.target_id : null,
      num: typeof link.target_num === 'string' ? link.target_num : null,
      textCid: typeof link.target_cid === 'string' ? link.target_cid : null,
    },
    claimedLastId,
  }
}
