/**
 * Constantes du modèle C0.7, chacune rattachée à sa source.
 *
 * Millésime : droit en vigueur au 1er juillet 2026, métropole.
 * Les identifiants LEGIARTI désignent la version du texte lue dans la base LEGI.
 */

export const DATE_DE_CALCUL = '2026-07-01'

/** Allocations familiales. */
export const AF = {
  // BMAF au 1er avril 2026. Source hors LEGI : solidarites.gouv.fr,
  // « Revalorisation annuelle des prestations sociales au 1er avril 2026 » (voir SOURCES).
  bmafMensuelleEuros: 478.16,
  // CSS D521-3 III prévoit une revalorisation annuelle des plafonds.
  // TODO juridique : montants 2026 relevés au barème CAF (79 980 € et 106 604 € pour deux enfants,
  // 6 664 € par enfant). Le texte officiel n'est pas dans la base LEGI locale et reste à relire.
  plafond1BaseEuros: 66652,
  plafond2BaseEuros: 93276,
  majorationPlafondParEnfantEuros: 6664,
  // CSS D521-1 I, LEGIARTI000030680318.
  tauxDeuxiemeEnfant: 0.32,
  tauxEnfantSupplementaire: 0.41,
  tauxMajorationAge: 0.16,
} as const

/** Aide personnalisée au logement, secteur locatif (logement ordinaire, hors colocation et chambre). */
export const APL = {
  // Arrêté du 27 septembre 2019, art. 7, LEGIARTI000052233874 : plafonds de loyer mensuels.
  plafondsLoyer: {
    1: { seul: 333.14, couple: 401.78, unePersonne: 454.1, parPersonneSupplementaire: 65.89 },
    2: { seul: 290.34, couple: 355.38, unePersonne: 399.89, parPersonneSupplementaire: 58.21 },
    3: { seul: 272.12, couple: 329.88, unePersonne: 369.88, parPersonneSupplementaire: 53.01 },
  },
  // Même arrêté, art. 9, LEGIARTI000052233864 : forfait charges mensuel.
  forfaitCharges: { base: 60.59, parPersonneACharge: 13.74 },
  // Art. 10, LEGIARTI000039160745 : coefficients de dégressivité puis de suppression.
  degressivite: {
    1: { premier: 3.4, second: 4 },
    2: { premier: 2.5, second: 3.1 },
    3: { premier: 2.5, second: 3.1 },
  },
  // Art. 11, LEGIARTI000039160747 : minoration forfaitaire mensuelle.
  minorationForfaitaireEuros: 5,
  // Art. 13, LEGIARTI000052233857 : participation minimale P0.
  p0Taux: 0.085,
  p0MinimumEuros: 39.56,
  // Art. 14, LEGIARTI000052233852 : taux familial TF (en %), seul, couple, puis 1 à 6 personnes à charge.
  tfSeul: 2.83,
  tfCouple: 3.15,
  tfAvecPersonnes: [2.7, 2.38, 2.01, 1.85, 1.79, 1.73],
  tfSixPersonnes: 1.73,
  tfParPersonneAuDelaDeSix: -0.06,
  // Art. 14 : taux complémentaire TL par tranche du rapport loyer / loyer de référence (en %).
  tlSeuilBas: 45,
  tlSeuilHaut: 75,
  tlTauxMoyen: 0.45,
  tlTauxHaut: 0.68,
  loyerReference: { seul: 290.34, couple: 355.38, unePersonne: 399.89, parPersonneSupplementaire: 58.21 },
  // Art. 15, LEGIARTI000050931814 : abattement annuel R0, 1 à 6 personnes à charge.
  r0Seul: 5235,
  r0Couple: 7501,
  r0AvecPersonnes: [8947, 9148, 9498, 9851, 10202, 10554],
  r0SixPersonnes: 10554,
  r0ParPersonneAuDelaDeSix: 346,
  // Ordonnance n° 96-50, art. 19, LEGIARTI000041466982 : CRDS de 0,5 %.
  tauxCrds: 0.005,
  // CE, 21 juillet 2017, n° 398563 : part de l'aide liée à l'enfant au prorata du temps d'accueil.
  coefficientResidenceAlternee: 0.5,
} as const

