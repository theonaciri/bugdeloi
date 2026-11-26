import { join } from 'node:path'
import { calculIR2026, domiciles, type EntreeIR2026, situations } from './ir2026.ts'

/**
 * Implémentation indépendante en arithmétique rationnelle exacte (numérateur / dénominateur),
 * suivant littéralement l'ordre de la loi : division par le nombre de parts (art. 193),
 * application du barème à une part (art. 197 I.1), puis multiplication par le nombre de parts.
 */
interface Rat {
  n: bigint
  d: bigint
}

const rat = (n: bigint, d = 1n): Rat => ({ n, d })
const addR = (a: Rat, b: Rat): Rat => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d })
const subR = (a: Rat, b: Rat): Rat => ({ n: a.n * b.d - b.n * a.d, d: a.d * b.d })
const mulR = (a: Rat, b: Rat): Rat => ({ n: a.n * b.n, d: a.d * b.d })
const divR = (a: Rat, b: Rat): Rat => ({ n: a.n * b.d, d: a.d * b.n })
const gtR = (a: Rat, b: Rat) => a.n * b.d > b.n * a.d
const minR = (a: Rat, b: Rat) => (gtR(a, b) ? b : a)
const maxR = (a: Rat, b: Rat) => (gtR(a, b) ? a : b)

function halfUpRat(r: Rat): bigint {
  if (r.n <= 0n) return 0n
  return (2n * r.n + r.d) / (2n * r.d)
}

function baremeParPart(revenuParPart: Rat): Rat {
  const s1 = rat(11_600n)
  const s2 = rat(29_579n)
  const s3 = rat(84_577n)
  const s4 = rat(181_917n)
  let c = rat(0n)
  if (gtR(revenuParPart, s1)) c = addR(c, mulR(subR(minR(revenuParPart, s2), s1), rat(11n, 100n)))
  if (gtR(revenuParPart, s2)) c = addR(c, mulR(subR(minR(revenuParPart, s3), s2), rat(30n, 100n)))
  if (gtR(revenuParPart, s3)) c = addR(c, mulR(subR(minR(revenuParPart, s4), s3), rat(41n, 100n)))
  if (gtR(revenuParPart, s4)) c = addR(c, mulR(subR(revenuParPart, s4), rat(45n, 100n)))
  return c
}

export function referenceIndependentIR2026(e: EntreeIR2026) {
  const rev = rat(halfUpRat(rat(BigInt(e.revenuNetImposableCentimes), 100n)))
  const isCouple = e.situationFamiliale === 'ImpositionCommune'
  const refParts = isCouple ? rat(2n) : rat(1n)
  const kids = BigInt(e.enfantsAChargeExclusiveOuPrincipale)
  const kidParts = kids <= 2n ? rat(kids, 2n) : rat(1n + (kids - 2n))
  const isParentIsole =
    (e.situationFamiliale === 'Célibataire' || e.situationFamiliale === 'Divorcé') &&
    e.appreciationVitSeul &&
    kids >= 1n
  const isVeufEnfants = e.situationFamiliale === 'Veuf' && kids >= 1n
  const parts = addR(
    addR(refParts, kidParts),
    addR(isParentIsole ? rat(1n, 2n) : rat(0n), isVeufEnfants ? rat(1n) : rat(0n)),
  )

  const brut = mulR(baremeParPart(divR(rev, parts)), parts)
  const refImpot = mulR(baremeParPart(divR(rev, refParts)), refParts)
  const extraHalfParts = mulR(subR(parts, refParts), rat(2n))
  const baseMaxReduction = isParentIsole
    ? addR(rat(4262n), mulR(subR(extraHalfParts, rat(2n)), rat(1807n)))
    : mulR(extraHalfParts, rat(1807n))
  const maxReduction = addR(baseMaxReduction, isVeufEnfants ? rat(2011n) : rat(0n))
  const apresQf = maxR(brut, subR(refImpot, maxReduction))

  let refaction = rat(0n)
  if (e.domicileFiscal === 'GuadeloupeMartiniqueRéunion') {
    refaction = minR(rat(2450n), mulR(apresQf, rat(30n, 100n)))
  } else if (e.domicileFiscal === 'GuyaneMayotte') {
    refaction = minR(rat(4050n), mulR(apresQf, rat(40n, 100n)))
  }

  const apresRef = subR(apresQf, refaction)
  const forfaitDecote = isCouple ? rat(1483n) : rat(897n)
  const decote = minR(apresRef, maxR(rat(0n), subR(forfaitDecote, mulR(apresRef, rat(4525n, 10000n)))))
  const net = subR(apresRef, decote)
  const arrondiEuro = Number(halfUpRat(net)) * 100
  const recouvrement = arrondiEuro < 6100 ? 0 : arrondiEuro

  return {
    nombreDeParts: Number(parts.n) / Number(parts.d),
    impotBrutSansPlafond: Number(halfUpRat(mulR(brut, rat(100n)))),
    impotApresPlafondQf: Number(halfUpRat(mulR(apresQf, rat(100n)))),
    refactionOutreMer: Number(halfUpRat(mulR(refaction, rat(100n)))),
    decote: Number(halfUpRat(mulR(decote, rat(100n)))),
    impotNetAvantCredits: Number(halfUpRat(mulR(net, rat(100n)))),
    impotArrondiEuro: arrondiEuro,
    impotMisEnRecouvrement: recouvrement,
  }
}

