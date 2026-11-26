// Chaque interface est liée à une version et une empreinte précises du texte LEGI.
export const translations = [
  {
    legiarti: 'LEGIARTI000038814974',
    hash: 'f099c5fde4fd5e0c73d954ce8ab59ed3c152f88c4f034446c38468d588dea50c',
    interface: 'ResidencePrincipaleAidesLogement@v1',
    path: 'cch/livre8/titre2/chapitre1/section2/sous-section1/article_l821-2.catala_fr',
    signature:
      'Scope ResidencePrincipaleAidesLogement. Entrée booléenne : appréciation_résidence_principale. Sortie booléenne : condition_de_résidence_principale_remplie. Traiter uniquement la condition de résidence, sans calculer le droit à l’aide.',
  },
  {
    legiarti: 'LEGIARTI000038814781',
    hash: 'a2e690d7e6467457e9263ade5bb113c35bedac2f405c39523ce096e94ba008c9',
    interface: 'ExclusionPrimesDemenagementMayotte@v1',
    path: 'cch/livre8/titre6/chapitre1/section2/article_l861-4.catala_fr',
    signature:
      'Scope ExclusionPrimesDemenagementMayotte. Entrée booléenne : à_mayotte. Sortie booléenne : articles_l821_4_et_l823_8_écartés_par_l861_4. Traiter seulement la non-application prévue par l’article. Un résultat faux ne tranche pas l’applicabilité des dispositions citées.',
  },
  {
    legiarti: 'LEGIARTI000044634615',
    hash: '6056d9e0adc58fe8372a17b61d9d67e5b4b12abe9fdc7af605a1494d054cf025',
    interface: 'ExclusionSectionLogementMayotte@v1',
    path: 'cch/decrets-simples/livre8/titre6/chapitre1/section1/article_d861-7.catala_fr',
    signature:
      'Scope ExclusionSectionLogementMayotte. Entrée booléenne : à_mayotte. Sortie booléenne : section_écartée_par_d861_7. Traiter seulement la non-application de la section citée. Un résultat faux ne tranche pas l’applicabilité de la section.',
  },
] as const
