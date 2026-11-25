import type { FindingType } from '@bugdeloi/core/findings'

/** Une version d'article (un LEGIARTI). Le contenu n'est chargé que pour les versions en vigueur. */
export interface Version {
  id: string
  textId: string
  /** Sigle du code (CGI, CSS, CCH). */
  code: string
  num: string | null
  etat: string | null
  dateDebut: string | null
  dateFin: string | null
  /** Bloc VERSIONS de cette version : incomplet pour les anciennes versions (voir docs/notes/sweep.md). */
  versionIds: string[]
  textSha256: string
  inForce: boolean
  /** Texte normalisé (`normalizeLegalText`) — celui dont l'empreinte est `textSha256`. */
  contentText: string
  /** Alinéas (un par `<p>`), guillemets « » conservés. Vide hors vigueur. */
  paragraphs: string[]
}

/** Un article au sens juridique : ensemble des versions reliées entre elles par les blocs VERSIONS. */
export interface Lineage {
  /** Plus petit LEGIARTI du groupe (stable). */
  id: string
  textId: string
  code: string
  /** Versions connues en base, de la plus ancienne à la plus récente. */
  versions: Version[]
  /** Numéros normalisés portés par les versions. */
  nums: string[]
  inForce: Version[]
  /** Au moins une version commence après la date de projection (et n'est pas exclue par son état). */
  upcoming: boolean
  /** Dernière version connue (date de début la plus récente) : donne le « sous-type » de mort. */
  last: Version
}

export interface LinkRow {
  articleId: string
  typeLien: string
  sens: string
  targetId: string | null
  targetCid: string | null
  targetNum: string | null
  targetNature: string | null
  label: string | null
}

export interface CodeState {
  textId: string
  code: string
  title: string
  asOf: string
  archive: string
  archiveSha256: string
}

export interface SweepContext {
  codes: CodeState[]
  versions: Map<string, Version>
  lineageOf: Map<string, Lineage>
  lineages: Lineage[]
  /** Clé `<LEGITEXT>|<numéro normalisé>` → lignées portant ce numéro (une version suffit). */
  lineagesByNum: Map<string, Lineage[]>
  /** Versions en vigueur, avec contenu. */
  inForce: Version[]
  /** Liens `CITATION` de sens `source` (l'article cite la cible), par version en vigueur. */
  citations: Map<string, LinkRow[]>
  /** Liens de fin de vie (ABROGE, TRANSFERE, DEPLACE, PERIME, DISJOINT, …) par version. */
  endOfLife: Map<string, LinkRow[]>
}

/** Un candidat produit par un détecteur, avant insertion. */
export interface Candidate {
  type: FindingType
  subtype: string
  /** Composants stables de l'empreinte (la version du détecteur n'en fait pas partie). */
  fingerprintParts: string[]
  claim: string
  /** `LEGIARTI…@<date de début>` */
  legalUnits: string[]
  /** Version en vigueur dans laquelle l'anomalie est lue : sert au rejeu. */
  sourceId: string
  /** Tout ce qui est déterministe : recalculable depuis la base. Hachée pour le rejeu. */
  proof: Record<string, unknown>
}

export interface ScanOptions {
  /** Restreint le balayage à ces versions (rejeu). */
  only?: ReadonlySet<string>
  /** Restreint aux articles de ces codes (sigles). Les cibles restent résolues dans tous les codes. */
  codes?: ReadonlySet<string>
}

export interface ScanResult {
  candidates: Candidate[]
  /** Dénombrements propres au détecteur (couverture, exclusions…). */
  stats: Record<string, number | Record<string, number>>
  /** Constats qui ne sont pas des findings (jamais insérés en base), p. ex. écarts lien LEGI / texte. */
  notes?: Record<string, Array<Record<string, unknown>>>
}

export interface Detector {
  name: string
  version: string
  /** Famille d'empreinte : stable d'une version à l'autre du détecteur. */
  family: string
  types: FindingType[]
  describe: string
  scan(ctx: SweepContext, options?: ScanOptions): ScanResult
}

export const detectorId = (d: Pick<Detector, 'name' | 'version'>) => `${d.name}@${d.version}`
