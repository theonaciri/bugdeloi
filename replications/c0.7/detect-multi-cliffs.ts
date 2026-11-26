import { DATE_DE_CALCUL, SOURCES } from './parametres.ts'
import {
  calculRevenuDisponible,
  type FoyerEtendu,
  HYPOTHESES,
  type OptionsRevenuDisponible,
  type ResultatRevenuDisponible,
} from './revenu-disponible.ts'

/**
 * Balaye le revenu annuel de 0 à 100 000 €, euro par euro, pour un couple avec deux enfants,
 * locataire en zone 2 (750 € par mois), et relève :
 * - le taux marginal combiné par tranche de 1 000 € ;
 * - les effets de seuil (le revenu disponible saute quand le revenu augmente d'un euro) ;
 * - les plages où gagner plus ne rapporte rien ou fait perdre.
 *
 * Résultats de machine, candidats non qualifiés par un humain.
 *
 * Commande : bun replications/c0.7/detect-multi-cliffs.ts
 */

export const FOYER_ETUDIE: FoyerEtendu = {
  situationFamiliale: 'ImpositionCommune',
  enfantsAChargeExclusiveOuPrincipale: 2,
  appreciationVitSeul: false,
  domicileFiscal: 'Métropole',
}

export const OPTIONS_ETUDIEES: OptionsRevenuDisponible = {
  logement: { zone: 2, loyerMensuelEuros: 750 },
  activite: {},
}

const REVENU_MAXIMAL = 100_000
/** Écart annuel, en euros, à partir duquel un pas de 1 € est relevé comme effet de seuil. */
const SEUIL_SAUT_EUROS = 12
/** Une marche de l'arrondi des ressources à la centaine supérieure reste sous ce montant annuel. */
const MARCHE_ARRONDI_MAXIMALE_EUROS = 60

const composantes = ['impot', 'allocationsFamiliales', 'aideLogement', 'primeActivite', 'rsa'] as const
type Composante = (typeof composantes)[number]
type Montants = Record<Composante, number>

const LOIS: Record<Composante, string> = {
  impot: 'Impôt sur le revenu (CGI art. 197 et 1657 1 bis)',
  allocationsFamiliales: 'Allocations familiales (CSS art. L521-1 et D521-1)',
  aideLogement: 'Aide au logement (CCH art. D823-16, D823-17 et R822-17)',
  primeActivite: 'Prime d’activité (CSS art. L842-3 et D846-2)',
  rsa: 'Revenu de solidarité active (CASF art. L262-2)',
}

const centimes = (n: number) => Math.round(n * 100) / 100 + 0

/** Effet de chaque composante sur le revenu disponible (l'impôt compte en négatif). */
function montants(r: ResultatRevenuDisponible): Montants {
  return {
    impot: -r.impotMisEnRecouvrementEuros,
    allocationsFamiliales: r.allocationsFamilialesAnnuellesEuros,
    aideLogement: r.aideLogementAnnuelleEuros,
    primeActivite: r.primeActiviteAnnuelleEuros,
    rsa: r.rsaAnnuelEuros,
  }
}

function ecarts(avant: ResultatRevenuDisponible, apres: ResultatRevenuDisponible): Montants {
  const a = montants(avant)
  const b = montants(apres)
  return {
    impot: centimes(b.impot - a.impot),
    allocationsFamiliales: centimes(b.allocationsFamiliales - a.allocationsFamiliales),
    aideLogement: centimes(b.aideLogement - a.aideLogement),
    primeActivite: centimes(b.primeActivite - a.primeActivite),
    rsa: centimes(b.rsa - a.rsa),
  }
}

const loisEnJeu = (variations: Montants, minimum: number) =>
  composantes
    .filter((c) => Math.abs(variations[c]) >= minimum)
    .map((c) => LOIS[c])
    .join(' + ')

