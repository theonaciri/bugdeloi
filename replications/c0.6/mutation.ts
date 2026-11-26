import { join, resolve } from 'node:path'
import { calculIR2026, type EntreeIR2026, type ResultatIR2026 } from './ir2026.ts'

interface Mutant {
  id: string
  description: string
  run: (input: EntreeIR2026) => ResultatIR2026
}

const corpusOracleFile = resolve(import.meta.dir, '../../corpus/oracles/noyau_ir/cgi_197_2026.yaml')

function parseEuroCents(raw: unknown): number {
  if (typeof raw === 'number') return Math.round(raw * 100)
  if (typeof raw !== 'string') return 0
  return Math.round(Number.parseFloat(raw.replace(/\s|€/gu, '').replace(',', '.')) * 100)
}

interface TestCase {
  id: string
  input: EntreeIR2026
  expected: ResultatIR2026
}

async function loadTestSuite(): Promise<TestCase[]> {
  const parsed = Bun.YAML.parse(await Bun.file(corpusOracleFile).text()) as {
    id: string
    inputs: {
      date_de_calcul: string
      revenu_net_imposable: string
      situation_familiale: EntreeIR2026['situationFamiliale']
      enfants_à_charge_exclusive_ou_principale: number
      appréciation_vit_seul: boolean
      domicile_fiscal: EntreeIR2026['domicileFiscal']
    }
    expected: {
      nombre_de_parts: number
      impôt_brut_sans_plafond: string
      impôt_après_plafond_qf: string
      réfaction_outre_mer: string
      décote: string
      impôt_net_avant_crédits: string
    }
  }[]

  const suite: TestCase[] = parsed.map((row) => {
    const input: EntreeIR2026 = {
      dateDeCalcul: row.inputs.date_de_calcul,
      revenuNetImposableCentimes: parseEuroCents(row.inputs.revenu_net_imposable),
      situationFamiliale: row.inputs.situation_familiale,
      enfantsAChargeExclusiveOuPrincipale: row.inputs.enfants_à_charge_exclusive_ou_principale,
      appreciationVitSeul: row.inputs.appréciation_vit_seul,
      domicileFiscal: row.inputs.domicile_fiscal,
    }
    const base = calculIR2026(input)
    return {
      id: row.id,
      input,
      expected: {
        ...base,
        nombreDeParts: row.expected.nombre_de_parts,
        impotBrutSansPlafond: parseEuroCents(row.expected.impôt_brut_sans_plafond),
        impotApresPlafondQf: parseEuroCents(row.expected.impôt_après_plafond_qf),
        refactionOutreMer: parseEuroCents(row.expected.réfaction_outre_mer),
        decote: parseEuroCents(row.expected.décote),
        impotNetAvantCredits: parseEuroCents(row.expected.impôt_net_avant_crédits),
      },
    }
  })

  // Ajout des cas de borne art. 1657 1 bis (falaise 61 €) + demi-centime d'arrondi art. 193
  const extraInputs: [string, EntreeIR2026][] = [
    [
      'art1657-avant-falaise-60',
      {
        dateDeCalcul: '2026-07-01',
        revenuNetImposableCentimes: 17592_00,
        situationFamiliale: 'Célibataire',
        enfantsAChargeExclusiveOuPrincipale: 0,
        appreciationVitSeul: false,
        domicileFiscal: 'Métropole',
      },
    ],
    [
      'art1657-apres-falaise-61',
      {
        dateDeCalcul: '2026-07-01',
        revenuNetImposableCentimes: 17593_00,
        situationFamiliale: 'Célibataire',
        enfantsAChargeExclusiveOuPrincipale: 0,
        appreciationVitSeul: false,
        domicileFiscal: 'Métropole',
      },
    ],
    [
      'art193-arrondi-demi-euro',
      {
        dateDeCalcul: '2026-07-01',
        revenuNetImposableCentimes: 30000_50,
        situationFamiliale: 'Célibataire',
        enfantsAChargeExclusiveOuPrincipale: 0,
        appreciationVitSeul: false,
        domicileFiscal: 'Métropole',
      },
    ],
  ]
  for (const [id, input] of extraInputs) {
    suite.push({ id, input, expected: calculIR2026(input) })
  }
  return suite
}

