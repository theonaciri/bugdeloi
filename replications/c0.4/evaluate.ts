import { join } from 'node:path'
import { normalizeLegalText, sha256Hex } from '../../packages/core/src/legi.ts'
import { sourceCommit } from '../c0.1/source.ts'
import type { GroundTruth, GroundTruthItem, Kind } from './extract-ground-truth.ts'
import {
  type BlindPacket,
  type Category,
  type Observation,
  packetFile,
  parsePacket,
  parseSubmission,
  writeJson,
} from './packet.ts'

const caveat = 'Un compte, pas une probabilité'
const kinds: Kind[] = ['todo_juridique', 'dependance_bofip']

interface Topic {
  name: string
  categories: Category[]
  // Le premier motif ancre le signalement dans la citation LEGI.
  cue: RegExp
  notes: RegExp
}

const topics: Topic[] = [
  {
    name: 'charge effective',
    categories: ['appreciation', 'perimetre'],
    cue: /charge effective|effectivement la charge/,
    notes: /charge effective|effectivement la charge/,
  },
  {
    name: 'charge principale ou exclusive',
    categories: ['appreciation', 'perimetre', 'calcul'],
    cue: /charge.{0,35}(?:principal|exclusi)|(?:exclusi|principal).{0,35}charge/,
    notes: /charge.{0,35}(?:principal|exclusi)|(?:exclusi|principal).{0,35}charge/,
  },
  {
    name: 'allocation forfaitaire par enfant',
    categories: ['calcul', 'perimetre'],
    cue: /par enfant/,
    notes:
      /par enfant.*(?:allocation forfaitaire|base mensuelle)|(?:allocation forfaitaire|base mensuelle).*par enfant/,
  },
  {
    name: 'avantages en nature',
    categories: ['calcul', 'renvoi_externe', 'parametre'],
    cue: /avantages? en nature/,
    notes: /avantages? en nature/,
  },
  {
    name: 'pourcentage réglementaire',
    categories: ['parametre', 'renvoi_externe'],
    cue: /(?:pourcentage|taux).{0,35}(?:voie réglementaire|par décret)/,
    notes: /(?:pourcentage|taux).{0,35}(?:voie réglementaire|par décret)/,
  },
  {
    name: 'différence entre les prêts',
    categories: ['perimetre', 'renvoi_externe'],
    cue: /prêt/,
    notes: /prêts?.*(?:condition|accord)|(?:condition|accord).*prêts?/,
  },
  {
    name: 'location-accession',
    categories: ['perimetre', 'appreciation'],
    cue: /accession|accéder à la propriété/,
    notes: /location[- ]accession/,
  },
  {
    name: 'montant brut et abattement',
    categories: ['calcul', 'parametre'],
    cue: /montant(?:s)? brut/,
    notes: /montant(?:s)? brut.*abattement|abattement.*montant(?:s)? brut/,
  },
  {
    name: 'plancher, plafond ou ordre de l’abattement',
    categories: ['calcul'],
    cue: /abattement|déduction/,
    notes: /plancher|plafonn(?:er|ement|ée?)|ne peut excéder/,
  },
  {
    name: 'minoration pour frais réels',
    categories: ['calcul', 'perimetre'],
    cue: /frais(?: professionnels| réels)?/,
    notes: /frais réels.*(?:déduction|forfait)|(?:déduction|forfait).*frais réels/,
  },
  {
    name: 'meublés et régime d’abattement',
    categories: ['calcul', 'perimetre'],
    cue: /meublé/,
    notes: /meublé.*abattement|abattement.*meublé/,
  },
  {
    name: 'exonération et revenu fiscal de référence',
    categories: ['calcul', 'perimetre'],
    cue: /exonér|rémunération|rémunérations|revenu fiscal de référence/,
    notes: /revenu fiscal de référence.*(?:exonér|revenu brut global)|exonér.*revenu fiscal de référence/,
  },
  {
    name: 'plus et moins-values',
    categories: ['calcul', 'perimetre'],
    cue: /(?:plus|moins)[ -]values?/,
    notes: /plus(?:-values?| ou moins-value| et moins values?)/,
  },
  {
    name: 'revenus exceptionnels au quotient',
    categories: ['calcul', 'perimetre'],
    cue: /revenus? exceptionnels?|quotient|(?:micro[- ]?)?bénéfices/,
    notes:
      /revenus?.*(?:exceptionnels?|différés?).*quotient|quotient.*revenus?.*(?:exceptionnels?|différés?)/,
  },
  {
    name: 'imputation du déficit',
    categories: ['calcul'],
    cue: /déficit/,
    notes: /(?:déficit|solde négatif).*(?:imput|défalqu)|(?:imput|défalqu).*(?:déficit|solde négatif)/,
  },
  {
    name: 'arrondi',
    categories: ['arrondi', 'calcul'],
    cue: /arrond|prorata|pro-rata|proportion/,
    notes: /arrond/,
  },
  {
    name: 'enfants mineurs ou majeurs à charge',
    categories: ['appreciation', 'perimetre', 'calcul'],
    cue: /enfant/,
    notes: /enfants?.*(?:mineurs?|majeurs?)|(?:mineurs?|majeurs?).*enfants?/,
  },
  {
    name: 'carte d’invalidité',
    categories: ['appreciation', 'perimetre', 'calcul'],
    cue: /carte/,
    notes: /carte.{0,60}invalidité/,
  },
  {
    name: 'régime des assistants maternels ou familiaux',
    categories: ['calcul', 'perimetre'],
    cue: /assistants? (?:maternels?|familiaux)/,
    notes:
      /assistants? (?:maternels?|familiaux).*traitements et salaires|traitements et salaires.*assistants? (?:maternels?|familiaux)/,
  },
]

