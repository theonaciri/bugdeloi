// Dates effectivement demandées par la suite. Les valeurs sont des entrées du harnais.
const bmaf = {
  2019: '413,16', // DSS/SD2B/2019/65, https://www.legifrance.gouv.fr/circulaire/id/44472
  2020: '414,40', // DSS/SD2B/2020/33, https://sante.gouv.fr/fichiers/bo/2020/20-02/ste_20200002_0000_0046.pdf
  2021: '414,81', // DSS/2B/2021/65, https://sante.gouv.fr/fichiers/bo/2021/2021.5.sante.pdf
  2022: '422,28', // DSS/2B/2022/82, https://info.agriculture.gouv.fr/boagri/instruction-2022-317/telechargement
}

const ceilings = {
  2019: ['56849', '79558', '5684'], // https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000037864990
  2020: ['57759', '80831', '5775'], // https://www.legifrance.gouv.fr/loda/id/JORFTEXT000039663220
  2021: ['58279', '81558', '5827'], // https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000042694985
  // Arrêté du 16 décembre 2021, https://www.legifrance.gouv.fr/jorf/id/JORFARTI000044572370
  // Barème ministériel par nombre d'enfants, https://sante.gouv.fr/fichiers/bo/2021/2021.24.sant%C3%A9.pdf
  2022: ['58396', '81721', '5839'],
} as const

const smic = {
  // Décret n°2018-1173, https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000037833214
  '2019-08-26': '7,57',
  // Décret n°2019-1387, https://www.legifrance.gouv.fr/eli/decret/2019/12/18/MTRX1933646D/jo/texte
  '2020-04-20': '10,15',
  '2020-05-01': '10,15',
  // Décret n°2020-1598, https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000042677359
  '2021-01-01': '10,25',
  '2021-02-01': '10,25',
  // Arrêté du 27 septembre 2021, https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000044126026
  '2021-12-31': '10,48',
  // Arrêté du 19 avril 2022, https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000045602317
  '2022-05-01': '10,85',
} as const

function atDate(name: string, date: string, value: string, territory = '') {
  return `  définition ${name} sous condition date_barème = |${date}|${territory} conséquence égal à ${value} €`
}

export function baremes() {
  return `> Module Baremes
> Usage de France

\`\`\`catala-metadata
déclaration champ d'application Parametres:
  entrée date_barème contenu date
  entrée résidence contenu France.Collectivité
  résultat base contenu argent
  résultat smic contenu argent
  résultat premier contenu argent
  résultat second contenu argent
  résultat majoration contenu argent
\`\`\`

\`\`\`catala
champ d'application Parametres:
${Object.entries(smic)
  .flatMap(([date, minimum]) => {
    const year = Number(date.slice(0, 4)) as keyof typeof bmaf
    const bmafYear = (date.slice(5) < '04-01' ? year - 1 : year) as keyof typeof bmaf
    const [first, second, increase] = ceilings[year]
    return [
      atDate('base', date, bmaf[bmafYear]),
      atDate('smic', date, minimum, year === 2019 ? ' et résidence = Mayotte' : ' et résidence != Mayotte'),
      atDate('premier', date, first),
      atDate('second', date, second),
      atDate('majoration', date, increase),
    ]
  })
  .join('\n')}
\`\`\`
`
}