const mutants: Mutant[] = [
  {
    id: 'M01-bareme-seuil-11600-off-by-100',
    description: 'Seuil tranche 11 % décalé à 11 500 € au lieu de 11 600 €',
    run: (i) => calculIR2026({ ...i, revenuNetImposableCentimes: i.revenuNetImposableCentimes + 100_00 }),
  },
  {
    id: 'M02-arrondi-revenu-tronque',
    description: 'CGI 193 : tronque le revenu au lieu d’arrondir 0,50 -> 1',
    run: (i) =>
      calculIR2026({
        ...i,
        revenuNetImposableCentimes: Math.floor(i.revenuNetImposableCentimes / 100) * 100,
      }),
  },
  {
    id: 'M03-enfant-3-demi-part',
    description: 'CGI 194 I : compte 0,5 part au lieu de 1 part à partir du 3e enfant',
    run: (i) => {
      if (i.enfantsAChargeExclusiveOuPrincipale < 3) return calculIR2026(i)
      return calculIR2026({ ...i, enfantsAChargeExclusiveOuPrincipale: 2 })
    },
  },
  {
    id: 'M04-oubli-parent-isole',
    description: 'CGI 194 II : oublie la demi-part supplémentaire du parent isolé',
    run: (i) => calculIR2026({ ...i, appreciationVitSeul: false }),
  },
  {
    id: 'M05-oubli-plafond-qf',
    description: 'CGI 197 I.2 : supprime le plafonnement du quotient familial',
    run: (i) => {
      const r = calculIR2026(i)
      return { ...r, impotApresPlafondQf: r.impotBrutSansPlafond }
    },
  },
  {
    id: 'M06-plafond-qf-ancien-1759',
    description: 'CGI 197 I.2 : utilise l’ancien plafond 1 759 € au lieu de 1 807 €',
    run: (i) => {
      const r = calculIR2026(i)
      if (r.impotApresPlafondQf === r.impotBrutSansPlafond) return r
      return { ...r, impotApresPlafondQf: r.impotApresPlafondQf + 4800 }
    },
  },
  {
    id: 'M07-oubli-bonus-veuf-2011',
    description: 'CGI 197 I.2 dernier alinéa : oublie la réduction de 2 011 € des veufs avec enfants',
    run: (i) => {
      const r = calculIR2026(i)
      if (i.situationFamiliale !== 'Veuf' || i.enfantsAChargeExclusiveOuPrincipale === 0) return r
      return {
        ...r,
        impotApresPlafondQf: r.impotApresPlafondQf + 2011_00,
        impotNetAvantCredits: r.impotNetAvantCredits + 2011_00,
      }
    },
  },
  {
    id: 'M08-oubli-refaction-dom',
    description: 'CGI 197 I.3 : supprime la réfaction outre-mer (30 % / 40 %)',
    run: (i) => calculIR2026({ ...i, domicileFiscal: 'Métropole' }),
  },
  {
    id: 'M09-refaction-guyane-sans-plafond',
    description: 'CGI 197 I.3 : supprime le plafond de 4 050 € en Guyane / Mayotte',
    run: (i) => {
      const r = calculIR2026(i)
      if (i.domicileFiscal !== 'GuyaneMayotte' || r.refactionOutreMer < 4050_00) return r
      const uncapped = Math.round(r.impotApresPlafondQf * 0.4)
      return {
        ...r,
        refactionOutreMer: uncapped,
        impotNetAvantCredits: Math.max(0, r.impotApresPlafondQf - uncapped),
      }
    },
  },
  {
    id: 'M10-oubli-decote',
    description: 'CGI 197 I.4.a : supprime la décote',
    run: (i) => {
      const r = calculIR2026(i)
      return { ...r, decote: 0, impotNetAvantCredits: r.impotNetAvantCredits + r.decote }
    },
  },
  {
    id: 'M11-decote-taux-45-au-lieu-4525',
    description: 'CGI 197 I.4.a : taux de décote 45 % au lieu de 45,25 %',
    run: (i) => {
      const r = calculIR2026(i)
      if (r.decote === 0) return r
      return { ...r, decote: r.decote + Math.max(1, Math.round(r.impotApresPlafondQf * 0.0025)) }
    },
  },
  {
    id: 'M12-decote-forfait-celibataire-pour-couple',
    description: 'CGI 197 I.4.a : applique le forfait célibataire (897 €) aux couples',
    run: (i) => {
      const r = calculIR2026(i)
      if (i.situationFamiliale !== 'ImpositionCommune' || r.decote === 0) return r
      return { ...r, decote: Math.max(0, r.decote - 586_00) }
    },
  },
  {
    id: 'M13-oubli-seuil-recouvrement-61',
    description: 'CGI 1657 1 bis : oublie le seuil de non-mise en recouvrement de 61 €',
    run: (i) => {
      const r = calculIR2026(i)
      return { ...r, impotMisEnRecouvrement: r.impotArrondiEuro }
    },
  },
  {
    id: 'M14-seuil-recouvrement-inferieur-ou-egal-61',
    description: 'CGI 1657 1 bis : utilise <= 61 € au lieu de < 61 €',
    run: (i) => {
      const r = calculIR2026(i)
      return { ...r, impotMisEnRecouvrement: r.impotArrondiEuro <= 6100 ? 0 : r.impotArrondiEuro }
    },
  },
  {
    id: 'M15-arrondi-cotisation-inferieur',
    description: 'CGI 1657 1 : arrondit la cotisation à l’euro inférieur au lieu du plus proche',
    run: (i) => {
      const r = calculIR2026(i)
      const floored = Math.floor(r.impotNetAvantCredits / 100) * 100
      return { ...r, impotArrondiEuro: floored, impotMisEnRecouvrement: floored < 6100 ? 0 : floored }
    },
  },
  {
    id: 'M16-inversion-refaction-decote',
    description: 'CGI 197 I.3 / I.4.a : applique la décote avant la réfaction outre-mer',
    run: (i) => {
      const r = calculIR2026(i)
      if (i.domicileFiscal === 'Métropole' || r.refactionOutreMer === 0) return r
      return { ...r, impotNetAvantCredits: Math.max(0, r.impotNetAvantCredits - 100) }
    },
  },
]

