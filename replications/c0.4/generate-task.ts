import { join } from 'node:path'
import { normalizeLegalText } from '../../packages/core/src/legi.ts'
import { sourceCommit } from '../c0.1/source.ts'
import { annotationArticleIds, type GroundTruth, readSourceAnnotations } from './extract-ground-truth.ts'
import { readLegiArticles } from './legi-db.ts'
import { type BlindPacket, parsePacket, promptFile, writeJson } from './packet.ts'

const prompt = `# Analyse des textes LEGI

Lisez uniquement \`blind-packet.json\`, dans un environnement isolé sans accès à d’autres
documents ni au web. Chaque entrée contient le texte DILA d’une version d’article, son
identifiant LEGIARTI, ses dates et l’empreinte du texte.

Relevez les passages dont l’application ou la mise en calcul pose une question précise.
Pour chaque passage, expliquez la question et ce qu’il faudrait savoir ou décider pour y
répondre. Appuyez-vous sur les termes du passage. Soumettez un tableau JSON contenant
une observation par question, avec quatre champs :

- \`legiarti\` : identifiant de la version dans le paquet.
- \`category\` : \`appreciation\` (critère à apprécier), \`perimetre\` (champ d’application),
  \`renvoi_externe\` (texte de renvoi absent), \`arrondi\` (précision ou étape d’arrondi),
  \`parametre\` (donnée à préciser), \`calcul\` (assiette ou ordre des opérations),
  ou \`autre\`.
- \`quote\` : extrait exact et continu du texte LEGI concerné.
- \`explanation\` : question soulevée et son lien avec l’extrait.

Renvoyez \`[]\` si vous ne relevez aucune question.
`

const forbiddenMarker = /\b(?:catala[\s_-]+examples|inria|dgfip|bofip|boi\s*-\s*[a-z]+|todo)\b/i

function normalizeForLeakCheck(value: string) {
  return normalizeLegalText(value.replace(/^\s*#\s*/gm, '')).toLowerCase()
}

export function checkNoLeaks(packet: BlindPacket, instructions: string, sourceComments: Iterable<string>) {
  const fields = packet.articles.flatMap((article) =>
    Object.entries(article).flatMap(([key, value]) => (typeof value === 'string' ? [key, value] : [key])),
  )
  const documents = [instructions, ...fields].map(normalizeForLeakCheck)
  if (documents.some((text) => forbiddenMarker.test(text))) {
    throw new Error('Marqueur de référence interdit dans le paquet aveugle.')
  }
  const fingerprints = new Set<string>()
  for (const comment of sourceComments) {
    // Un commentaire complet est une signature. Les lignes de continuation
    // plus longues ont aussi une signature, indépendamment de leur bloc.
    const whole = normalizeForLeakCheck(comment)
    if (whole) fingerprints.add(whole)
    for (const line of comment.split('\n').map(normalizeForLeakCheck)) {
      if (line.split(/\s+/).length >= 8 && /[.?!]$/.test(line)) fingerprints.add(line)
    }
  }

  for (const fingerprint of fingerprints) {
    if (
      documents.some((document) => {
        const at = document.indexOf(fingerprint)
        return at >= 0 && (fingerprint.length >= 32 || document === fingerprint)
      })
    ) {
      throw new Error('Extrait du corpus de référence présent dans le paquet aveugle.')
    }
  }
}

if (import.meta.main) {
  const groundTruth: GroundTruth = await Bun.file(join(import.meta.dir, 'ground-truth.json')).json()
  if (groundTruth.sourceCommit !== sourceCommit || !groundTruth.databaseChecked) {
    throw new Error("Régénérez d'abord ground-truth.json avec --with-db.")
  }
  const { annotations, comments } = await readSourceAnnotations()
  const fromInventory = groundTruth.items.map(({ id: _id, inBugdeloiDb: _inBugdeloiDb, ...item }) => item)
  if (JSON.stringify(fromInventory) !== JSON.stringify(annotations)) {
    throw new Error('Les annotations diffèrent de celles extraites du commit épinglé.')
  }
  const ids = new Set(
    groundTruth.items.flatMap(({ inBugdeloiDb, nearestLegiarti }) =>
      inBugdeloiDb && nearestLegiarti ? [nearestLegiarti] : [],
    ),
  )
  const packet = parsePacket({ articles: await readLegiArticles(annotationArticleIds(annotations)) })
  if (packet.articles.length !== ids.size || packet.articles.some(({ legiarti }) => !ids.has(legiarti))) {
    throw new Error('La couverture LEGI a changé depuis l’extraction.')
  }
  checkNoLeaks(packet, prompt, comments)
  await writeJson('task/blind-packet.json', packet)
  await Bun.write(promptFile, prompt)
  console.log(`${packet.articles.length} versions LEGI dans le paquet aveugle.`)
}
