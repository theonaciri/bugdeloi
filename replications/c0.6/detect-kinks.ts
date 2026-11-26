import { join } from 'node:path'
import { auCentime, calculExact, type Foyer, nombreDeDemiParts, unitesParEuro } from './ir2026.ts'

export interface Kink {
  revenuEuros: number
  tmeAvantPct: number
  tmeApresPct: number
  cause: string
}

export interface Cliff {
  revenuEuros: number
  deltaImpotEuros: number
  tmePct: number
}

export interface CurvePoint {
  revenuEuros: number
  impotNetEuros: number
  decoteEuros: number
  tauxMoyenPct: number
  tauxMarginalPct: number
}

export interface HouseholdAnalysis {
  id: string
  label: string
  foyer: Foyer
  parts: number
  seuilEntreeEuros: number
  debutDecotePartielleEuros: number | null
  finDecoteEuros: number | null
  tmeZoneDecotePct: number | null
  seuilPlafondQfEuros: number | null
  kinks: Kink[]
  cliffs: Cliff[]
  curve: CurvePoint[]
}

export const households: { id: string; label: string; foyer: Foyer }[] = [
  {
    id: 'celibataire-1p',
    label: 'Célibataire sans enfant (1 part)',
    foyer: {
      situationFamiliale: 'Célibataire',
      enfantsAChargeExclusiveOuPrincipale: 0,
      appreciationVitSeul: false,
      domicileFiscal: 'Métropole',
    },
  },
  {
    id: 'couple-2p',
    label: 'Couple marié ou pacsé sans enfant (2 parts)',
    foyer: {
      situationFamiliale: 'ImpositionCommune',
      enfantsAChargeExclusiveOuPrincipale: 0,
      appreciationVitSeul: false,
      domicileFiscal: 'Métropole',
    },
  },
  {
    id: 'couple-2enf-3p',
    label: 'Couple marié ou pacsé avec 2 enfants (3 parts)',
    foyer: {
      situationFamiliale: 'ImpositionCommune',
      enfantsAChargeExclusiveOuPrincipale: 2,
      appreciationVitSeul: false,
      domicileFiscal: 'Métropole',
    },
  },
  {
    id: 'parent-isole-1enf-2p',
    label: 'Parent isolé avec 1 enfant à charge (2 parts)',
    foyer: {
      situationFamiliale: 'Célibataire',
      enfantsAChargeExclusiveOuPrincipale: 1,
      appreciationVitSeul: true,
      domicileFiscal: 'Métropole',
    },
  },
]

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function exactMarginalRatePct(revenu: bigint, foyer: Foyer): number {
  const a = calculExact(revenu, foyer).net
  const b = calculExact(revenu + 1n, foyer).net
  return Math.round((Number(b - a) / Number(unitesParEuro)) * 10000) / 100
}

function classifyTransition(
  prev: ReturnType<typeof calculExact>,
  next: ReturnType<typeof calculExact>,
): string {
  if (prev.regimeDecote !== next.regimeDecote) {
    if (next.regimeDecote === 'partielle') return 'Entrée dans l’impôt (zone de décote, taux majoré × 1,4525)'
    if (next.regimeDecote === 'nulle') return 'Sortie de la décote (retour au taux du barème)'
  }
  if (!prev.qfPlafonne && next.qfPlafonne)
    return 'Déclenchement du plafonnement du quotient familial (1 807 € / demi-part)'
  if (prev.qfPlafonne && next.qfPlafonne && prev.tauxBaremeReference !== next.tauxBaremeReference) {
    return `Changement de tranche du barème de référence (${prev.tauxBaremeReference} % → ${next.tauxBaremeReference} %)`
  }
  if (prev.tauxBaremeFoyer !== next.tauxBaremeFoyer) {
    return `Changement de tranche du barème (${prev.tauxBaremeFoyer} % → ${next.tauxBaremeFoyer} %)`
  }
  return 'Changement de régime marginal'
}

