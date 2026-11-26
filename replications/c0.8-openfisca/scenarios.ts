import { calculExact, type Foyer, nombreDeDemiParts, unitesParEuro } from '../c0.6/ir2026.ts'
import { AF } from '../c0.7/parametres.ts'
import type { BaremeAF } from './bridge.ts'

/** Foyer échangé avec `compare_openfisca.py`. */
export interface Scenario {
  id: string
  domaine: 'ir' | 'af'
  /** IR : revenu net imposable. AF : base de ressources annuelle. En euros entiers. */
  revenuEuros: number
  situationFamiliale: Foyer['situationFamiliale']
  agesEnfants: number[]
  appreciationVitSeul: boolean
  domicileFiscal: Foyer['domicileFiscal']
}

interface ProfilIR {
  id: string
  situationFamiliale: Foyer['situationFamiliale']
  enfants: number
  appreciationVitSeul?: boolean
  domicileFiscal?: Foyer['domicileFiscal']
}

export const PROFILS_IR: ProfilIR[] = [
  { id: 'celibataire', situationFamiliale: 'Célibataire', enfants: 0 },
  { id: 'celibataire-1-enfant', situationFamiliale: 'Célibataire', enfants: 1 },
  { id: 'parent-isole-1', situationFamiliale: 'Célibataire', enfants: 1, appreciationVitSeul: true },
  { id: 'divorce-isole-3', situationFamiliale: 'Divorcé', enfants: 3, appreciationVitSeul: true },
  { id: 'veuf', situationFamiliale: 'Veuf', enfants: 0 },
  { id: 'veuf-2-enfants', situationFamiliale: 'Veuf', enfants: 2 },
  { id: 'couple', situationFamiliale: 'ImpositionCommune', enfants: 0 },
  { id: 'couple-2-enfants', situationFamiliale: 'ImpositionCommune', enfants: 2 },
  { id: 'couple-3-enfants', situationFamiliale: 'ImpositionCommune', enfants: 3 },
  {
    id: 'gmr-celibataire',
    situationFamiliale: 'Célibataire',
    enfants: 0,
    domicileFiscal: 'GuadeloupeMartiniqueRéunion',
  },
  { id: 'gm-couple-2', situationFamiliale: 'ImpositionCommune', enfants: 2, domicileFiscal: 'GuyaneMayotte' },
]

const REVENUS_TEMOINS = [0, 30_000, 60_000, 120_000]
// Seuils du barème, CGI 197 I.1, LEGIARTI000053542636@2026-02-21 (repris de c0.6).
export const SEUILS_BAREME = [11_600, 29_579, 84_577, 181_917]
const REVENU_MAX_RECHERCHE = 1_000_000
// Au-dessus des seuils du barème : sert à observer un composant hors périmètre de c0.6.
const REVENU_HORS_PERIMETRE = 300_000
const AGES_SANS_MAJORATION = [10, 8, 6, 4]

const autour = (seuil: number) => [seuil - 1, seuil, seuil + 1].filter((r) => r >= 0)

/** Premier revenu entier où un prédicat monotone devient vrai, ou `null`. */
export function premierRevenu(predicat: (revenu: number) => boolean, max = REVENU_MAX_RECHERCHE) {
  if (!predicat(max)) return null
  let bas = 0
  let haut = max
  while (bas < haut) {
    const milieu = Math.floor((bas + haut) / 2)
    if (predicat(milieu)) haut = milieu
    else bas = milieu + 1
  }
  return bas
}

/** Seuils d'un profil : barème × parts, puis points de bascule observés dans le moteur c0.6. */
export function seuilsIR(foyer: Foyer): number[] {
  const demiParts = Number(nombreDeDemiParts(foyer).demiParts)
  const exact = (revenu: number) => calculExact(BigInt(revenu), foyer)
  const bascules = [
    // Entrée dans l'impôt (impôt net strictement positif).
    premierRevenu((r) => exact(r).net > 0n),
    // Mise en recouvrement : CGI 1657 1 bis (61 €, arrondi à l'euro : 60,50 € -> 61 €).
    premierRevenu((r) => exact(r).net * 2n >= 121n * unitesParEuro),
    // Sortie de la décote.
    premierRevenu((r) => exact(r).regimeDecote === 'nulle'),
    // Début du plafonnement du quotient familial.
    premierRevenu((r) => exact(r).qfPlafonne),
  ]
  const bareme = SEUILS_BAREME.map((seuil) => Math.round((seuil * demiParts) / 2))
  return [...new Set([...bareme, ...bascules.filter((b) => b !== null)])].sort((a, b) => a - b)
}

