export const findingSteps = [
  {
    status: 'candidate',
    term: '1. Signalé',
    definition: 'Un premier programme automatique repère une anomalie possible dans le texte de loi.',
  },
  {
    status: 'reproduced',
    term: '2. Vérifié',
    definition: 'Un second programme indépendant retrouve le même constat sur des archives distinctes.',
  },
  {
    status: 'qualified',
    term: '3. Validé par un juriste',
    definition:
      'Un humain relit le texte, confirme un défaut ou une lacune et signe publiquement son verdict.',
  },
  {
    status: 'published',
    term: '4. Publié',
    definition: 'La fiche complète entre au registre public avec son mode de vérification.',
  },
] as const
