import type { Detector } from '../types.ts'
import { detector as numerotation } from './numerotation.ts'
import { detector as refMorteLiens } from './ref-morte-liens.ts'
import { detector as refMorteTexte } from './ref-morte-texte.ts'
import { detector as syntaxe } from './syntaxe.ts'

/** Ordre d'exécution et de numérotation des findings. */
export const DETECTORS: readonly Detector[] = [refMorteLiens, refMorteTexte, numerotation, syntaxe]

export function detectorByName(name: string): Detector | undefined {
  return DETECTORS.find((d) => d.name === name)
}
