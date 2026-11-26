import type { SortiePont } from './bridge.ts'
import type { Categorie, Ecart } from './classify.ts'
import type { Scenario } from './scenarios.ts'

const CATEGORIES: Categorie[] = [
  'difference_de_millesime',
  'difference_de_perimetre',
  'divergence_simulateur',
]
const EXEMPLES_PAR_GROUPE = 3

export function resumer(
  scenarios: Scenario[],
  sortie: SortiePont,
  ecarts: Ecart[],
  tolerances: { irEuros: number; afEuros: number },
) {
  const compare = sortie.status === 'ok'
  const groupes = new Map<string, Ecart[]>()
  for (const e of ecarts) {
    const cle = [e.domaine, e.champ, e.categorie, e.motif].join('|')
    groupes.set(cle, [...(groupes.get(cle) ?? []), e])
  }
  return {
    statut: compare ? ('compare' as const) : ('hors_ligne' as const),
    raison: compare ? null : { code: sortie.code, message: sortie.message },
    versions: compare ? sortie.versions : null,
    periode: compare ? sortie.periode : null,
    tolerances,
    foyersGeneres: {
      ir: scenarios.filter((s) => s.domaine === 'ir').length,
      af: scenarios.filter((s) => s.domaine === 'af').length,
    },
    foyersCompares: compare ? scenarios.length : 0,
    foyersAvecEcart: compare ? new Set(ecarts.map((e) => e.scenario)).size : null,
    ecartsParCategorie: compare
      ? Object.fromEntries(CATEGORIES.map((c) => [c, ecarts.filter((e) => e.categorie === c).length]))
      : null,
    groupes: [...groupes.values()].map((membres) => {
      const [premier] = membres as [Ecart, ...Ecart[]]
      const amplitudes = membres.map((e) => Math.abs(e.openfisca - e.bugdeloi))
      return {
        domaine: premier.domaine,
        champ: premier.champ,
        categorie: premier.categorie,
        motif: premier.motif,
        nombre: membres.length,
        ecartMaximal: Math.round(Math.max(...amplitudes) * 100) / 100,
        // Les plus grands écarts d'abord : chacun porte ses entrées pour le rejeu.
        exemples: [...membres]
          .sort((a, b) => Math.abs(b.openfisca - b.bugdeloi) - Math.abs(a.openfisca - a.bugdeloi))
          .slice(0, EXEMPLES_PAR_GROUPE)
          .map(({ bugdeloi, openfisca, entree }) => ({
            bugdeloi,
            openfisca: Math.round(openfisca * 100) / 100,
            entree,
          })),
      }
    }),
    note: 'Un compte, pas une probabilité. Un écart ne dit pas lequel des deux calculs est faux.',
  }
}

export type Resume = ReturnType<typeof resumer>

/** Tableau Markdown aux colonnes alignées. Un titre préfixé par `>` est aligné à droite. */
export function tableau(titres: string[], rangees: (string | number)[][]): string[] {
  const colonnes = titres.map((titre, i) => {
    const droite = titre.startsWith('>')
    const cellules = [droite ? titre.slice(1) : titre, ...rangees.map((r) => String(r[i]))]
    const largeur = Math.max(3, ...cellules.map((c) => c.length))
    const [entete = '', ...corps] = cellules.map((c) => (droite ? c.padStart(largeur) : c.padEnd(largeur)))
    const trait = droite ? `${'-'.repeat(largeur - 1)}:` : '-'.repeat(largeur)
    return [entete, trait, ...corps]
  })
  return Array.from({ length: rangees.length + 2 }, (_, i) => `| ${colonnes.map((c) => c[i]).join(' | ')} |`)
}

export function rapport(r: Resume): string {
  const lignes = [
    '# C0.8 · Différentiel avec OpenFisca-France (impôt sur le revenu et allocations familiales)',
    '',
    '_Fichier généré par `bun replications/c0.8-openfisca/run.ts`. Ne pas modifier à la main._',
    '',
    `**${r.note}** Ce rejeu n’attribue aucun niveau de preuve.`,
    '',
    '## État du pont',
    '',
  ]
  if (r.statut === 'hors_ligne') {
    lignes.push(
      `- **Hors ligne : aucune comparaison n’a été faite.** Motif \`${r.raison?.code}\` : ${r.raison?.message}`,
      `- Foyers générés et prêts à comparer : ${r.foyersGeneres.ir} (impôt), ${r.foyersGeneres.af} (allocations).`,
      '- Les seuils propres aux paramètres OpenFisca ne sont ajoutés que lorsque le pont répond.',
      '- Installation et lancement : [README.md](README.md).',
    )
    return `${lignes.join('\n')}\n`
  }
  lignes.push(
    `- Versions : ${Object.entries(r.versions ?? {})
      .map(([nom, version]) => `${nom} ${version}`)
      .join(', ')}.`,
    `- Impôt : revenus ${r.periode?.utilisee} (demandés : ${r.periode?.demandee}). Allocations : mois ${r.periode?.moisAF}, × 12.`,
    `- Foyers comparés : ${r.foyersCompares} (${r.foyersGeneres.ir} impôt, ${r.foyersGeneres.af} allocations).`,
    `- Foyers avec au moins un écart : ${r.foyersAvecEcart}.`,
    `- Tolérances : impôt ${r.tolerances.irEuros} €, allocations ${r.tolerances.afEuros} € par an.`,
    '',
    '## Écarts par catégorie',
    '',
    ...tableau(
      ['Catégorie', '>Écarts'],
      Object.entries(r.ecartsParCategorie ?? {}).map(([c, n]) => [`\`${c}\``, n]),
    ),
    '',
    '`divergence_simulateur` est la catégorie par défaut : l’écart reste à instruire.',
    '',
    '## Détail',
    '',
  )
  if (r.groupes.length === 0) lignes.push('Aucun écart au-delà des tolérances sur les foyers comparés.')
  for (const g of r.groupes) {
    lignes.push(
      `### ${g.domaine.toUpperCase()} · \`${g.categorie}\` · ${g.nombre} écart(s), au plus ${g.ecartMaximal}`,
      '',
      g.motif,
      '',
      ...tableau(
        ['>Revenu', 'Situation', 'Âges des enfants', 'Vit seul', 'Domicile', '>BugDeLoi', '>OpenFisca'],
        g.exemples.map(({ entree: e, bugdeloi, openfisca }) => [
          e.revenuEuros,
          e.situationFamiliale,
          e.agesEnfants.join(', ') || '—',
          e.appreciationVitSeul ? 'oui' : 'non',
          e.domicileFiscal,
          bugdeloi,
          openfisca,
        ]),
      ),
      '',
    )
  }
  lignes.push(
    '## Limites',
    '',
    '- Le revenu net imposable et la base de ressources sont injectés : leur calcul n’est pas comparé.',
    '- Les ressources N-2 des prestations familiales ne sont pas modélisées : même montant pour les deux.',
    '- Allocations : montants avant CRDS, sans résidence alternée ; enfants de 14 à 17 ans non testés.',
    '- De c0.7, seules les allocations familiales sont comparées : ni aide au logement, ni RSA, ni prime d’activité.',
    '- Un écart d’allocations avec des paramètres différents est classé sur les paramètres seuls.',
    '- Les paramètres OpenFisca sont une source d’oracle, pas le texte officiel : confronter à LEGI et au JORF.',
  )
  return `${lignes.join('\n').trimEnd()}\n`
}
