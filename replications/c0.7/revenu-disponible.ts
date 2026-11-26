import { calculIR2026, type Foyer } from '../c0.6/ir2026.ts'
import { calculImpot2026, type FoyerEtendu } from './impot-parts.ts'
import { DATE_DE_CALCUL } from './parametres.ts'
import {
  calculAllocationsFamilialesAnnuelles,
  calculAPLMensuelle,
  calculPrimeActiviteMensuelle,
  calculRsaMensuel,
  type EntreeMinima,
  type TrancheAF,
  type ZoneLogement,
} from './prestations.ts'

export type { FoyerEtendu } from './impot-parts.ts'
export { calculAllocationsFamilialesAnnuelles, type ZoneLogement } from './prestations.ts'

/**
 * Moteur combiné « revenu disponible » : impôt sur le revenu 2026 + allocations familiales
 * + aide personnalisée au logement + RSA et prime d'activité, et simulateur d'amendement.
 *
 * Revenu disponible = revenu - impôt + allocations familiales + aide au logement
 * + prime d'activité + RSA, sur un an, avant paiement du loyer.
 *
 * Hypothèses simplificatrices (voir HYPOTHESES) : un seul montant de revenu sert à toutes les lois.
 * Sources et constantes : parametres.ts.
 */

export const HYPOTHESES = [
  'Revenu stable : la même année sert à l’impôt, aux allocations, à l’aide au logement et à la prime d’activité. En réalité, chaque aide regarde une période différente.',
  'Le même montant sert de revenu net imposable et de revenu perçu. Les déductions et abattements propres à chaque aide ne sont pas appliqués.',
  'Métropole. Location d’un logement ordinaire, hors colocation, chambre, foyer, accession et réduction de loyer de solidarité.',
  'Toutes les aides auxquelles le foyer a droit sont demandées ; conditions d’âge, de résidence et de patrimoine supposées remplies.',
  'Résidence alternée : allocations familiales partagées, aide au logement au prorata de la moitié de l’année.',
  'Allocations familiales affichées avant la contribution sociale de 0,5 % (CRDS).',
  'Non modélisés : complément familial, allocation de rentrée scolaire, chèque énergie, prime de Noël, crédits d’impôt et autres aides.',
] as const

export interface OptionsRevenuDisponible {
  /** Enfants ouvrant droit à la majoration pour âge des allocations familiales. */
  enfantsOuvrantMajoration?: number
  /** Si présent, calcule l'aide au logement d'un locataire. */
  logement?: { zone: ZoneLogement; loyerMensuelEuros: number }
  /** Si présent, le revenu est un revenu d'activité : calcule RSA et prime d'activité. */
  activite?: {
    /** Couple : le revenu est partagé à parts égales entre deux travailleurs. */
    deuxRevenus?: boolean
    /** Appréciation : parent isolé ouvrant droit à la majoration temporaire. */
    appreciationIsoleMajore?: boolean
    /** Appréciation : les enfants en alternance sont comptés dans ce foyer pour le RSA et la prime. */
    appreciationCompterEnfantsAlternes?: boolean
  }
}

export interface ResultatRevenuDisponible {
  revenuNetImposableEuros: number
  impotMisEnRecouvrementEuros: number
  impotBrutAvant1657Euros: number
  allocationsFamilialesAnnuellesEuros: number
  aideLogementAnnuelleEuros: number
  primeActiviteAnnuelleEuros: number
  rsaAnnuelEuros: number
  trancheAF: TrancheAF
  revenuDisponibleEuros: number
  nombreDeParts: number
  /** Vrai quand aucun état RSA / aide au logement n'est cohérent : le RSA est alors mis à zéro. */
  rsaAplIndetermine: boolean
}

const centimes = (n: number) => Math.round(n * 100) / 100