export function detecterEffetsDeSeuil() {
  const resultats: ResultatRevenuDisponible[] = []
  for (let revenu = 0; revenu <= REVENU_MAXIMAL; revenu++) {
    resultats.push(calculRevenuDisponible(revenu, FOYER_ETUDIE, OPTIONS_ETUDIEES))
  }
  const a = (revenu: number) => {
    const r = resultats[revenu]
    if (!r) throw new RangeError(`Revenu hors balayage : ${revenu}`)
    return r
  }

  const effetsDeSeuil = []
  const marches: { revenu: number; perte: number; compensee: boolean }[] = []
  for (let revenu = 1; revenu <= REVENU_MAXIMAL; revenu++) {
    const avant = a(revenu - 1)
    const apres = a(revenu)
    const variations = ecarts(avant, apres)
    if (!composantes.some((c) => Math.abs(variations[c]) >= SEUIL_SAUT_EUROS)) continue
    // La prime d'activité compense la marche quand l'aide au logement entre dans ses ressources.
    const compensation = variations.primeActivite
    const arrondi =
      variations.aideLogement < 0 &&
      -variations.aideLogement <= MARCHE_ARRONDI_MAXIMALE_EUROS &&
      Math.abs(variations.impot) < SEUIL_SAUT_EUROS &&
      Math.abs(variations.allocationsFamiliales) < SEUIL_SAUT_EUROS &&
      Math.abs(variations.rsa) < SEUIL_SAUT_EUROS &&
      (Math.abs(compensation) < SEUIL_SAUT_EUROS ||
        (compensation > 0 && compensation <= 1 - variations.aideLogement))
    if (arrondi) {
      const perte = centimes(avant.revenuDisponibleEuros + 1 - apres.revenuDisponibleEuros)
      marches.push({ revenu, perte, compensee: compensation >= SEUIL_SAUT_EUROS })
      continue
    }
    effetsDeSeuil.push({
      revenuAvantEuros: revenu - 1,
      revenuApresEuros: revenu,
      revenuDisponibleAvantEuros: avant.revenuDisponibleEuros,
      revenuDisponibleApresEuros: apres.revenuDisponibleEuros,
      variationRevenuDisponibleEuros: centimes(apres.revenuDisponibleEuros - avant.revenuDisponibleEuros),
      variations,
      lois: loisEnJeu(variations, SEUIL_SAUT_EUROS),
    })
  }

  const tauxMarginauxCombines = []
  for (let de = 0; de < REVENU_MAXIMAL; de += 1000) {
    const jusqua = de + 1000
    const variations = ecarts(a(de), a(jusqua))
    const taux = (variation: number) => centimes((-variation / 1000) * 100)
    tauxMarginauxCombines.push({
      deEuros: de,
      aEuros: jusqua,
      tauxCombinePct: centimes(
        (1 - (a(jusqua).revenuDisponibleEuros - a(de).revenuDisponibleEuros) / 1000) * 100,
      ),
      partsPct: {
        impot: taux(variations.impot),
        allocationsFamiliales: taux(variations.allocationsFamiliales),
        aideLogement: taux(variations.aideLogement),
        primeActivite: taux(variations.primeActivite),
        rsa: taux(variations.rsa),
      },
    })
  }

  // Plages de 100 € (une marche d'arrondi chacune) où le revenu disponible n'augmente pas.
  const plages: { de: number; a: number }[] = []
  for (let de = 0; de < REVENU_MAXIMAL; de += 100) {
    if (a(de + 100).revenuDisponibleEuros > a(de).revenuDisponibleEuros) continue
    const derniere = plages.at(-1)
    if (derniere && derniere.a === de) derniere.a = de + 100
    else plages.push({ de, a: de + 100 })
  }
  const plagesSansGain = plages.map((plage) => {
    const debut = a(plage.de)
    const fin = a(plage.a)
    const variation = fin.revenuDisponibleEuros - debut.revenuDisponibleEuros
    return {
      deEuros: plage.de,
      aEuros: plage.a,
      variationRevenuDisponibleEuros: centimes(variation),
      tauxMoyenPct: centimes((1 - variation / (plage.a - plage.de)) * 100),
      lois: loisEnJeu(ecarts(debut, fin), 1),
    }
  })

  const pertes = marches.map((m) => m.perte)

  return {
    experience: 'C0.7',
    statut: 'Candidats relevés par une machine, non qualifiés par un humain. Modèle simplifié.',
    commande: 'bun replications/c0.7/detect-multi-cliffs.ts',
    dateDeCalcul: DATE_DE_CALCUL,
    foyer: {
      description: 'Couple, 2 enfants à charge, locataire en zone 2, un seul revenu d’activité',
      loyerMensuelEuros: 750,
      zone: 2,
    },
    balayage: { deEuros: 0, aEuros: REVENU_MAXIMAL, pasEuros: 1 },
    definitions: {
      effetDeSeuil: `Un euro de revenu en plus change une prestation ou l’impôt d’au moins ${SEUIL_SAUT_EUROS} € par an, hors marches d’arrondi.`,
      marcheArrondi: `L’aide au logement baisse d’au plus ${MARCHE_ARRONDI_MAXIMALE_EUROS} € par an parce que les ressources sont arrondies à la centaine supérieure (CCH art. D823-17). La prime d’activité compense parfois cette marche. La perte indiquée est nette de cette compensation.`,
      tauxCombine:
        'Part de 1 000 € de revenu en plus qui n’arrive pas dans le revenu disponible. Au-delà de 100 %, le foyer perd de l’argent.',
      plageSansGain:
        'Suite de plages de 100 € sur lesquelles le revenu disponible n’augmente pas ou diminue.',
    },
    resume: {
      effetsDeSeuil: effetsDeSeuil.length,
      effetsDeSeuilEnBaisse: effetsDeSeuil.filter((e) => e.variationRevenuDisponibleEuros < 0).length,
      effetsDeSeuilMultiLois: effetsDeSeuil.filter((e) => e.lois.includes(' + ')).length,
      plagesSansGain: plagesSansGain.length,
    },
    effetsDeSeuil,
    marchesArrondiAideLogement: {
      nombre: marches.length,
      compenseesParLaPrimeActivite: marches.filter((m) => m.compensee).length,
      perteMinimaleEuros: pertes.length ? Math.min(...pertes) : 0,
      perteMaximaleEuros: pertes.length ? Math.max(...pertes) : 0,
      premierRevenuEuros: marches[0]?.revenu ?? null,
      dernierRevenuEuros: marches.at(-1)?.revenu ?? null,
    },
    plagesSansGain,
    tauxMarginauxCombines,
    hypotheses: HYPOTHESES,
    sources: SOURCES,
  }
}

if (import.meta.main) {
  const resume = detecterEffetsDeSeuil()
  await Bun.write(new URL('./summary.json', import.meta.url), `${JSON.stringify(resume, null, 2)}\n`)
  console.log(resume.resume)
  for (const e of resume.effetsDeSeuil) {
    console.log(`${e.revenuApresEuros} € : ${e.variationRevenuDisponibleEuros} € par an (${e.lois})`)
  }
  for (const p of resume.plagesSansGain) {
    console.log(`${p.deEuros} à ${p.aEuros} € : ${p.variationRevenuDisponibleEuros} € (${p.lois})`)
  }
}