/** PRNG déterministe Mulberry32 pour rejeu identique sur toute machine. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function runDifferential(totalCases = 10_000) {
  const rand = mulberry32(20260701)
  const cases: EntreeIR2026[] = []

  // 1. Seuils légaux critiques ± 1 € (barème, entrée IR, falaise 61 €, sortie décote, plafond QF)
  const keyRevenues = [
    0, 1, 11599, 11600, 11601, 17214, 17215, 17216, 17591, 17592, 17593, 17594, 29578, 29579, 29580, 29593,
    29594, 29595, 29596, 32481, 32482, 32483, 32860, 32861, 41222, 44082, 45295, 52994, 52995, 52996, 64595,
    71463, 71464, 71465, 84576, 84577, 84578, 181916, 181917, 181918, 250000,
  ]
  for (const r of keyRevenues) {
    for (const sit of situations) {
      for (const dom of domiciles) {
        cases.push({
          dateDeCalcul: '2026-07-01',
          revenuNetImposableCentimes: r * 100,
          situationFamiliale: sit,
          enfantsAChargeExclusiveOuPrincipale: sit === 'ImpositionCommune' ? 2 : sit === 'Veuf' ? 1 : 0,
          appreciationVitSeul: sit === 'Divorcé',
          domicileFiscal: dom,
        })
      }
    }
  }

  // 2. Complément aléatoire déterministe jusqu'à totalCases
  while (cases.length < totalCases) {
    const sit = situations[Math.floor(rand() * situations.length)] ?? 'Célibataire'
    const dom = domiciles[Math.floor(rand() * domiciles.length)] ?? 'Métropole'
    const enfants = Math.floor(rand() * 6)
    const vitSeul = rand() < 0.35
    const revenuEuros = Math.floor(rand() * 250_000)
    const centimes = rand() < 0.2 ? Math.floor(rand() * 100) : 0
    cases.push({
      dateDeCalcul: '2026-07-01',
      revenuNetImposableCentimes: revenuEuros * 100 + centimes,
      situationFamiliale: sit,
      enfantsAChargeExclusiveOuPrincipale: enfants,
      appreciationVitSeul: vitSeul,
      domicileFiscal: dom,
    })
  }

  let divergences = 0
  const samples: { input: EntreeIR2026; field: string; bigintVal: number; refVal: number }[] = []

  for (const input of cases.slice(0, totalCases)) {
    const a = calculIR2026(input)
    const b = referenceIndependentIR2026(input)
    for (const key of Object.keys(a) as (keyof typeof a)[]) {
      if (a[key] !== b[key]) {
        divergences++
        if (samples.length < 10) {
          samples.push({ input, field: key, bigintVal: a[key], refVal: b[key] })
        }
      }
    }
  }

  return {
    totalCases,
    thresholdCasesIncluded: Math.min(cases.length, keyRevenues.length * situations.length * domiciles.length),
    divergences,
    unexplainedDivergences: divergences,
    samples,
    seed: 20260701,
    note: 'Un compte, pas une probabilité. Différentiel entre le moteur BigInt (aligné Catala) et une implémentation par part indépendante.',
  }
}

if (import.meta.main) {
  const result = runDifferential(10_000)
  await Bun.write(join(import.meta.dir, 'differential-summary.json'), `${JSON.stringify(result, null, 2)}\n`)
  console.log(
    `Différentiel C0.6 : ${result.totalCases} foyers contrôlés (${result.thresholdCasesIncluded} cas de seuils), ${result.divergences} divergence(s).`,
  )
  if (result.divergences > 0) process.exit(1)
}
