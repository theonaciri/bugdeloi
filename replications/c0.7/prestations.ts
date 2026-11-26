import { AF, APL, MINIMA } from './parametres.ts'

/**
 * Prestations du modèle C0.7 : allocations familiales, aide au logement, RSA et prime d'activité.
 * Modèle statutaire simplifié : situation stable toute l'année, métropole, sources dans parametres.ts.
 */

const centimes = (n: number) => Math.round(n * 100) / 100

export type TrancheAF = 'taux_plein' | 'taux_reduit_50' | 'taux_reduit_25' | 'non_eligible'

export interface OptionsAF {
  /** Enfants ouvrant droit à la majoration pour âge (CSS R521-1), tous à charge principale. */
  enfantsOuvrantMajoration?: number
  /** Parmi `enfants`, ceux en résidence alternée avec partage des allocations (CSS L521-2, R521-3). */
  enfantsAlternes?: number
}

/** Allocations familiales annuelles (CSS L521-1, D521-1). `enfants` compte tous les enfants à charge. */
export function calculAllocationsFamilialesAnnuelles(
  revenuAnnuelEuros: number,
  enfants: number,
  { enfantsOuvrantMajoration = 0, enfantsAlternes = 0 }: OptionsAF = {},
): { annuelEuros: number; majorationAgeAnnuelleEuros: number; tranche: TrancheAF } {
  if (enfantsAlternes > enfants) throw new RangeError('Plus d’enfants en alternance que d’enfants.')
  if (enfantsAlternes > 0 && enfantsOuvrantMajoration > 0) {
    // CSS R521-4 réduit de moitié certaines majorations : combinaison non modélisée.
    throw new RangeError('Majoration pour âge avec résidence alternée : cas non modélisé.')
  }
  if (enfants < 2) return { annuelEuros: 0, majorationAgeAnnuelleEuros: 0, tranche: 'non_eligible' }

  const taux = AF.tauxDeuxiemeEnfant + (enfants - 2) * AF.tauxEnfantSupplementaire
  // CSS L521-3 et R521-1 : l'aîné n'ouvre droit à la majoration qu'à partir de trois enfants.
  const eligibles = Math.min(enfantsOuvrantMajoration, enfants)
  const majorations = enfants === 2 ? Math.max(0, eligibles - 1) : eligibles
  const plein = AF.bmafMensuelleEuros * (taux + majorations * AF.tauxMajorationAge) * 12

  const majorationPlafond = enfants * AF.majorationPlafondParEnfantEuros
  const plafond1 = AF.plafond1BaseEuros + majorationPlafond
  const plafond2 = AF.plafond2BaseEuros + majorationPlafond

  let diviseur = 1
  let plafondFranchi: number | undefined
  let tranche: TrancheAF = 'taux_plein'
  if (revenuAnnuelEuros > plafond2) {
    diviseur = 4
    plafondFranchi = plafond2
    tranche = 'taux_reduit_25'
  } else if (revenuAnnuelEuros > plafond1) {
    diviseur = 2
    plafondFranchi = plafond1
    tranche = 'taux_reduit_50'
  }
  const reduit = plein / diviseur
  // CSS D521-1 II : complément dégressif juste au-dessus d'un plafond.
  const complement =
    plafondFranchi === undefined ? 0 : Math.max(0, plafondFranchi + reduit - revenuAnnuelEuros)
  // CSS R521-3 : nombre moyen d'enfants rapporté au nombre total.
  const coefficient = (enfants - enfantsAlternes / 2) / enfants

  return {
    annuelEuros: centimes((reduit + complement) * coefficient),
    majorationAgeAnnuelleEuros: centimes(
      ((AF.bmafMensuelleEuros * majorations * AF.tauxMajorationAge * 12) / diviseur) * coefficient,
    ),
    tranche,
  }
}

export type ZoneLogement = 1 | 2 | 3

export interface EntreeAPL {
  couple: boolean
  enfantsExclusifs: number
  enfantsAlternes: number
  zone: ZoneLogement
  loyerMensuelEuros: number
  /** Ressources annuelles retenues (revenus nets catégoriels, CCH R822-4). */
  ressourcesAnnuellesEuros: number
}