export function analyzeHousehold(
  entry: (typeof households)[number],
  maxRevenue = 200_000,
): HouseholdAnalysis {
  const { id, label, foyer } = entry
  const parts = Number(nombreDeDemiParts(foyer).demiParts) / 2
  const kinks: Kink[] = []
  const cliffs: Cliff[] = []

  let seuilEntreeEuros = 0
  let debutDecotePartielleEuros: number | null = null
  let finDecoteEuros: number | null = null
  let tmeZoneDecotePct: number | null = null
  let seuilPlafondQfEuros: number | null = null

  let prevState = calculExact(0n, foyer)
  let prevRate = exactMarginalRatePct(0n, foyer)

  // Balayage pas de 1 € sur tout [0, maxRevenue] pour ne manquer aucun coude ni aucune falaise.
  for (let r = 1; r <= maxRevenue; r++) {
    const state = calculExact(BigInt(r), foyer)
    if (seuilEntreeEuros === 0 && state.net > 0n) seuilEntreeEuros = r
    if (debutDecotePartielleEuros === null && state.regimeDecote === 'partielle') {
      debutDecotePartielleEuros = r
      tmeZoneDecotePct = exactMarginalRatePct(BigInt(r + 10), foyer)
    }
    if (debutDecotePartielleEuros !== null && finDecoteEuros === null && state.regimeDecote === 'nulle') {
      finDecoteEuros = r
    }
    if (seuilPlafondQfEuros === null && state.qfPlafonne) {
      seuilPlafondQfEuros = r
    }

    const deltaUnits = state.net - prevState.net
    if (deltaUnits > unitesParEuro) {
      cliffs.push({
        revenuEuros: r,
        deltaImpotEuros: round2(auCentime(deltaUnits) / 100),
        tmePct: round2(Number((deltaUnits * 10000n) / unitesParEuro) / 100),
      })
    }

    const rate = exactMarginalRatePct(BigInt(r), foyer)
    if (Math.abs(rate - prevRate) >= 0.25) {
      const lastKink = kinks.at(-1)
      if (!lastKink || r - lastKink.revenuEuros > 2) {
        const afterRate = r + 2 <= maxRevenue ? exactMarginalRatePct(BigInt(r + 2), foyer) : rate
        const nextState = calculExact(BigInt(Math.min(maxRevenue, r + 2)), foyer)
        if (Math.abs(afterRate - prevRate) >= 0.25) {
          kinks.push({
            revenuEuros: r,
            tmeAvantPct: round2(prevRate),
            tmeApresPct: round2(afterRate),
            cause: classifyTransition(prevState, nextState),
          })
        }
      }
    }

    prevState = state
    prevRate = rate
  }

  // Courbe échantillonnée (tous les 2 000 € + tous les coudes ± 1 €) pour affichage fluide.
  const sampleRevenues = new Set<number>()
  for (let r = 0; r <= 120_000; r += 2000) sampleRevenues.add(r)
  for (let r = 120_000; r <= maxRevenue; r += 10_000) sampleRevenues.add(r)
  for (const k of kinks) {
    if (k.revenuEuros > 1) sampleRevenues.add(k.revenuEuros - 1)
    sampleRevenues.add(k.revenuEuros)
    if (k.revenuEuros + 1 <= maxRevenue) sampleRevenues.add(k.revenuEuros + 1)
  }

  const curve: CurvePoint[] = [...sampleRevenues]
    .sort((a, b) => a - b)
    .map((r) => {
      const s = calculExact(BigInt(r), foyer)
      const impotNetEuros = round2(auCentime(s.net) / 100)
      const decoteEuros = round2(auCentime(s.decote) / 100)
      const tauxMoyenPct = r > 0 ? round2((impotNetEuros / r) * 100) : 0
      const tauxMarginalPct = round2(exactMarginalRatePct(BigInt(r), foyer))
      return { revenuEuros: r, impotNetEuros, decoteEuros, tauxMoyenPct, tauxMarginalPct }
    })

  return {
    id,
    label,
    foyer,
    parts,
    seuilEntreeEuros,
    debutDecotePartielleEuros,
    finDecoteEuros,
    tmeZoneDecotePct: tmeZoneDecotePct !== null ? round2(tmeZoneDecotePct) : null,
    seuilPlafondQfEuros,
    kinks,
    cliffs,
    curve,
  }
}