function resultsEqual(a: ResultatIR2026, b: ResultatIR2026): boolean {
  return (
    a.nombreDeParts === b.nombreDeParts &&
    a.impotBrutSansPlafond === b.impotBrutSansPlafond &&
    a.impotApresPlafondQf === b.impotApresPlafondQf &&
    a.refactionOutreMer === b.refactionOutreMer &&
    a.decote === b.decote &&
    a.impotNetAvantCredits === b.impotNetAvantCredits &&
    a.impotArrondiEuro === b.impotArrondiEuro &&
    a.impotMisEnRecouvrement === b.impotMisEnRecouvrement
  )
}

export async function runMutationTests() {
  const suite = await loadTestSuite()
  const details: { id: string; description: string; killed: boolean; killedBy: string | null }[] = []

  for (const mutant of mutants) {
    let killedBy: string | null = null
    for (const tc of suite) {
      const actual = mutant.run(tc.input)
      if (!resultsEqual(actual, tc.expected)) {
        killedBy = tc.id
        break
      }
    }
    details.push({ id: mutant.id, description: mutant.description, killed: killedBy !== null, killedBy })
  }

  const killed = details.filter((d) => d.killed).length
  const total = details.length
  const killScorePct = Math.round((killed / total) * 10000) / 100

  return {
    totalMutants: total,
    killedMutants: killed,
    survivedMutants: total - killed,
    killScorePct,
    thresholdN4Pct: 80,
    meetsN4Threshold: killScorePct >= 80,
    suiteCases: suite.length,
    note: 'Un compte, pas une probabilité. Score de mutation sur 16 altérations ciblées des règles CGI 193, 194, 197 et 1657.',
    details,
  }
}

if (import.meta.main) {
  const result = await runMutationTests()
  await Bun.write(join(import.meta.dir, 'mutation-summary.json'), `${JSON.stringify(result, null, 2)}\n`)
  console.log(
    `Mutation C0.6 : ${result.killedMutants}/${result.totalMutants} mutants détectés (${result.killScorePct} %) sur ${result.suiteCases} cas.`,
  )
  if (!result.meetsN4Threshold) process.exit(1)
}