export function scenariosIR(): Scenario[] {
  const scenarios: Scenario[] = []
  for (const profil of PROFILS_IR) {
    const foyer: Foyer = {
      situationFamiliale: profil.situationFamiliale,
      enfantsAChargeExclusiveOuPrincipale: profil.enfants,
      appreciationVitSeul: profil.appreciationVitSeul ?? false,
      domicileFiscal: profil.domicileFiscal ?? 'Métropole',
    }
    const revenus = [...new Set([...REVENUS_TEMOINS, ...seuilsIR(foyer).flatMap(autour)])].sort(
      (a, b) => a - b,
    )
    if (profil.id === 'celibataire') revenus.push(REVENU_HORS_PERIMETRE)
    for (const revenu of revenus) {
      scenarios.push({
        id: `ir-${profil.id}-${revenu}`,
        domaine: 'ir',
        revenuEuros: revenu,
        situationFamiliale: foyer.situationFamiliale,
        agesEnfants: AGES_SANS_MAJORATION.slice(0, profil.enfants),
        appreciationVitSeul: foyer.appreciationVitSeul,
        domicileFiscal: foyer.domicileFiscal,
      })
    }
  }
  return scenarios
}

function foyerAF(
  nom: string,
  ages: number[],
  revenu: number,
  domicileFiscal: Foyer['domicileFiscal'] = 'Métropole',
): Scenario {
  return {
    id: `af-${nom}-${ages.join('.')}-${revenu}`,
    domaine: 'af',
    revenuEuros: revenu,
    situationFamiliale: 'ImpositionCommune',
    agesEnfants: ages,
    appreciationVitSeul: false,
    domicileFiscal,
  }
}

/**
 * Foyers AF : chaque plafond ± 1 € des barèmes fournis (c0.7, plus ceux lus dans OpenFisca à
 * l'exécution), majorations pour âge, et deux cas hors périmètre de c0.7.
 */
export function scenariosAF(autresBaremes: BaremeAF[] = []): Scenario[] {
  const baremes: BaremeAF[] = [AF, ...autresBaremes]
  const scenarios: Scenario[] = [foyerAF('un-enfant', [10], 30_000)]
  for (const enfants of [2, 3, 4]) {
    const seuils = baremes.flatMap((b) =>
      [b.plafond1BaseEuros, b.plafond2BaseEuros].map(
        (base) => base + enfants * b.majorationPlafondParEnfantEuros,
      ),
    )
    const revenus = [...new Set([30_000, 200_000, ...seuils.flatMap(autour)])].sort((a, b) => a - b)
    for (const revenu of revenus) {
      scenarios.push(foyerAF('seuils', AGES_SANS_MAJORATION.slice(0, enfants), revenu))
    }
  }
  // Âges 18 et 19 ans seulement : entre 14 et 17 ans, le droit à la majoration dépend de la date
  // de naissance, que ce différentiel ne modélise pas.
  for (const ages of [
    [19, 10],
    [19, 18],
    [19, 10, 8],
    [19, 18, 10],
  ]) {
    scenarios.push(foyerAF('majoration', ages, 30_000))
  }
  scenarios.push(foyerAF('forfait-20-ans', [20, 10, 8], 30_000))
  scenarios.push(foyerAF('outre-mer', [10], 20_000, 'GuadeloupeMartiniqueRéunion'))
  return scenarios
}

export function genererScenarios(autresBaremesAF: BaremeAF[] = []): Scenario[] {
  return [...scenariosIR(), ...scenariosAF(autresBaremesAF)]
}