/** CCH D823-16 et D823-17 : résultat de la formule, avant minoration forfaitaire et CRDS. */
function formuleAPL(entree: EntreeAPL, personnes: number): number {
  const { couple, zone, loyerMensuelEuros, ressourcesAnnuellesEuros } = entree
  const grille = APL.plafondsLoyer[zone]
  const selonComposition = (g: { seul: number; couple: number; unePersonne: number }, supplement: number) => {
    if (personnes === 0) return couple ? g.couple : g.seul
    return g.unePersonne + (personnes - 1) * supplement
  }
  const plafond = selonComposition(grille, grille.parPersonneSupplementaire)
  const loyer = Math.min(loyerMensuelEuros, plafond)
  const charges = APL.forfaitCharges.base + personnes * APL.forfaitCharges.parPersonneACharge

  const p0 = Math.max(APL.p0Taux * (loyer + charges), APL.p0MinimumEuros)
  const tf =
    personnes === 0
      ? couple
        ? APL.tfCouple
        : APL.tfSeul
      : (APL.tfAvecPersonnes[personnes - 1] ??
        APL.tfSixPersonnes + (personnes - 6) * APL.tfParPersonneAuDelaDeSix)
  const reference = selonComposition(APL.loyerReference, APL.loyerReference.parPersonneSupplementaire)
  const rapport = Math.round((loyer / reference) * 10_000) / 100
  const tlBrut =
    (Math.max(0, Math.min(rapport, APL.tlSeuilHaut) - APL.tlSeuilBas) * APL.tlTauxMoyen +
      Math.max(0, rapport - APL.tlSeuilHaut) * APL.tlTauxHaut) /
    100
  const tl = Math.round(tlBrut * 1000) / 1000

  const r0 =
    personnes === 0
      ? couple
        ? APL.r0Couple
        : APL.r0Seul
      : (APL.r0AvecPersonnes[personnes - 1] ??
        APL.r0SixPersonnes + (personnes - 6) * APL.r0ParPersonneAuDelaDeSix)
  // CCH D823-17 4° : ressources arrondies à la centaine d'euros supérieure.
  const ressources = Math.ceil(Math.max(0, ressourcesAnnuellesEuros) / 100) * 100
  const participation = p0 + ((tf + tl) / 100) * Math.max(0, ressources - r0)

  const aide = Math.max(0, loyer + charges - participation)
  // CCH D823-16 et arrêté art. 10 : diminution quand le loyer réel dépasse un plafond élevé.
  const coefficients = APL.degressivite[zone]
  const debut = coefficients.premier * plafond
  const fin = coefficients.second * plafond
  const reste = Math.min(1, Math.max(0, (fin - loyerMensuelEuros) / (fin - debut)))
  return aide * reste
}

/** Aide au logement mensuelle versée, en euros. */
export function calculAPLMensuelle(entree: EntreeAPL): number {
  if (entree.loyerMensuelEuros <= 0) return 0
  const sans = formuleAPL(entree, entree.enfantsExclusifs)
  let formule = sans
  if (entree.enfantsAlternes > 0) {
    // CE 398563 : la part liée aux enfants en alternance est servie au prorata du temps d'accueil.
    const avec = formuleAPL(entree, entree.enfantsExclusifs + entree.enfantsAlternes)
    formule = sans + (avec - sans) * APL.coefficientResidenceAlternee
  }
  const minoree = Math.max(0, formule - APL.minorationForfaitaireEuros)
  // CCH D823-16 : montant net de CRDS arrondi à l'euro inférieur.
  return Math.floor(minoree * (1 - APL.tauxCrds))
}

export interface CompositionMinima {
  couple: boolean
  /** Enfants comptés dans le foyer RSA et prime d'activité. */
  enfants: number
  /** Appréciation : parent isolé ouvrant droit à la majoration temporaire (CSS L842-7, CASF L262-9). */
  appreciationIsoleMajore: boolean
}