export function runDetection() {
  const analyses = households.map((h) => analyzeHousehold(h))
  const totalCliffs = analyses.reduce((sum, a) => sum + a.cliffs.length, 0)
  const totalKinks = analyses.reduce((sum, a) => sum + a.kinks.length, 0)
  return {
    millesime: '2026',
    legalUnits: [
      'LEGIARTI000054373592@2026-07-01',
      'LEGIARTI000033817781@2018-01-01',
      'LEGIARTI000053542636@2026-02-21',
    ],
    sweepRangeEuros: [0, 200_000] as const,
    stepEuros: 1,
    totalCliffs,
    totalKinks,
    note: 'Un compte, pas une probabilité. Balayage déterministe au pas de 1 € sur le noyau CGI 193-197 seul (hors seuils de recouvrement de 61 € et hors aides sociales).',
    households: analyses,
  }
}

function buildReport(summary: ReturnType<typeof runDetection>): string {
  const lines = [
    '# C0.6 · Étalonnage du détecteur de coudes et falaises (Impôt sur le revenu 2026)',
    '',
    'Balayage déterministe au pas de **1 €** de `0 €` à `200 000 €` de revenu net imposable sur le noyau CGI art. 193, 194 et 197 en vigueur en 2026 (`LEGIARTI000053542636`). **Un compte, pas une probabilité.**',
    '',
    `- **Falaises détectées (taux marginal > 100 %) :** ${summary.totalCliffs} (résultat attendu sur le barème progressif seul, hors seuil de mise en recouvrement de 61 €).`,
    `- **Coudes de taux marginal détectés :** ${summary.totalKinks} sur 4 foyers types.`,
    '',
    '## Synthèse par foyer type',
    '',
    '| Foyer | Parts | Entrée IR | Zone de décote | TME dans la décote | Plafond QF | Falaises |',
    '| --- | ---: | ---: | --- | ---: | ---: | ---: |',
  ]
  for (const h of summary.households) {
    const decote =
      h.debutDecotePartielleEuros && h.finDecoteEuros
        ? `${h.debutDecotePartielleEuros.toLocaleString('fr-FR')} € → ${h.finDecoteEuros.toLocaleString('fr-FR')} €`
        : 'Aucune'
    const tme = h.tmeZoneDecotePct !== null ? `${h.tmeZoneDecotePct.toFixed(2).replace('.', ',')} %` : '—'
    const qf = h.seuilPlafondQfEuros ? `${h.seuilPlafondQfEuros.toLocaleString('fr-FR')} €` : 'Non atteint'
    lines.push(
      `| ${h.label} | ${h.parts} | ${h.seuilEntreeEuros.toLocaleString('fr-FR')} € | ${decote} | ${tme} | ${qf} | ${h.cliffs.length} |`,
    )
  }
  lines.push('', '## Coudes détectés (Célibataire 1 part)', '')
  const single = summary.households[0]
  if (single) {
    for (const k of single.kinks) {
      lines.push(
        `- **${k.revenuEuros.toLocaleString('fr-FR')} €** : ${k.tmeAvantPct.toFixed(2).replace('.', ',')} % → ${k.tmeApresPct.toFixed(2).replace('.', ',')} % (${k.cause})`,
      )
    }
  }
  lines.push('')
  return lines.join('\n')
}

if (import.meta.main) {
  const summary = runDetection()
  await Bun.write(join(import.meta.dir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
  await Bun.write(join(import.meta.dir, 'REPORT.md'), buildReport(summary))
  console.log(
    `C0.6 généré : ${summary.totalKinks} coudes détectés, ${summary.totalCliffs} falaises sur ${summary.households.length} foyers.`,
  )
}
