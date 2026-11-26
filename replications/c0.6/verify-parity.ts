import { join, resolve } from 'node:path'
import { readImageLock, runInSandbox } from '../../packages/runner/src/index.ts'
import { calculIR2026, type EntreeIR2026 } from './ir2026.ts'

const repoRoot = resolve(import.meta.dir, '../..')
const corpusDir = join(repoRoot, 'corpus')
const catalaFile = 'cgi/livre1/partie1/titre1/chapitre1/section5/noyau_ir.catala_fr'
const oracleFile = join(corpusDir, 'oracles/noyau_ir/cgi_197_2026.yaml')

function parseEuroCents(raw: unknown): number {
  if (typeof raw === 'number') return Math.round(raw * 100)
  if (typeof raw !== 'string') throw new Error(`Montant inattendu : ${String(raw)}`)
  const cleaned = raw.replace(/\s|€/gu, '').replace(',', '.')
  return Math.round(Number.parseFloat(cleaned) * 100)
}

interface OracleCase {
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
}

export async function verifyParity() {
  const lock = await readImageLock()
  const sandbox = await runInSandbox({
    workdir: corpusDir,
    command: ['clerk', 'test', catalaFile],
    timeoutMs: 60_000,
    memoryMb: 1536,
    cpus: 2,
    network: false,
  })
  if (sandbox.exitCode !== 0) {
    throw new Error(`Échec clerk test dans le bac à sable Catala :\n${sandbox.stdout}\n${sandbox.stderr}`)
  }

  const parsed = Bun.YAML.parse(await Bun.file(oracleFile).text()) as OracleCase[]
  let checked = 0
  for (const item of parsed) {
    const out = calculIR2026({
      dateDeCalcul: item.inputs.date_de_calcul,
      revenuNetImposableCentimes: parseEuroCents(item.inputs.revenu_net_imposable),
      situationFamiliale: item.inputs.situation_familiale,
      enfantsAChargeExclusiveOuPrincipale: item.inputs.enfants_à_charge_exclusive_ou_principale,
      appreciationVitSeul: item.inputs.appréciation_vit_seul,
      domicileFiscal: item.inputs.domicile_fiscal,
    })
    const checks: [string, number, number][] = [
      ['nombre_de_parts', out.nombreDeParts, item.expected.nombre_de_parts],
      [
        'impôt_brut_sans_plafond',
        out.impotBrutSansPlafond,
        parseEuroCents(item.expected.impôt_brut_sans_plafond),
      ],
      [
        'impôt_après_plafond_qf',
        out.impotApresPlafondQf,
        parseEuroCents(item.expected.impôt_après_plafond_qf),
      ],
      ['réfaction_outre_mer', out.refactionOutreMer, parseEuroCents(item.expected.réfaction_outre_mer)],
      ['décote', out.decote, parseEuroCents(item.expected.décote)],
      [
        'impôt_net_avant_crédits',
        out.impotNetAvantCredits,
        parseEuroCents(item.expected.impôt_net_avant_crédits),
      ],
    ]
    for (const [field, got, want] of checks) {
      if (got !== want) {
        throw new Error(`Écart de parité sur ${item.id}.${field} : obtenu ${got}, attendu ${want}`)
      }
    }
    checked++
  }

  return {
    catalaVersion: lock.catala,
    catalaDigest: lock.digest,
    catalaTestsPassed: true,
    oracleCasesChecked: checked,
    durationMs: sandbox.durationMs,
  }
}

if (import.meta.main) {
  const result = await verifyParity()
  console.log(JSON.stringify(result, null, 2))
}
