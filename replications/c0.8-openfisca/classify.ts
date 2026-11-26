import { calculExact, calculIR2026, unitesParEuro } from '../c0.6/ir2026.ts'
import { AF } from '../c0.7/parametres.ts'
import { calculAllocationsFamilialesAnnuelles } from '../c0.7/revenu-disponible.ts'
import {
  type BaremeAF,
  CLES_BAREME_AF,
  CLES_PARAMETRES_IR,
  type ParametresIR,
  type ResultatOpenFisca,
  type SortieOk,
} from './bridge.ts'
import { type Scenario, SEUILS_BAREME } from './scenarios.ts'

export type Categorie = 'difference_de_millesime' | 'difference_de_perimetre' | 'divergence_simulateur'

export interface Ecart {
  scenario: string
  domaine: Scenario['domaine']
  champ: 'impot_revenu' | 'nombre_de_parts' | 'af'
  categorie: Categorie
  motif: string
  bugdeloi: number
  openfisca: number
  entree: Scenario
}

/** L'impôt est un nombre entier d'euros des deux côtés : tout écart d'un euro compte. */
export const TOLERANCE_IR_EUROS = 0.005
/** OpenFisca arrondit au centime chaque mois, c0.7 sur le total annuel : 12 × 0,01 €. */
export const TOLERANCE_AF_EUROS = 0.12

// Paramètres codés dans `ir2026.ts` (CGI 197 et 1657, versions LEGI citées dans ce fichier).
export const PARAMETRES_IR_C06: ParametresIR = {
  seuils: SEUILS_BAREME,
  taux: [0.11, 0.3, 0.41, 0.45],
  decoteSeul: 897,
  decoteCouple: 1483,
  decoteTaux: 0.4525,
  plafondDemiPart: 1807,
  plafondParentIsole: 4262,
  reductionVeuf: 2011,
  domGmrPlafond: 2450,
  domGmrTaux: 0.3,
  domGmPlafond: 4050,
  domGmTaux: 0.4,
  seuilRecouvrement: 61,
}

const egal = (a: number, b: number) => Math.abs(a - b) < 1e-6

export function parametresIRDifferents(openfisca: ParametresIR, local = PARAMETRES_IR_C06): string[] {
  const differents: string[] = CLES_PARAMETRES_IR.filter((c) => !egal(openfisca[c], local[c]))
  for (const cle of ['seuils', 'taux'] as const) {
    const a = openfisca[cle]
    const b = local[cle]
    if (a.length !== b.length || a.some((v, i) => !egal(v, b[i] ?? Number.NaN))) differents.push(cle)
  }
  return differents
}

export function calculerIRLocal(s: Scenario) {
  const resultat = calculIR2026({
    dateDeCalcul: '2026-07-01',
    revenuNetImposableCentimes: s.revenuEuros * 100,
    situationFamiliale: s.situationFamiliale,
    enfantsAChargeExclusiveOuPrincipale: s.agesEnfants.length,
    appreciationVitSeul: s.appreciationVitSeul,
    domicileFiscal: s.domicileFiscal,
  })
  return { impotRevenu: resultat.impotMisEnRecouvrement / 100, nombreDeParts: resultat.nombreDeParts }
}

/**
 * c0.7 reçoit le nombre d'enfants de moins de 20 ans et le nombre de ceux ouvrant droit à la
 * majoration. Ce dernier dépend de la date de naissance entre 14 et 17 ans : ces âges sont refusés.
 */
export function calculerAFLocal(s: Scenario): number {
  const aCharge = s.agesEnfants.filter((age) => age < 20)
  if (aCharge.some((age) => age >= 14 && age < 18)) {
    throw new RangeError(`${s.id} : majoration indéterminée sans date de naissance (14 à 17 ans).`)
  }
  return calculAllocationsFamilialesAnnuelles(s.revenuEuros, aCharge.length, {
    enfantsOuvrantMajoration: aCharge.filter((age) => age >= 18).length,
  }).annuelEuros
}

/** Paramètres AF de c0.7 qui diffèrent de ceux d'OpenFisca pour le mois évalué. */
export function parametresAFDifferents(openfisca: BaremeAF, local: BaremeAF = AF) {
  return CLES_BAREME_AF.filter((cle) => !egal(openfisca[cle], local[cle]))
}

type Verdict = Pick<Ecart, 'categorie' | 'motif'>

/**
 * Contrefactuel d'arrondi, ordre observé dans OpenFisca : impôt arrondi à l'euro pour calculer la
 * décote, décote arrondie à l'euro, puis résultat arrondi. Il sert à qualifier l'indice, pas à
 * dire quel ordre le texte impose.
 */
export function irAvecArrondisIntermediaires(s: Scenario, p = PARAMETRES_IR_C06): number {
  const exact = calculExact(BigInt(s.revenuEuros), {
    situationFamiliale: s.situationFamiliale,
    enfantsAChargeExclusiveOuPrincipale: s.agesEnfants.length,
    appreciationVitSeul: s.appreciationVitSeul,
    domicileFiscal: s.domicileFiscal,
  })
  const avantDecote = Number(exact.apresPlafond - exact.refaction) / Number(unitesParEuro)
  const arrondi = Math.round(avantDecote)
  const forfait = s.situationFamiliale === 'ImpositionCommune' ? p.decoteCouple : p.decoteSeul
  const decote = Math.round(Math.max(0, forfait - p.decoteTaux * arrondi))
  const impot = Math.round(avantDecote - Math.min(decote, arrondi))
  return impot < p.seuilRecouvrement ? 0 : impot
}

