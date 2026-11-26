import {
  type BlindPacket,
  type Category,
  type Observation,
  packetFile,
  parsePacket,
  writeJson,
} from './packet.ts'

interface Detector {
  category: Category
  pattern: RegExp
  explanation: string
}

const determinants =
  /\b(?:taux|pourcentages?|montants?|plafonds?|seuils?|dates?|délais?|durées?|barèmes?)\b/iu
const regulatory =
  /\b(?:(?:par|du|d'un|un|le|au) décret|(?:par|de|à) voie réglementaire|(?:par|d'un|un|l'|cet )arrêté\s+(?:du|des|ministériel|conjoint|préfectoral)|(?:par|de|à) l'ordonnance|ordonnance n°)/iu
const rounding = /\barrondi(?:s|e|es|r|t|ssement)?\b/iu
const fraction = /\b(?:au prorata|à proportion|proportionnellement)\b/iu
const explicitPrecision =
  /\b(?:plus proche|supérieur|inférieur|décimales?|centimes?|euros?|centaine|dizaine)\b/iu

const appreciation: Detector = {
  category: 'appreciation',
  pattern:
    /\b(?:charge effective(?: et permanente)?|(?:a|assume) effectivement la charge|délai raisonnable|faute grave|à titre (?:exclusif ou )?principal|motif légitime|conditions de décence|circonstances exceptionnelles)(?![\p{L}\p{N}])/iu,
  explanation: 'Quels faits permettent de décider si le critère cité est rempli ?',
}

function scanClause(clause: string, quote: string): Omit<Observation, 'legiarti'>[] {
  const observations: Omit<Observation, 'legiarti'>[] = []
  if (appreciation.pattern.test(clause)) {
    observations.push({ category: appreciation.category, quote, explanation: appreciation.explanation })
  }
  if (regulatory.test(clause)) {
    observations.push(
      determinants.test(clause)
        ? {
            category: 'parametre',
            quote,
            explanation:
              'Ce passage associe un paramètre à un texte réglementaire. Quelle valeur faut-il retenir ?',
          }
        : {
            category: 'renvoi_externe',
            quote,
            explanation:
              'Ce passage mentionne un texte réglementaire absent du paquet. Que faut-il en reprendre ?',
          },
    )
  }
  if (
    (rounding.test(clause) && !explicitPrecision.test(clause)) ||
    (fraction.test(clause) && !rounding.test(clause))
  ) {
    observations.push({
      category: 'arrondi',
      quote,
      explanation:
        'À quelle étape et avec quelle précision faut-il arrondir ? Le passage laisse ce point à préciser.',
    })
  }
  return observations
}

/** Témoin mécanique : uniquement le texte LEGI dans le paquet, sans annotation ni appel extérieur. */
export function baseline(packet: BlindPacket): Observation[] {
  const observations: Observation[] = []
  const seen = new Set<string>()
  for (const { legiarti, text } of packet.articles) {
    for (const raw of text.split(/(?<=[;!?])\s+|(?<=[a-zà-ÿ0-9]{2}\.)\s+/iu)) {
      const quote = raw.trim()
      const clause = quote.replace(/[’ʼ]/g, "'")
      for (const observation of scanClause(clause, quote)) {
        const key = JSON.stringify([legiarti, observation.category, quote])
        if (seen.has(key)) continue
        seen.add(key)
        observations.push({ legiarti, ...observation })
      }
    }
  }
  return observations
}

if (import.meta.main) {
  const observations = baseline(parsePacket(await Bun.file(packetFile).json()))
  await writeJson('submissions/baseline-rules.json', observations)
  console.log(`${observations.length} observations mécaniques.`)
}
