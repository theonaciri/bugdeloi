export const findingSteps = [
  {
    status: 'candidate',
    term: '1. Candidat',
    definition: 'Un premier programme automatique repère une anomalie potentielle dans le texte de loi.',
  },
  {
    status: 'reproduced',
    term: '2. Reproduit',
    definition:
      'Une seconde chaîne indépendante retrouve le même constat sur des archives traitées séparément.',
  },
  {
    status: 'qualified',
    term: '3. Qualifié',
    definition:
      'Un relecteur humain examine le texte, confirme un défaut ou une lacune et signe publiquement son verdict.',
  },
  {
    status: 'published',
    term: '4. Publié',
    definition: 'La fiche complète entre au registre public avec son certificat de rejeu.',
  },
] as const
