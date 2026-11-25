/**
 * Identifiants LEGI (DILA) et normalisation du texte pour les empreintes (contrôle N1).
 */

import { createHash } from 'node:crypto'

export const LEGIARTI_RE = /^LEGIARTI\d{12}$/
export const LEGITEXT_RE = /^LEGITEXT\d{12}$/
export const LEGISCTA_RE = /^LEGISCTA\d{12}$/

/** Codes du périmètre initial. Identifiants à confirmer par l'ingestion (titre lu dans LEGI). */
export const CODES = {
  CGI: { id: 'LEGITEXT000006069577', short: 'CGI', title: 'Code général des impôts' },
  CSS: { id: 'LEGITEXT000006073189', short: 'CSS', title: 'Code de la sécurité sociale' },
  CCH: { id: 'LEGITEXT000006074096', short: 'CCH', title: 'Code de la construction et de l’habitation' },
} as const

/**
 * Normalisation canonique d'un texte d'article avant hachage.
 * Doit rester stable : changer cette fonction invalide toutes les empreintes N1.
 * - supprime les balises HTML, décode les entités courantes
 * - unifie apostrophes, guillemets, espaces insécables et tirets
 * - réduit tous les blancs à une espace, supprime les blancs de bord
 */
export function normalizeLegalText(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/[    ]/g, ' ')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
}

/** node:crypto fonctionne sous Bun et sous Node (build SvelteKit). */
export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

export function legalTextHash(rawHtmlOrText: string): string {
  return sha256Hex(normalizeLegalText(rawHtmlOrText))
}

/** Convention DILA : une date de fin 2999-01-01 signifie « pas de fin connue ». */
export const LEGI_OPEN_END = '2999-01-01'

/** États LEGI jamais comptés « en vigueur », quelles que soient les dates. */
export const NEVER_IN_FORCE_ETATS = ['ANNULE', 'NON_VIGUEUR', 'MODIFIE_MORT_NE'] as const

/**
 * Règle unique « en vigueur à la date `asOf` » (AAAA-MM-JJ), partagée par l'ingestion (arbre daté)
 * et par le site (compteurs) : intervalle [début, fin[ qui contient `asOf`, état non exclu.
 * Inclut donc `ABROGE_DIFF` (abrogation programmée mais pas encore effective).
 * Équivalent SQL : `articleInForce()` dans @bugdeloi/db/predicates.
 */
export function isInForce(
  unit: { etat?: string | null; dateDebut?: string | null; dateFin?: string | null },
  asOf: string,
): boolean {
  const { etat, dateDebut, dateFin } = unit
  return (
    !(NEVER_IN_FORCE_ETATS as readonly string[]).includes(etat ?? '') &&
    Boolean(dateDebut && dateDebut <= asOf) &&
    (!dateFin || dateFin === LEGI_OPEN_END || asOf < dateFin)
  )
}

export function legifranceArticleUrl(legiarti: string): string {
  return `https://www.legifrance.gouv.fr/codes/article_lc/${legiarti}`
}
