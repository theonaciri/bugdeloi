# C0.9 · Cinq articles en Catala 1.3.2

Les cinq versions étaient en vigueur au niveau N0 sans marqueur de référence dans la base locale LEGI (DILA) au 26 novembre 2026. Chaque fichier reprend à l’identique le texte extrait de cette base. Les dates d’application sont des entrées. La version de l’article 278-0 se termine le 1er janvier 2027, date exclue.

| Code et article | Version LEGI | Interface | Règle formalisée | `clerk test` |
| --- | --- | --- | --- | --- |
| CGI [278-0](cgi/livre1/partie1/titre2/chapitre1/section5/i/article_278-0.catala_fr) | `LEGIARTI000042853334` · 2020-12-31 | `TauxOpérationComposite@v1` | Retient le taux le plus élevé si les éléments non accessoires relèvent de taux différents. L’appréciation du caractère accessoire et le taux de chaque élément sont fournis en entrée. | 1/1 |
| CGI [775](cgi/livre1/partie1/titre4/chapitre1/section2/vi/b/2/b/3/article_775.catala_fr) | `LEGIARTI000006305398` · 2003-01-01 | `DéductionFraisFunéraires@v1` | Plafonne la déduction forfaitaire de 1 500 € au montant de l’actif disponible. La date d’ouverture suit le nota (1) de LEGI. | 1/1 |
| CSS [R160-19](css/decrets-en-conseil-detat/livre1/titre6/chapitre-preliminaire/section3/sous-section1/article_r160-19.catala_fr) | `LEGIARTI000049158192` · 2024-02-18 | `BornesParticipationForfaitaire@v1` | Contrôle qu’un montant proposé est compris entre 2 € et 3 €, bornes incluses. | 1/1 |
| CSS [R161-9](css/decrets-en-conseil-detat/livre1/titre6/chapitre1/section1/sous-section3/article_r161-9.catala_fr) | `LEGIARTI000006747389` · 1985-12-21 | `SeuilsÂgeEtInvalidité@v1` | Contrôle les seuils cumulatifs de 55 ans et 60 % d’invalidité globale pour l’application de l’article L. 161-16. | 1/1 |
| CSS [D846-2](css/decrets-simples/livre8/titre4/chapitre6/article_d846-2.catala_fr) | `LEGIARTI000031674204` · 2016-01-01 | `SeuilVersementPrimeActivité@v1` | Indique si le montant calculé est strictement inférieur au seuil de non-versement de 15 €. | 1/1 |

Les scopes couvrent la règle propre à chaque article. Les règles d’éligibilité, de liquidation et de fixation des montants ou taux cités par renvoi relèvent des dispositions correspondantes.

## Rejeu

Depuis la racine du dépôt, avec l’image locale Catala 1.3.2 du verrou `infra/catala/image.lock.json`.

```bash
bun - <<'TS'
import { runInSandbox } from './packages/runner/src/index.ts'

const workdir = 'replications/c0.9-catala-sample'
const files = Array.from(new Bun.Glob('**/*.catala_fr').scanSync({ cwd: workdir })).sort()
const result = await runInSandbox({
  workdir,
  command: ['clerk', 'test', '--color=never', ...files],
  timeoutMs: 60_000,
  memoryMb: 1536,
  cpus: 2,
  network: false,
})
process.stdout.write(result.stdout)
process.stderr.write(result.stderr)
process.exitCode = result.exitCode
TS
```

Résultat sur l’image épinglée `sha256:d62905c562db64c7ad8d7aebc0ae7032e035e0f41594b8b05be107fd8c63e26b` : `ALL TESTS PASSED`, 5 réussis, 0 échec, sortie 0. Les tests d’exemple sont écrits par l’auteur de la formalisation (famille `openai`, modèle `gpt-6.2-sol`). Ce rejeu n’attribue aucun niveau de preuve.
