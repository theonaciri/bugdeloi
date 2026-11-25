export const findingSteps = [
  {
    status: 'candidate',
    term: 'Candidat',
    definition: 'Un programme signale un cas à examiner.',
  },
  {
    status: 'reproduced',
    term: 'Reproduit',
    definition: 'Une chaîne indépendante obtient le même constat sur des données traitées séparément.',
  },
  {
    status: 'qualified',
    term: 'Qualifié',
    definition:
      'Un humain conclut à un défaut du texte ou à une lacune et consigne son verdict dans un commit.',
  },
  {
    status: 'published',
    term: 'Publié',
    definition: 'Le projet a publié la fiche du constat qualifié et son certificat.',
  },
] as const