export function classerEcartIR(
  s: Scenario,
  openfisca: ResultatOpenFisca,
  local: number,
  params: ParametresIR,
): Verdict {
  const differents = parametresIRDifferents(params)
  if (differents.length > 0) {
    return {
      categorie: 'difference_de_millesime',
      motif: `Paramètres différents pour la période évaluée : ${differents.join(', ')}.`,
    }
  }
  const montant = openfisca.impot_revenu ?? Number.NaN
  const cehr = Math.abs(openfisca.details.contribution_exceptionnelle_hauts_revenus ?? 0)
  // La contribution est en centimes, l'impôt local en euros : réconciliation à 1 € près.
  if (cehr > 0 && Math.abs(montant - cehr - local) <= 1) {
    return {
      categorie: 'difference_de_perimetre',
      motif: 'OpenFisca ajoute la contribution sur les hauts revenus, hors périmètre de c0.6.',
    }
  }
  return {
    categorie: 'divergence_simulateur',
    motif:
      Math.abs(montant - irAvecArrondisIntermediaires(s)) <= TOLERANCE_IR_EUROS
        ? 'Non tranché. Disparaît avec des arrondis à l’euro avant et sur la décote (candidat à instruire : ARRONDI).'
        : 'Non expliqué par les paramètres, le périmètre ou l’ordre des arrondis testé.',
  }
}

export function classerEcartAF(
  s: Scenario,
  openfisca: ResultatOpenFisca,
  local: number,
  parametres: SortieOk['parametres']['af'],
): Verdict {
  const montant = openfisca.af ?? Number.NaN
  if (s.domicileFiscal !== 'Métropole') {
    return { categorie: 'difference_de_perimetre', motif: 'c0.7 ne modélise que la métropole.' }
  }
  const differents = parametresAFDifferents(parametres.mois)
  if (differents.length > 0) {
    // Valeur locale introuvable à toute date : ce n'est pas un simple décalage de millésime.
    const absents = differents.filter((c) => !parametres.historique[c].some((v) => egal(v.valeur, AF[c])))
    return absents.length === 0
      ? {
          categorie: 'difference_de_millesime',
          motif: `Valeurs c0.7 connues à d’autres dates : ${differents.join(', ')}.`,
        }
      : {
          categorie: 'divergence_simulateur',
          motif: `Valeurs c0.7 absentes de tout millésime OpenFisca : ${absents.map((c) => `${c}=${AF[c]}`).join(', ')}.`,
        }
  }
  const forfait =
    (openfisca.details.af_allocation_forfaitaire ?? 0) +
    (openfisca.details.af_allocation_forfaitaire_complement_degressif ?? 0)
  if (forfait > 0 && Math.abs(montant - forfait - local) <= TOLERANCE_AF_EUROS) {
    return {
      categorie: 'difference_de_perimetre',
      motif: 'OpenFisca ajoute l’allocation forfaitaire (enfant de 20 ans), non modélisée par c0.7.',
    }
  }
  return {
    categorie: 'divergence_simulateur',
    motif: 'Mêmes paramètres, montants différents : la règle de calcul diffère.',
  }
}

export function comparer(scenarios: Scenario[], sortie: SortieOk): Ecart[] {
  const parId = new Map(sortie.results.map((r) => [r.id, r]))
  const ecarts: Ecart[] = []
  for (const s of scenarios) {
    const openfisca = parId.get(s.id)
    if (!openfisca) throw new Error(`Résultat OpenFisca manquant pour ${s.id}.`)
    const ajouter = (champ: Ecart['champ'], bugdeloi: number, autre: number, verdict: Verdict) =>
      ecarts.push({
        scenario: s.id,
        domaine: s.domaine,
        champ,
        ...verdict,
        bugdeloi,
        openfisca: autre,
        entree: s,
      })

    if (s.domaine === 'ir') {
      const local = calculerIRLocal(s)
      const impot = openfisca.impot_revenu
      const parts = openfisca.details.nbptr
      if (impot === null || parts === undefined) throw new Error(`Résultat IR incomplet pour ${s.id}.`)
      if (!egal(parts, local.nombreDeParts)) {
        ajouter('nombre_de_parts', local.nombreDeParts, parts, {
          categorie: 'divergence_simulateur',
          motif: 'Nombre de parts différent.',
        })
      }
      if (Math.abs(impot - local.impotRevenu) > TOLERANCE_IR_EUROS) {
        ajouter(
          'impot_revenu',
          local.impotRevenu,
          impot,
          classerEcartIR(s, openfisca, local.impotRevenu, sortie.parametres.ir),
        )
      }
    } else {
      if (openfisca.af === null) throw new Error(`Résultat AF manquant pour ${s.id}.`)
      const local = calculerAFLocal(s)
      if (Math.abs(openfisca.af - local) > TOLERANCE_AF_EUROS) {
        ajouter('af', local, openfisca.af, classerEcartAF(s, openfisca, local, sortie.parametres.af))
      }
    }
  }
  return ecarts
}