export function calculRevenuDisponible(
  revenuNetImposableEuros: number,
  foyer: FoyerEtendu,
  options: OptionsRevenuDisponible = {},
): ResultatRevenuDisponible {
  const revenu = Math.max(0, revenuNetImposableEuros)
  const ir = calculImpot2026(revenu, foyer)
  const exclusifs = foyer.enfantsAChargeExclusiveOuPrincipale
  const alternes = foyer.enfantsEnResidenceAlternee ?? 0
  const af = calculAllocationsFamilialesAnnuelles(revenu, exclusifs + alternes, {
    enfantsAlternes: alternes,
    enfantsOuvrantMajoration: options.enfantsOuvrantMajoration ?? 0,
  })
  const couple = foyer.situationFamiliale === 'ImpositionCommune'
  const { logement, activite } = options

  const aide = (ressourcesAnnuellesEuros: number) =>
    logement
      ? calculAPLMensuelle({
          ...logement,
          couple,
          enfantsExclusifs: exclusifs,
          enfantsAlternes: alternes,
          ressourcesAnnuellesEuros,
        })
      : 0

  let aideMensuelle = aide(revenu)
  let rsa = 0
  let prime = 0
  let rsaAplIndetermine = false

  if (activite) {
    const mensuel = revenu / 12
    const minima = (aideLogementMensuelleEuros: number): EntreeMinima => ({
      couple,
      enfants: exclusifs + (activite.appreciationCompterEnfantsAlternes ? alternes : 0),
      appreciationIsoleMajore:
        !couple &&
        foyer.appreciationVitSeul &&
        exclusifs + alternes > 0 &&
        (activite.appreciationIsoleMajore ?? false),
      revenusProfessionnelsMensuelsEuros:
        couple && activite.deuxRevenus ? [mensuel / 2, mensuel / 2] : [mensuel],
      allocationsFamilialesMensuellesEuros: (af.annuelEuros - af.majorationAgeAnnuelleEuros) / 12,
      aideLogementMensuelleEuros,
    })
    // CCH R822-17 : pour un bénéficiaire du RSA, l'aide au logement ignore les revenus d'activité.
    const aideSousRsa = aide(0)
    const rsaSousRsa = calculRsaMensuel(minima(aideSousRsa))
    if (rsaSousRsa > 0) {
      aideMensuelle = aideSousRsa
      rsa = rsaSousRsa
    } else {
      rsaAplIndetermine = calculRsaMensuel(minima(aideMensuelle)) > 0
    }
    prime = calculPrimeActiviteMensuelle(minima(aideMensuelle))
  }

  const impot = ir.impotMisEnRecouvrementEuros
  const aideLogementAnnuelleEuros = aideMensuelle * 12
  const primeActiviteAnnuelleEuros = centimes(prime * 12)
  const rsaAnnuelEuros = centimes(rsa * 12)

  return {
    revenuNetImposableEuros: revenu,
    impotMisEnRecouvrementEuros: impot,
    impotBrutAvant1657Euros: ir.impotAvantRecouvrementEuros,
    allocationsFamilialesAnnuellesEuros: af.annuelEuros,
    aideLogementAnnuelleEuros,
    primeActiviteAnnuelleEuros,
    rsaAnnuelEuros,
    trancheAF: af.tranche,
    revenuDisponibleEuros: centimes(
      revenu -
        impot +
        af.annuelEuros +
        aideLogementAnnuelleEuros +
        primeActiviteAnnuelleEuros +
        rsaAnnuelEuros,
    ),
    nombreDeParts: ir.nombreDeParts,
    rsaAplIndetermine,
  }
}

export interface PropositionAmendement {
  id: string
  titre: string
  description: string
  /** Ex. +2 pour indexer les seuils du barème de +2 % (simulation illustrative). */
  indexationBaremePct?: number
  /** Si vrai, supprime la falaise de 61 € (CGI art. 1657 1 bis) en appliquant un prélèvement dès 1 €. */
  supprimerSeuil61?: boolean
  /** Si vrai, supprime la décote (CGI art. 197 I.4.a). */
  supprimerDecote?: boolean
}

export const AMENDEMENTS_EXEMPLES: PropositionAmendement[] = [
  {
    id: 'indexation-2pct',
    titre: 'Indexer les seuils du barème de +2 %',
    description: 'Revalorise de 2 % toutes les tranches du barème 2026 (simulation type PLF).',
    indexationBaremePct: 2,
  },
  {
    id: 'supprimer-seuil-61',
    titre: 'Supprimer le seuil de recouvrement de 61 €',
    description: 'Supprime la falaise de l’article 1657 1 bis : l’impôt est prélevé dès 1 €.',
    supprimerSeuil61: true,
  },
  {
    id: 'supprimer-decote',
    titre: 'Supprimer la décote (art. 197 I.4.a)',
    description:
      'Supprime le pic marginal à 43,58 % et le taux de 15,98 %, au prix d’une hausse d’impôt pour les foyers modestes.',
    supprimerDecote: true,
  },
]

