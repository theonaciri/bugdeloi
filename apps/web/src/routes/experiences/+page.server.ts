import c04Summary from '../../../../../replications/c0.4/summary.json'
import c06Summary from '../../../../../replications/c0.6/summary.json'
import c07Summary from '../../../../../replications/c0.7/summary.json'
import c08Summary from '../../../../../replications/c0.8-openfisca/summary.json'
import type { PageServerLoad } from './$types'

const blindRun = c04Summary.submissions.find((s) => s.name === 'gemini-4-neon-blind')?.result

export const load: PageServerLoad = () => ({
  c04: {
    totalGroundTruth: c04Summary.baseline.totalGroundTruth,
    inPacket: c04Summary.baseline.inPacket,
    baselineMatched: c04Summary.baseline.matched,
    baselineRecallPct: c04Summary.baseline.recallPercent,
    blindMatched: blindRun?.matched ?? 0,
    blindRecallPct: blindRun?.recallPercent ?? 0,
    blindObservations: blindRun?.observations ?? 0,
  },
  c06: {
    totalKinks: c06Summary.totalKinks,
    totalCliffs: c06Summary.totalCliffs,
    totalCliffs1657: c06Summary.totalCliffs1657,
    decoteTme: c06Summary.households[0]?.tmeZoneDecotePct ?? 15.98,
  },
  c07: {
    effetsDeSeuil: c07Summary.resume.effetsDeSeuil,
    effetsDeSeuilEnBaisse: c07Summary.resume.effetsDeSeuilEnBaisse,
    effetsDeSeuilMultiLois: c07Summary.resume.effetsDeSeuilMultiLois,
  },
  c08: {
    foyersCompares: c08Summary.foyersCompares,
    openfiscaVersion: c08Summary.versions.openfisca_france,
    divergencesSimulateur: c08Summary.ecartsParCategorie.divergence_simulateur,
    differencesPerimetre: c08Summary.ecartsParCategorie.difference_de_perimetre,
  },
})