/** Revenu de solidarité active et prime d'activité, montants mensuels. */
export const MINIMA = {
  // Décret n° 2026-220 du 30 mars 2026, LEGIARTI000053739360 : montant forfaitaire RSA, une personne.
  rsaForfaitaireEuros: 651.69,
  // Décret n° 2026-222 du 30 mars 2026, art. 2, LEGIARTI000053739626 : prime d'activité, une personne.
  primeForfaitaireEuros: 638.28,
  // CSS D843-3, LEGIARTI000051396704 : part des revenus professionnels ajoutée au forfait.
  fractionRevenusProfessionnels: 0.5985,
  // CSS D843-2, LEGIARTI000053741714 : bonification individuelle.
  bonificationSeuilEnSmicHoraires: 59,
  bonificationPleineEnSmicHoraires: 138,
  bonificationTauxMaximal: 0.377,
  // SMIC horaire brut au 1er juin 2026, arrêté du 22 mai 2026, LEGIARTI000054128446.
  smicHoraireBrutEuros: 12.31,
  // CSS D846-2, LEGIARTI000031674204.
  primeMinimumVerseeEuros: 15,
  // CASF R262-39 (version consultée sur Légifrance, hors base LEGI locale).
  rsaMinimumVerseEuros: 6,
  // CSS D843-1, LEGIARTI000031673885 (même grille pour le RSA, CASF R262-1, LEGIARTI000031694448).
  majorationDeuxiemePersonne: 0.5,
  majorationPersonneSupplementaire: 0.3,
  majorationAPartirDuTroisiemeEnfant: 0.4,
  isoleMajore: 1.28412,
  isoleSupplementParEnfant: 0.42804,
  // CSS R844-3, LEGIARTI000048841687 (et CASF R262-9, LEGIARTI000048841599) : forfait logement.
  forfaitLogementUnePersonne: 0.12,
  forfaitLogementDeuxPersonnes: 0.16,
  forfaitLogementTroisPersonnes: 0.165,
} as const

export interface Source {
  sujet: string
  reference: string
  url: string
}

export const SOURCES: Source[] = [
  {
    sujet: 'Parts du quotient familial et résidence alternée',
    reference: 'CGI art. 194, LEGIARTI000033817781',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033817781',
  },
  {
    sujet: 'Demi-part invalidité et ancien combattant',
    reference: 'CGI art. 195, LEGIARTI000046860994',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000046860994',
  },
  {
    sujet: 'Barème, plafonds du quotient familial et décote',
    reference: 'CGI art. 197, LEGIARTI000053542636',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542636',
  },
  {
    sujet: 'Taux des allocations familiales',
    reference: 'CSS art. D521-1, LEGIARTI000030680318',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000030680318',
  },
  {
    sujet: 'Plafonds 2026 des allocations familiales (texte officiel à relire)',
    reference: 'Barème CAF des allocations familiales 2026',
    url: 'https://www.caf.fr/professionnels/offres-et-services/accompagnement-des-allocataires/bareme-allocations-familiales',
  },
  {
    sujet: 'Base mensuelle des allocations familiales 2026',
    reference: 'Ministère des Solidarités, revalorisation au 1er avril 2026',
    url: 'https://solidarites.gouv.fr/revalorisation-annuelle-des-prestations-sociales-au-1er-avril-2026',
  },
  {
    sujet: 'Allocations familiales en résidence alternée',
    reference: 'CSS art. R521-3, LEGIARTI000006750610',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006750610',
  },
  {
    sujet: 'Formule de l’aide au logement en location',
    reference: 'CCH art. D823-16 et D823-17, LEGIARTI000038878905 et LEGIARTI000041419255',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038878905',
  },
  {
    sujet: 'Barème chiffré de l’aide au logement (depuis le 1er octobre 2025)',
    reference: 'Arrêté du 27 septembre 2019, art. 7 à 15',
    url: 'https://www.legifrance.gouv.fr/codes/id/LEGIARTI000052233874',
  },
  {
    sujet: 'Aide au logement en résidence alternée',
    reference: 'Conseil d’État, 21 juillet 2017, n° 398563',
    url: 'https://www.legifrance.gouv.fr/ceta/id/CETATEXT000035260342',
  },
  {
    sujet: 'Revenus d’activité ignorés pour l’aide au logement des bénéficiaires du RSA',
    reference: 'CCH art. R822-17, LEGIARTI000041419333',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041419333',
  },
  {
    sujet: 'Revenu de solidarité active',
    reference:
      'CASF art. L262-2, R262-1, R262-9 à R262-11, LEGIARTI000031087764 ; décret n° 2026-220 du 30 mars 2026',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000031087764',
  },
  {
    sujet: 'Formule de la prime d’activité',
    reference: 'CSS art. L842-3 et D843-1 à D843-3',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000037994814',
  },
  {
    sujet: 'Montant forfaitaire de la prime d’activité 2026',
    reference: 'Décret n° 2026-222 du 30 mars 2026, LEGIARTI000053739626',
    url: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053733855',
  },
  {
    sujet: 'SMIC horaire au 1er juin 2026',
    reference: 'Arrêté du 22 mai 2026, LEGIARTI000054128446',
    url: 'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000054128446',
  },
]