/** CSS D843-1 et CASF R262-1 : montant forfaitaire selon la composition du foyer. */
export function montantForfaitaire(baseEuros: number, composition: CompositionMinima): number {
  const { couple, enfants, appreciationIsoleMajore } = composition
  if (appreciationIsoleMajore && !couple) {
    return baseEuros * (MINIMA.isoleMajore + enfants * MINIMA.isoleSupplementParEnfant)
  }
  let coefficient = couple ? 1 + MINIMA.majorationDeuxiemePersonne : 1
  for (let rang = 1; rang <= enfants; rang++) {
    if (rang === 1 && !couple) coefficient += MINIMA.majorationDeuxiemePersonne
    else if (rang >= 3) coefficient += MINIMA.majorationAPartirDuTroisiemeEnfant
    else coefficient += MINIMA.majorationPersonneSupplementaire
  }
  return baseEuros * coefficient
}

/** CSS R844-3 et R844-4, CASF R262-9 : part de l'aide au logement comptée comme ressource. */
export function aideLogementComptee(
  baseEuros: number,
  composition: CompositionMinima,
  aideMensuelleEuros: number,
): number {
  const personnes = (composition.couple ? 2 : 1) + composition.enfants
  const forfait =
    personnes === 1
      ? baseEuros * MINIMA.forfaitLogementUnePersonne
      : personnes === 2
        ? baseEuros * 1.5 * MINIMA.forfaitLogementDeuxPersonnes
        : baseEuros * 1.8 * MINIMA.forfaitLogementTroisPersonnes
  return Math.min(aideMensuelleEuros, forfait)
}

export interface EntreeMinima extends CompositionMinima {
  revenusProfessionnelsMensuelsEuros: number[]
  /** Allocations familiales de base mensuelles (la majoration pour âge est exclue, CSS R844-5). */
  allocationsFamilialesMensuellesEuros: number
  aideLogementMensuelleEuros: number
}

const somme = (valeurs: number[]) => valeurs.reduce((total, v) => total + v, 0)

/** RSA mensuel : montant forfaitaire moins les ressources du foyer (CASF L262-2). */
export function calculRsaMensuel(entree: EntreeMinima): number {
  const base = MINIMA.rsaForfaitaireEuros
  const ressources =
    somme(entree.revenusProfessionnelsMensuelsEuros) +
    entree.allocationsFamilialesMensuellesEuros +
    aideLogementComptee(base, entree, entree.aideLogementMensuelleEuros)
  const montant = centimes(montantForfaitaire(base, entree) - ressources)
  return montant < MINIMA.rsaMinimumVerseEuros ? 0 : montant
}

/** CSS D843-2 : bonification individuelle d'un travailleur. */
export function bonificationMensuelle(revenuProfessionnelMensuelEuros: number): number {
  const seuil = MINIMA.bonificationSeuilEnSmicHoraires * MINIMA.smicHoraireBrutEuros
  const plein = MINIMA.bonificationPleineEnSmicHoraires * MINIMA.smicHoraireBrutEuros
  const part = Math.min(1, Math.max(0, (revenuProfessionnelMensuelEuros - seuil) / (plein - seuil)))
  return part * MINIMA.bonificationTauxMaximal * MINIMA.primeForfaitaireEuros
}

/** Prime d'activité mensuelle (CSS L842-3). */
export function calculPrimeActiviteMensuelle(entree: EntreeMinima): number {
  const professionnels = somme(entree.revenusProfessionnelsMensuelsEuros)
  // CSS L842-1 : la prime suppose une activité professionnelle.
  if (professionnels <= 0) return 0
  const base = MINIMA.primeForfaitaireEuros
  const forfait = montantForfaitaire(base, entree)
  const ressources =
    professionnels +
    entree.allocationsFamilialesMensuellesEuros +
    aideLogementComptee(base, entree, entree.aideLogementMensuelleEuros)
  const montant = centimes(
    forfait +
      MINIMA.fractionRevenusProfessionnels * professionnels +
      somme(entree.revenusProfessionnelsMensuelsEuros.map(bonificationMensuelle)) -
      // CSS L842-3 2° : les ressources sont réputées au moins égales au montant forfaitaire.
      Math.max(ressources, forfait),
  )
  return montant < MINIMA.primeMinimumVerseeEuros ? 0 : montant
}
