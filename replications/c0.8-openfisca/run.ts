import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseSortiePont, type SortieErreur, type SortieOk, type SortiePont } from './bridge.ts'
import { comparer, TOLERANCE_AF_EUROS, TOLERANCE_IR_EUROS } from './classify.ts'
import { rapport, resumer } from './report.ts'
import { genererScenarios, type Scenario } from './scenarios.ts'

const DOSSIER = import.meta.dir
const PYTHON = join(DOSSIER, '.venv', 'bin', 'python')
const DELAI_MS = 300_000

export async function appelerPont(scenarios: Scenario[], python = PYTHON): Promise<SortiePont> {
  if (!existsSync(python)) {
    return {
      status: 'error',
      code: 'venv_absent',
      message: 'Environnement Python local (.venv) absent : voir README.md.',
    }
  }
  // -I : ignore le répertoire courant et les variables PYTHON* ; -B : aucun fichier .pyc.
  const processus = Bun.spawn([python, '-I', '-B', join(DOSSIER, 'compare_openfisca.py')], {
    stdin: new TextEncoder().encode(JSON.stringify(scenarios)),
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: DELAI_MS,
  })
  const [stdout, stderr, code] = await Promise.all([
    new Response(processus.stdout).text(),
    new Response(processus.stderr).text(),
    processus.exited,
  ])
  if (stdout.trim() === '') {
    throw new Error(`Le pont Python n’a rien renvoyé (code ${code}) : ${stderr.slice(-2000)}`)
  }
  const sortie = parseSortiePont(stdout)
  if (sortie.status === 'ok' && code !== 0) throw new Error(`Le pont Python a échoué (code ${code}).`)
  return sortie
}

async function executer(horsLigne: boolean) {
  const forcee: SortieErreur = {
    status: 'error',
    code: 'hors_ligne_demande',
    message: 'Mode hors ligne demandé (--offline).',
  }
  // Premier appel sans foyer : lit les plafonds OpenFisca pour tester aussi leurs seuils ± 1 €.
  const sonde = horsLigne ? forcee : await appelerPont([])
  const baremes = sonde.status === 'ok' ? [sonde.parametres.af.mois] : []
  const scenarios = genererScenarios(baremes)
  const sortie = sonde.status === 'ok' ? await appelerPont(scenarios) : sonde
  const ecarts = sortie.status === 'ok' ? comparer(scenarios, sortie) : []
  return { scenarios, sortie, ecarts }
}

/** JSON indenté, listes courtes de valeurs simples sur une ligne (format attendu par Biome). */
export function versJson(valeur: unknown): string {
  const indente = JSON.stringify(valeur, null, 2)
  return `${indente.replace(
    /^( *)(.*)\[\n((?:\1 {2}(?:-?[\d.]+|"[^"\n]*"),?\n)+)\1\]/gm,
    (bloc, retrait: string, prefixe: string, corps: string) => {
      const valeurs = corps.trim().split(/,\n\s*/)
      const ligne = `${retrait}${prefixe}[${valeurs.join(', ')}]`
      return ligne.length < 110 ? ligne : bloc
    },
  )}\n`
}

if (import.meta.main) {
  const { scenarios, sortie, ecarts } = await executer(process.argv.includes('--offline'))
  const resume = resumer(scenarios, sortie, ecarts, {
    irEuros: TOLERANCE_IR_EUROS,
    afEuros: TOLERANCE_AF_EUROS,
  })
  await Bun.write(join(DOSSIER, 'summary.json'), versJson(resume))
  await Bun.write(join(DOSSIER, 'REPORT.md'), rapport(resume))
  if (sortie.status === 'ok') {
    const ok: SortieOk = sortie
    console.log(
      `C0.8 : ${scenarios.length} foyers comparés à openfisca-france ${ok.versions.openfisca_france} (période ${ok.periode.utilisee}), ${ecarts.length} écart(s) : ${JSON.stringify(resume.ecartsParCategorie)}.`,
    )
  } else {
    console.log(`C0.8 hors ligne (${sortie.code}) : ${scenarios.length} foyers générés, aucun comparé.`)
    // Une absence d'installation est attendue ; une panne du calcul ne l'est pas.
    if (!['venv_absent', 'openfisca_france_not_installed', 'hors_ligne_demande'].includes(sortie.code)) {
      console.error(sortie.message)
      process.exit(1)
    }
  }
}