function normalized(text: string) {
  return normalizeLegalText(text.replace(/^\s*#\s*/gm, '')).toLowerCase()
}

function observationTopics({ category, quote, explanation }: Observation) {
  const citation = normalized(quote)
  const observation = `${citation} ${normalized(explanation)}`
  return topics.filter(
    (topic) =>
      topic.categories.includes(category) && topic.cue.test(citation) && topic.notes.test(observation),
  )
}

interface Match {
  itemId: string
  observation: number
  topics: string[]
}

function matchObservations(eligible: GroundTruthItem[], observations: Observation[]): Match[] {
  const byArticle = new Map<string, { item: GroundTruthItem; note: string }[]>()
  for (const item of eligible) {
    if (!item.nearestLegiarti) continue
    const list = byArticle.get(item.nearestLegiarti) ?? []
    list.push({ item, note: normalized(item.excerpt) })
    byArticle.set(item.nearestLegiarti, list)
  }
  const seen = new Set<string>()
  const candidates = observations.map((observation, index) => {
    const { legiarti, category, quote } = observation
    const relevant = observationTopics(observation)
    const key = JSON.stringify([legiarti, category, normalized(quote), relevant.map(({ name }) => name)])
    if (seen.has(key)) return []
    seen.add(key)
    return (byArticle.get(legiarti) ?? []).flatMap(({ item, note }) => {
      const overlap = relevant.filter((topic) => topic.notes.test(note)).map(({ name }) => name)
      return overlap.length > 0 ? [{ itemId: item.id, observation: index + 1, topics: overlap }] : []
    })
  })

  const matched = new Map<string, Match>()
  // Appariement biparti maximum. Un signalement et une annotation servent chacun au plus une fois.
  function assign(index: number, visited: Set<string>): boolean {
    for (const candidate of candidates[index] ?? []) {
      const { itemId } = candidate
      if (visited.has(itemId)) continue
      visited.add(itemId)
      const previous = matched.get(itemId)
      if (!previous || assign(previous.observation - 1, visited)) {
        matched.set(itemId, candidate)
        return true
      }
    }
    return false
  }
  for (let index = 0; index < candidates.length; index++) assign(index, new Set())
  return eligible.flatMap(({ id }) => matched.get(id) ?? [])
}

function count(items: GroundTruthItem[], matched: Set<string>) {
  const inPacket = items.filter(({ inBugdeloiDb }) => inBugdeloiDb).length
  const hits = items.filter(({ id }) => matched.has(id)).length
  return {
    totalGroundTruth: items.length,
    inPacket,
    matched: hits,
    recallPercent: inPacket === 0 ? null : Math.round((10_000 * hits) / inPacket) / 100,
  }
}

export function score(items: GroundTruthItem[], packet: BlindPacket, observations: Observation[]) {
  const packetIds = new Set(packet.articles.map(({ legiarti }) => legiarti))
  const eligible = items.filter(({ nearestLegiarti }) => nearestLegiarti && packetIds.has(nearestLegiarti))
  if (
    new Set(eligible.map(({ nearestLegiarti }) => nearestLegiarti)).size !== packetIds.size ||
    items.some(
      (item) => item.inBugdeloiDb !== Boolean(item.nearestLegiarti && packetIds.has(item.nearestLegiarti)),
    )
  ) {
    throw new Error('Les versions du paquet et la couverture de l’inventaire diffèrent.')
  }

  const matches = matchObservations(eligible, parseSubmission(observations, packet))
  const matched = new Set(matches.map(({ itemId }) => itemId))
  const suites = [...new Set(items.map(({ suite }) => suite))].sort()
  return {
    ...count(items, matched),
    observations: observations.length,
    bySuite: Object.fromEntries(
      suites.map((suite) => [
        suite,
        count(
          items.filter((item) => item.suite === suite),
          matched,
        ),
      ]),
    ),
    byKind: Object.fromEntries(
      kinds.map((kind) => [
        kind,
        count(
          items.filter((item) => item.kind === kind),
          matched,
        ),
      ]),
    ),
    matches,
  }
}

type Result = ReturnType<typeof score>

function percent(value: number | null) {
  return value === null ? '—' : `${String(value).replace('.', ',')} %`
}

function renderReport(
  inventory: GroundTruth,
  packet: BlindPacket,
  baseline: Result,
  results: { name: string; result: Result }[],
) {
  const row = (
    label: string,
    { totalGroundTruth, inPacket, matched, recallPercent }: Result | ReturnType<typeof count>,
  ) => `| ${label} | ${totalGroundTruth} | ${inPacket} | ${matched} | ${percent(recallPercent)} |`
  const table = [
    '| Groupe | Inventaire | Dans le paquet | Appariées | Rappel |',
    '| --- | ---: | ---: | ---: | ---: |',
    row('Total', baseline),
    ...Object.entries(baseline.byKind).map(([kind, result]) => row(`\`${kind}\``, result)),
    ...Object.entries(baseline.bySuite).map(([suite, result]) => row(`\`${suite}\``, result)),
  ]
  const submissionRows = results.map(
    ({ name, result }) =>
      `| \`${name}\` | ${result.observations} | ${result.matched}/${result.inPacket} | ${percent(result.recallPercent)} |`,
  )
  return `# C0.4 · Rappel des annotations juridiques

Le témoin mécanique a retrouvé **${baseline.matched} annotations sur ${baseline.inPacket}** (${percent(baseline.recallPercent)}).
Le paquet contient les textes DILA de **${packet.articles.length} versions** d’articles.
**${caveat}.**

## Inventaire et témoin mécanique

${table.join('\n')}

## Soumissions évaluées

| Soumission | Signalements | Annotations appariées | Rappel |
| --- | ---: | ---: | ---: |
${submissionRows.join('\n')}

## Méthode et limites

- L’inventaire relève les TODO juridiques et les notes citant un identifiant BOI dans les
  fichiers Catala en français. Le code associe chaque note au dernier titre d’article
  muni d’un LEGIARTI le précédant dans le fichier. Cette proximité peut rattacher une
  note au mauvais article. [Source Inria/DGFiP au commit \`${inventory.sourceCommit}\`](${inventory.sourceUrl}/tree/${inventory.sourceCommit})
- Le dénominateur comprend uniquement les annotations dont la version exacte figure
  dans le paquet. Le paquet est construit à partir des textes LEGI de la base BugDeLoi.
  La sélection des versions repose sur la présence d’annotations dans le corpus de référence.
  [Provenance des textes LEGI](../../docs/notes/legi.md)
- Pour compter, un signalement doit citer un extrait exact de la même version et partager
  un thème détecté par un motif textuel compatible avec sa catégorie. Une annotation
  et un signalement peuvent chacun servir une seule fois. Des thèmes proches, des notes
  sans contexte ou des reformulations peuvent fausser l’appariement.
  [Règles de comptage](evaluate.ts)
- Le témoin parcourt uniquement le paquet avec des motifs repérant les critères à apprécier,
  les renvois réglementaires, les paramètres et les arrondis.
  [Règles du témoin](baseline-heuristic.ts)
- Les annotations décrivent des choix, des questions ou des précisions de la formalisation
  de référence. Le rappel ne mesure ni la qualité juridique des signalements ni leur
  précision sur les textes hors de ce paquet. Ce rapport n’inclut aucun score d’analyste
  indépendant tant qu’aucune soumission aveugle de ce type n’a été intégrée.
  [Protocole de rejeu](README.md)
`
}

if (import.meta.main) {
  const inventoryJson = await Bun.file(join(import.meta.dir, 'ground-truth.json')).text()
  const inventory: GroundTruth = JSON.parse(inventoryJson)
  if (inventory.sourceCommit !== sourceCommit || !inventory.databaseChecked) {
    throw new Error('Inventaire non épinglé ou couverture LEGI absente.')
  }
  const packetJson = await Bun.file(packetFile).text()
  const packet = parsePacket(JSON.parse(packetJson))
  const dir = join(import.meta.dir, 'submissions')
  const files = Array.from(new Bun.Glob('*.json').scanSync(dir)).sort()
  const results = []
  for (const file of files) {
    if (!/^[a-z0-9][a-z0-9._-]*\.json$/i.test(file)) throw new Error(`Nom de soumission invalide : ${file}.`)
    const json = await Bun.file(join(dir, file)).text()
    const name = file.slice(0, -5)
    try {
      results.push({
        name,
        sha256: sha256Hex(json),
        result: score(inventory.items, packet, JSON.parse(json)),
      })
    } catch (cause) {
      throw new Error(`Soumission invalide : ${file}.`, { cause })
    }
  }
  const baseline = results.find(({ name }) => name === 'baseline-rules')?.result
  if (!baseline) throw new Error('Soumission baseline-rules.json absente.')
  await writeJson('summary.json', {
    sourceCommit: inventory.sourceCommit,
    groundTruthSha256: sha256Hex(inventoryJson),
    blindPacketSha256: sha256Hex(packetJson),
    articleVersions: packet.articles.length,
    caveat,
    baseline,
    submissions: results,
  })
  await Bun.write(join(import.meta.dir, 'REPORT.md'), renderReport(inventory, packet, baseline, results))
  console.log(
    `Témoin mécanique : ${baseline.matched}/${baseline.inPacket} (${percent(baseline.recallPercent)}).`,
  )
}
