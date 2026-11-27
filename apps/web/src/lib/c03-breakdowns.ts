/**
 * Décomposition ligne à ligne des deux écarts C0.3 (Guyane, Mayotte) entre le programme Inria et notre
 * lecture de la loi en vigueur. Source : relectures indépendantes
 * `docs/audits/verifications/2026-11-25-c0.3-*.md` (calcul pas à pas, chaque taux cité). Montants en
 * centimes, arrondis ligne à ligne ; les totaux égalent les montants des tests (`c03-breakdowns.test.ts`).
 */
export interface BreakdownLine {
  label: string
  /** Calcul écrit, ex. « 414,40 € × 5,88 % ». */
  formula: string
  /** Texte qui fonde la ligne (ou qui l'écarte). */
  basis: string
  /** Montant retenu par le programme Inria, `null` s'il ne compte pas cette ligne. */
  inriaCents: number | null
  /** Montant retenu par notre lecture de la loi en vigueur, `null` si elle l'écarte. */
  lawCents: number | null
  /** Pourquoi un seul des deux programmes compte la ligne. */
  why?: string
}

export interface AllowanceBreakdown {
  name: 'Test3' | 'Test12'
  territory: string
  situation: string
  date: string
  /** Base mensuelle des allocations familiales (BMAF) à la date du cas. */
  base: string
  incomeNote: string
  lines: BreakdownLine[]
  inriaCents: number
  lawCents: number
  caveat?: string
}

export const C03_BREAKDOWNS: readonly AllowanceBreakdown[] = [
  {
    name: 'Test3',
    territory: 'Guyane',
    situation: 'Un enfant unique de 13 ans',
    date: 'mai 2020',
    base: '414,40 €',
    incomeNote:
      'Le revenu du foyer ne change rien : avec un seul enfant, l’allocation n’est pas modulée selon les ressources en Guyane.',
    lines: [
      {
        label: 'Taux de base pour un enfant',
        formula: '414,40 € × 5,88 %',
        basis: 'CSS, art. D755-5, II, al. 1',
        inriaCents: 2437,
        lawCents: 2437,
      },
      {
        label: 'Majoration pour âge, dès 11 ans',
        formula: '414,40 € × 3,69 %',
        basis: 'CSS, art. D755-5, II, al. 2',
        inriaCents: null,
        lawCents: 1529,
        why: 'Le programme Inria soumet cette majoration à la règle de métropole, qui exclut l’aîné des familles de moins de trois enfants. Un enfant unique est toujours l’aîné : la majoration n’est jamais versée. L’article D755-5 vise pourtant expressément « un seul enfant à charge ».',
      },
    ],
    inriaCents: 2437,
    lawCents: 3966,
  },
  {
    name: 'Test12',
    territory: 'Mayotte',
    situation: 'Quatre enfants de 16, 12, 7 et 5 ans',
    date: 'août 2019',
    base: '413,16 €',
    incomeNote: 'Ressources du foyer : 20 000 € par an.',
    lines: [
      {
        label: 'Barème pour deux enfants',
        formula: '413,16 € × 29,36 %',
        basis: 'Décret n° 2002-423, art. 19, IV, 2°',
        inriaCents: 12130,
        lawCents: 12130,
      },
      {
        label: 'Troisième enfant',
        formula: '413,16 € × 12,59 %',
        basis: 'Décret n° 2002-423, art. 19, IV, 3°',
        inriaCents: 5202,
        lawCents: 5202,
      },
      {
        label: 'Quatrième enfant',
        formula: '413,16 € × 4,63 %',
        basis: 'Décret n° 2002-423, art. 7, 4°',
        inriaCents: 1913,
        lawCents: 1913,
      },
      {
        label: 'Ancien montant maintenu',
        formula: '57,28 €',
        basis: 'Ordonnance n° 2002-149, art. 7, al. 5',
        inriaCents: 5728,
        lawCents: null,
        why: 'Ce montant est maintenu tant que l’enfant reste le seul à charge. Ce foyer en a quatre.',
      },
      {
        label: 'Majoration pour âge (enfant de 16 ans)',
        formula: '413,16 € × 16 %',
        basis: 'CSS, art. D521-1 (métropole)',
        inriaCents: 6611,
        lawCents: null,
        why: 'C’est la majoration de métropole. Aucun texte relevé ne l’étend à Mayotte.',
      },
    ],
    inriaCents: 31584,
    lawCents: 19245,
    caveat:
      'Les données du test ne disent pas tout. Les 192,45 € supposent que l’aîné poursuit des études et que les 300 € perçus par l’enfant de 5 ans ne lui font pas perdre le droit (la condition de revenu ne viserait que la prolongation pour études). Si l’une de ces deux exclusions s’applique, la loi donne 173,32 € ; si les deux s’appliquent, 121,30 €. Aucune lecture relevée ne donne 315,84 €.',
  },
] as const
