// Couche Doctrine (AGENTS.md §3.2) : index BOFiP → LEGIARTI.
// L'index est une donnée de navigation. Il ne cite aucun paragraphe BOFiP et aucun extrait officiel
// qui ne figure pas dans une source épinglée. La doctrine reste séparée de la loi.
import { join } from 'node:path'

export type BofipSource = 'inria_catala_examples' | 'cgi_noyau_ir'

export interface BofipDoctrineEntry {
  bofipRef: string
  title: string
  url: string
  source: BofipSource
  note: string
  /** Provenance vérifiable de l'entrée (seulement pour `inria_catala_examples`). */
  evidence?: { id: string; file: string; line: number; sourceCommit: string }
}

export interface BofipIndex {
  generatedFrom: { groundTruth: string; sourceUrl: string; sourceCommit: string; coreMappings: string }
  totalArticles: number
  totalReferences: number
  articles: Record<string, BofipDoctrineEntry[]>
}

interface GroundTruthItem {
  id: string
  kind: string
  file: string
  line: number
  nearestLegiarti: string | null
  bofipRef?: string
}

interface GroundTruth {
  sourceUrl: string
  sourceCommit: string
  items: GroundTruthItem[]
}

const SERIES_TITLES: Record<string, string> = {
  'IR-LIQ': 'Impôt sur le revenu – Liquidation',
  'IR-BASE': 'Impôt sur le revenu – Base d’imposition',
  'IR-CHAMP': 'Impôt sur le revenu – Champ d’application',
  'IR-PAS': 'Impôt sur le revenu – Prélèvement à la source',
  'BIC-PVMV': 'Bénéfices industriels et commerciaux – Plus-values et moins-values',
  'BIC-CHAMP': 'Bénéfices industriels et commerciaux – Champ d’application',
  'BNC-BASE': 'Bénéfices non commerciaux – Base d’imposition',
  'BNC-CHAMP': 'Bénéfices non commerciaux – Champ d’application',
  'RSA-CHAMP': 'Revenus salariaux et assimilés – Champ d’application',
  'RSA-BASE': 'Revenus salariaux et assimilés – Base d’imposition',
  'RSA-ES': 'Revenus salariaux et assimilés – Exonérations et sommes exclues',
  'RSA-PENS': 'Revenus salariaux et assimilés – Pensions et rentes viagères',
}

export const BOFIP_REF_PATTERN = /^BOI-[A-Z]+-[A-Z]+(?:-\d+)+$/

/** Titre du thème, dérivé de la série (`BOI-<IMPÔT>-<SÉRIE>-…`). Ce n'est pas le titre exact du bulletin. */
export function seriesTitle(bofipRef: string): string {
  const [, impot, serie] = bofipRef.split('-')
  const key = `${impot}-${serie}`
  return `BOFiP – ${SERIES_TITLES[key] ?? `Série ${key}`} (${bofipRef})`
}

export function bofipUrl(bofipRef: string): string {
  return `https://bofip.impots.gouv.fr/bofip/ext/pgp/search?q=${bofipRef}`
}

const DOCTRINE_CAVEAT =
  'La doctrine est une interprétation administrative distincte de la loi ; un écart avec le texte est un candidat DIVERGENCE_DOCTRINE.'

/** Rattachements thématiques des articles du noyau IR 2026 (niveau série, pas de paragraphe). */
export const CORE_MAPPINGS: { legiarti: string; article: string; bofipRefs: string[] }[] = [
  { legiarti: 'LEGIARTI000054373592', article: '193', bofipRefs: ['BOI-IR-LIQ-20-10'] },
  { legiarti: 'LEGIARTI000033817781', article: '194', bofipRefs: ['BOI-IR-LIQ-10-20-10'] },
  {
    legiarti: 'LEGIARTI000053542636',
    article: '197',
    bofipRefs: ['BOI-IR-LIQ-20-10', 'BOI-IR-LIQ-20-20-20', 'BOI-IR-LIQ-20-20-30'],
  },
  { legiarti: 'LEGIARTI000051219510', article: '1657', bofipRefs: ['BOI-IR-LIQ-20-20-40'] },
]

export function buildIndex(groundTruth: GroundTruth, groundTruthPath: string): BofipIndex {
  const byArticle = new Map<string, Map<string, BofipDoctrineEntry>>()
  const add = (legiarti: string, entry: BofipDoctrineEntry) => {
    const refs = byArticle.get(legiarti) ?? new Map<string, BofipDoctrineEntry>()
    // Premier rattachement conservé : pas de doublon (article, référence).
    if (!refs.has(entry.bofipRef)) refs.set(entry.bofipRef, entry)
    byArticle.set(legiarti, refs)
  }

  for (const core of CORE_MAPPINGS) {
    for (const bofipRef of core.bofipRefs) {
      add(core.legiarti, {
        bofipRef,
        title: seriesTitle(bofipRef),
        url: bofipUrl(bofipRef),
        source: 'cgi_noyau_ir',
        note: `Référence BOFiP associée à l’article ${core.article} du CGI (noyau IR 2026), au niveau du thème ; aucun paragraphe n’est cité. ${DOCTRINE_CAVEAT}`,
      })
    }
  }

  for (const item of groundTruth.items) {
    if (item.kind !== 'dependance_bofip' || !item.bofipRef || !item.nearestLegiarti) continue
    if (!BOFIP_REF_PATTERN.test(item.bofipRef)) continue
    add(item.nearestLegiarti, {
      bofipRef: item.bofipRef,
      title: seriesTitle(item.bofipRef),
      url: bofipUrl(item.bofipRef),
      source: 'inria_catala_examples',
      note: `Référence BOFiP citée dans les commentaires Catala d’Inria/DGFiP (${item.file}, ligne ${item.line}) près de cet article. ${DOCTRINE_CAVEAT}`,
      evidence: { id: item.id, file: item.file, line: item.line, sourceCommit: groundTruth.sourceCommit },
    })
  }

  const articles: Record<string, BofipDoctrineEntry[]> = {}
  let totalReferences = 0
  for (const legiarti of [...byArticle.keys()].sort()) {
    const entries = [...(byArticle.get(legiarti)?.values() ?? [])].sort((a, b) =>
      a.bofipRef.localeCompare(b.bofipRef),
    )
    articles[legiarti] = entries
    totalReferences += entries.length
  }

  return {
    generatedFrom: {
      groundTruth: groundTruthPath,
      sourceUrl: groundTruth.sourceUrl,
      sourceCommit: groundTruth.sourceCommit,
      coreMappings: 'corpus/doctrine/build-bofip-index.ts#CORE_MAPPINGS',
    },
    totalArticles: Object.keys(articles).length,
    totalReferences,
    articles,
  }
}

if (import.meta.main) {
  const root = join(import.meta.dir, '..', '..')
  const groundTruthPath = 'replications/c0.4/ground-truth.json'
  const groundTruth = (await Bun.file(join(root, groundTruthPath)).json()) as GroundTruth
  const index = buildIndex(groundTruth, groundTruthPath)
  await Bun.write(join(import.meta.dir, 'bofip-index.json'), `${JSON.stringify(index, null, 2)}\n`)
  console.log(`bofip-index.json : ${index.totalArticles} articles, ${index.totalReferences} références`)
}