export function simulerAmendementIR(
  revenuNetImposableEuros: number,
  foyer: Foyer,
  amendement: PropositionAmendement,
): { loiEnVigueurEuros: number; apresAmendementEuros: number; ecartEuros: number } {
  const base = calculIR2026({
    dateDeCalcul: DATE_DE_CALCUL,
    revenuNetImposableCentimes: Math.max(0, Math.round(revenuNetImposableEuros)) * 100,
    ...foyer,
  })
  const loiEnVigueurEuros = base.impotMisEnRecouvrement / 100

  const apres = base
  if (amendement.indexationBaremePct && amendement.indexationBaremePct !== 0) {
    // Indexe uniquement les 4 seuils du barème (CGI art. 197 I.1), sans déplacer la décote,
    // les plafonds du quotient familial ni le seuil de recouvrement de 61 €.
    const factor = 1 + amendement.indexationBaremePct / 100
    const seuils = [11600, 29579, 84577, 181917].map((s) => Math.round(s * factor))
    const [s1 = 11600, s2 = 29579, s3 = 84577, s4 = 181917] = seuils
    const cotisationIndexee = (rev: number, p: number) => {
      const rPart = rev / p
      let c = 0
      if (rPart > s1) c += (Math.min(rPart, s2) - s1) * 0.11
      if (rPart > s2) c += (Math.min(rPart, s3) - s2) * 0.3
      if (rPart > s3) c += (Math.min(rPart, s4) - s3) * 0.41
      if (rPart > s4) c += (rPart - s4) * 0.45
      return c * p
    }
    const revArrondi = Math.max(0, Math.round(revenuNetImposableEuros))
    const isCouple = foyer.situationFamiliale === 'ImpositionCommune'
    const refParts = isCouple ? 2 : 1
    const parts = base.nombreDeParts
    const brut = cotisationIndexee(revArrondi, parts)
    const refImpot = cotisationIndexee(revArrondi, refParts)
    const extraHalfParts = (parts - refParts) * 2
    const isParentIsole =
      (foyer.situationFamiliale === 'Célibataire' || foyer.situationFamiliale === 'Divorcé') &&
      foyer.appreciationVitSeul &&
      foyer.enfantsAChargeExclusiveOuPrincipale >= 1
    const isVeufEnfants =
      foyer.situationFamiliale === 'Veuf' && foyer.enfantsAChargeExclusiveOuPrincipale >= 1
    const maxRed =
      (isParentIsole ? 4262 + (extraHalfParts - 2) * 1807 : extraHalfParts * 1807) +
      (isVeufEnfants ? 2011 : 0)
    const apresQf = Math.max(brut, refImpot - maxRed)
    const refaction =
      foyer.domicileFiscal === 'GuyaneMayotte'
        ? Math.min(4050, apresQf * 0.4)
        : foyer.domicileFiscal === 'GuadeloupeMartiniqueRéunion'
          ? Math.min(2450, apresQf * 0.3)
          : 0
    const apresRef = apresQf - refaction
    const forfaitDecote = isCouple ? 1483 : 897
    const decote = Math.min(apresRef, Math.max(0, forfaitDecote - apresRef * 0.4525))
    const arrondi = Math.round(apresRef - decote)
    const impotAjuste = arrondi < 61 ? 0 : arrondi
    return {
      loiEnVigueurEuros,
      apresAmendementEuros: impotAjuste,
      ecartEuros: Math.round((impotAjuste - loiEnVigueurEuros) * 100) / 100,
    }
  }

  if (amendement.supprimerDecote) {
    const sansDecote = Math.round((base.impotApresPlafondQf - base.refactionOutreMer) / 100)
    const misEnRecouvrement = sansDecote < 61 ? 0 : sansDecote
    return {
      loiEnVigueurEuros,
      apresAmendementEuros: misEnRecouvrement,
      ecartEuros: Math.round((misEnRecouvrement - loiEnVigueurEuros) * 100) / 100,
    }
  }

  if (amendement.supprimerSeuil61) {
    const apresAmendementEuros = apres.impotArrondiEuro / 100
    return {
      loiEnVigueurEuros,
      apresAmendementEuros,
      ecartEuros: Math.round((apresAmendementEuros - loiEnVigueurEuros) * 100) / 100,
    }
  }

  return { loiEnVigueurEuros, apresAmendementEuros: loiEnVigueurEuros, ecartEuros: 0 }
}
