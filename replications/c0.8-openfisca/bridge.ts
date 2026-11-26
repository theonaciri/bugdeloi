/** Lecture stricte de la sortie JSON de `compare_openfisca.py` (entrée externe, AGENTS.md §9.3). */

export const CLES_PARAMETRES_IR = [
  'decoteSeul',
  'decoteCouple',
  'decoteTaux',
  'plafondDemiPart',
  'plafondParentIsole',
  'reductionVeuf',
  'domGmrPlafond',
  'domGmrTaux',
  'domGmPlafond',
  'domGmTaux',
  'seuilRecouvrement',
] as const

export const CLES_BAREME_AF = [
  'bmafMensuelleEuros',
  'plafond1BaseEuros',
  'plafond2BaseEuros',
  'majorationPlafondParEnfantEuros',
] as const

export type ParametresIR = Record<(typeof CLES_PARAMETRES_IR)[number], number> & {
  seuils: number[]
  taux: number[]
}
export type BaremeAF = Record<(typeof CLES_BAREME_AF)[number], number>
export type BaremeMensuel = BaremeAF & { mois: string }
export type HistoriqueAF = Record<(typeof CLES_BAREME_AF)[number], { date: string; valeur: number }[]>

export interface ResultatOpenFisca {
  id: string
  impot_revenu: number | null
  af: number | null
  details: Record<string, number>
}

export interface SortieOk {
  status: 'ok'
  versions: Record<string, string>
  periode: { demandee: number; utilisee: number; moisAF: string }
  parametres: { ir: ParametresIR; af: { mois: BaremeMensuel; historique: HistoriqueAF } }
  results: ResultatOpenFisca[]
}

export interface SortieErreur {
  status: 'error'
  code: string
  message: string
}

export type SortiePont = SortieOk | SortieErreur

const echec = (chemin: string, attendu: string): never => {
  throw new Error(`Sortie OpenFisca invalide : ${chemin} (${attendu} attendu).`)
}

function objet(v: unknown, chemin: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return echec(chemin, 'objet')
  return v as Record<string, unknown>
}
const liste = (v: unknown, chemin: string): unknown[] => (Array.isArray(v) ? v : echec(chemin, 'liste'))
const texte = (v: unknown, chemin: string): string => (typeof v === 'string' ? v : echec(chemin, 'texte'))
const nombre = (v: unknown, chemin: string): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : echec(chemin, 'nombre fini')
const nombreOuNul = (v: unknown, chemin: string) => (v === null ? null : nombre(v, chemin))
const nombres = (v: unknown, chemin: string) => liste(v, chemin).map((x, i) => nombre(x, `${chemin}[${i}]`))

function champs<K extends string>(o: Record<string, unknown>, cles: readonly K[], chemin: string) {
  return Object.fromEntries(cles.map((c) => [c, nombre(o[c], `${chemin}.${c}`)])) as Record<K, number>
}

export function parseSortiePont(brut: string): SortiePont {
  let json: unknown
  try {
    json = JSON.parse(brut)
  } catch {
    throw new Error('Sortie OpenFisca invalide : JSON illisible.')
  }
  const racine = objet(json, 'racine')
  if (racine.status === 'error') {
    return { status: 'error', code: texte(racine.code, 'code'), message: texte(racine.message, 'message') }
  }
  if (racine.status !== 'ok') return echec('status', '"ok" ou "error"')

  const versions = Object.fromEntries(
    Object.entries(objet(racine.versions, 'versions')).map(([k, v]) => [k, texte(v, `versions.${k}`)]),
  )
  const brutePeriode = objet(racine.periode, 'periode')
  const periode = {
    ...champs(brutePeriode, ['demandee', 'utilisee'] as const, 'periode'),
    moisAF: texte(brutePeriode.moisAF, 'periode.moisAF'),
  }
  const parametres = objet(racine.parametres, 'parametres')
  const ir = objet(parametres.ir, 'parametres.ir')
  const af = objet(parametres.af, 'parametres.af')
  const historique = objet(af.historique, 'parametres.af.historique')
  const reference = objet(af.mois, 'parametres.af.mois')
  const mois = {
    mois: texte(reference.mois, 'parametres.af.mois.mois'),
    ...champs(reference, CLES_BAREME_AF, 'parametres.af.mois'),
  }

  return {
    status: 'ok',
    versions,
    periode,
    parametres: {
      ir: {
        seuils: nombres(ir.seuils, 'parametres.ir.seuils'),
        taux: nombres(ir.taux, 'parametres.ir.taux'),
        ...champs(ir, CLES_PARAMETRES_IR, 'parametres.ir'),
      },
      af: {
        mois,
        historique: Object.fromEntries(
          CLES_BAREME_AF.map((cle) => [
            cle,
            liste(historique[cle], `historique.${cle}`).map((v, i) => {
              const o = objet(v, `historique.${cle}[${i}]`)
              return { date: texte(o.date, 'date'), valeur: nombre(o.valeur, 'valeur') }
            }),
          ]),
        ) as HistoriqueAF,
      },
    },
    results: liste(racine.results, 'results').map((r, i) => {
      const o = objet(r, `results[${i}]`)
      const details = objet(o.details, `results[${i}].details`)
      return {
        id: texte(o.id, `results[${i}].id`),
        impot_revenu: nombreOuNul(o.impot_revenu, `results[${i}].impot_revenu`),
        af: nombreOuNul(o.af, `results[${i}].af`),
        details: Object.fromEntries(
          Object.entries(details).map(([k, v]) => [k, nombre(v, `results[${i}].details.${k}`)]),
        ),
      }
    }),
  }
}
