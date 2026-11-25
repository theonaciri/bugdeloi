/**
 * Rend `REPORT.md` à partir de `results.json` et de `triage.json`. Fonction pure (testée).
 * Vocabulaire contraint (AGENTS.md §1.11) : « candidat », « niveau », « reproduit », « qualifié ».
 */
import type { Results } from './results.ts'

export interface TriageEntry {
  n: number
  fingerprint: string
  stratum: string
  detector: string
  subtype: string
  verdict: 'probablement réel' | 'probablement légitime' | 'faux positif du détecteur'
  reason: string
}

type Stats = Record<string, unknown>
const num = (v: unknown): number => (typeof v === 'number' ? v : 0)
const rec = (v: unknown): Record<string, number> =>
  v && typeof v === 'object' ? (v as Record<string, number>) : {}
const fmt = (n: number) => n.toLocaleString('fr-FR').replaceAll(' ', ' ')
const pct = (a: number, b: number) =>
  b === 0 ? 'n.d.' : `${((100 * a) / b).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
const table = (head: string[], rows: Array<Array<string | number>>) =>
  [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n')

export function renderReport(results: Results, triage: TriageEntry[], ids: Map<string, string>): string {
  const det = (name: string) => results.detectors.find((d) => d.detector.startsWith(name))
  const liens = det('ref-morte-liens')
  const texte = det('ref-morte-texte')
  const numero = det('numerotation')
  const ls = (liens?.stats ?? {}) as Stats
  const ts = (texte?.stats ?? {}) as Stats
  const ns = (numero?.stats ?? {}) as Stats
  const classes = rec(ls.liens_par_classe)
  const total = num(ls.liens_citation_sortants)
  const resolved = num(ls.liens_resolus)
  const totalArticles = Object.values(results.articlesChecked).reduce((a, b) => a + b, 0)

  const byVerdict = (stratum: string) => {
    const rows = triage.filter((t) => t.stratum === stratum)
    return {
      n: rows.length,
      real: rows.filter((t) => t.verdict === 'probablement réel').length,
      legit: rows.filter((t) => t.verdict === 'probablement légitime').length,
      fp: rows.filter((t) => t.verdict === 'faux positif du détecteur').length,
    }
  }

  return `# C0.2 — Balayage mécanique du CGI, du CSS et du CCH

> **Candidats non qualifiés.** Ce document décrit ce que des détecteurs déterministes (sans modèle de
> langage) signalent dans les articles en vigueur. Aucun candidat n'est qualifié : seuls un rejeu par la CI
> et un verdict humain feraient entrer un résultat dans un compteur public (AGENTS.md §4.4).

Balayage n° ${results.sweepRunId} · ${results.generatedAt.slice(0, 10)} · durée ${fmt(results.durationMs)} ms.

## Périmètre et données

${table(
  [
    'Code',
    'Versions en vigueur contrôlées',
    'Date de projection',
    'Dernier lot DILA appliqué',
    'SHA-256 du lot',
  ],
  results.projection.map((p) => [
    p.code,
    fmt(results.articlesChecked[p.code] ?? 0),
    p.asOf,
    `\`${p.archive}\``,
    `\`${p.archiveSha256.slice(0, 16)}…\``,
  ]),
)}

Total : ${fmt(totalArticles)} versions d'articles en vigueur. « En vigueur » suit la règle unique du dépôt
(\`isInForce\` de \`@bugdeloi/core\` ≡ \`articleInForce()\` de \`@bugdeloi/db\`) à la date de projection de chaque
code ; le balayage s'arrête si les deux règles divergent. Un article est un **groupe de versions** (composante
connexe des blocs \`VERSIONS\` de LEGI) : un renvoi vers une version \`MODIFIE\` dont l'article a une version
plus récente en vigueur n'est pas mort. Données : base LEGI de la DILA, Licence Ouverte 2.0
([notes d'ingestion](../../docs/notes/legi.md)).

## Détecteurs

| Détecteur | Type | Définition exacte |
| --- | --- | --- |
${results.detectors
  .map((d) => {
    const name = d.detector
    const t = name.startsWith('numerotation')
      ? 'NUMEROTATION'
      : name.startsWith('syntaxe')
        ? 'SYNTAXE'
        : 'REF_MORTE'
    const def: Record<string, string> = {
      'ref-morte-liens':
        "Lien LEGI `CITATION` de sens `source` (l'article porteur cite la cible) d'une version en vigueur vers un article dont **aucune** version n'est en vigueur à la date de projection et dont aucune n'est annoncée plus tard. Sous-type = état de la dernière version (`abrogé`, `transféré`, `périmé`, `disjoint`, `annulé`, `autre:<état>`). Le numéro cité doit figurer dans le texte, sinon le constat est un écart lien/texte (voir plus bas), pas un candidat.",
      'ref-morte-texte':
        "Numéro écrit dans le texte (« l'article L. 521-1 du présent code », « aux articles 199 decies E à 199 decies G ») résolu par son numéro normalisé dans le code visé (présent code, CGI, CSS ou CCH nommés, ou même code sans désignation) ; l'article n'a aucune version en vigueur. Écartés : autre norme (loi, décret, directive, annexe, sigle, « du même code », « précité »), numéro sans préfixe L/R/D dans le CSS et le CCH, numéro à préfixe sans désignation dans le CGI, « article 1er » sans désignation. Un numéro absent de la base n'est pas jugé.",
      numerotation:
        'Deux versions en vigueur de **lignées différentes** portant le même numéro normalisé dans le même code ; deux marqueurs de subdivision identiques à la suite (« …, 2°, 3°, 3° »), même niveau, sans niveau supérieur intercalé, en milieu de suite croissante, articles dont le numéro commence par « Annexe » exclus. Pas de recherche de « trous ».',
      syntaxe:
        "Parenthèse, crochet ou guillemet français non apparié sur l'article entier ; citation à guillemets droits laissée ouverte. Exclusions : énumérations « a) », « 1) », « i) », « 1°) », « a bis) » ; « en tête d'alinéa dans une citation sur plusieurs alinéas ; annexes.",
    }
    const key = Object.keys(def).find((k) => name.startsWith(k)) ?? ''
    return `| \`${name}\` | ${t} | ${def[key] ?? ''} |`
  })
  .join('\n')}

Chaque candidat est un enregistrement \`finding\` de statut \`candidate\`, dédoublonné par empreinte (la
version du détecteur n'en fait pas partie), avec un certificat JSON : identifiants et dates des versions
source et cible, état de la cible, extrait exact et position (dans le texte normalisé), lien LEGI brut,
lot DILA et son SHA-256, URL Légifrance, et des **indices** (\`hints\`) qui signalent sans les écarter les cas
probablement légitimes (« dans sa rédaction antérieure », « en vigueur avant le », dispositions transitoires,
mention d'abrogation).

## Résultats

${table(
  ['Type / sous-type', 'Candidats'],
  Object.entries(results.candidatesByTypeAndSubtype).map(([k, v]) => [k, fmt(v)]),
)}

Par détecteur : ${Object.entries(results.candidatesByDetector)
    .map(([k, v]) => `\`${k}\` ${fmt(v)}`)
    .join(' · ')}.

- NUMEROTATION : aucun numéro d'article dupliqué entre deux articles distincts en vigueur (${fmt(num(ns.numeros_dupliques))}).
  ${fmt(num(ns.groupes_de_numero_multiples_meme_lignee))} cas où **deux versions d'un même article** sont en vigueur à la fois (CSS R611-2 : la version
  \`MODIFIE\` du 2018-01-01 garde une fin ouverte alors que celle du 2023-01-01 est entrée en vigueur) : anomalie de dates DILA,
  notée mais pas candidate.
- Recoupement : sur ${fmt(results.refMorteTexteTotal)} candidats textuels, ${fmt(results.refMorteTexteRecoupeLesLiens)} désignent le même couple
  (version citante, article cité) qu'un candidat par lien ; ${fmt(results.refMorteTexteAvecLienLegi)} ont un lien LEGI vers la cible morte.

## Couverture

**Liens LEGI.** ${fmt(total)} liens \`CITATION\` sortants des versions en vigueur ; ${fmt(resolved)} (${pct(resolved, total)}) sont résolubles
dans les trois codes ingérés et donc jugés. Le reste n'est pas jugé :

${table(
  ['Classe du lien', 'Liens', 'Part'],
  Object.entries(classes)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => [
      {
        vivante: 'résolu, article en vigueur',
        morte: 'résolu, **aucune version en vigueur**',
        a_venir: 'résolu, entrée en vigueur annoncée',
        hors_codes_ingeres: 'cible hors des trois codes (autre code, loi, décret)',
        texte_ou_section: 'cible = texte entier ou section',
        sans_cible: 'lien sans identifiant de cible',
        inconnue_dans_nos_codes: 'code ingéré mais numéro inconnu de la base',
      }[k] ?? k,
      fmt(v),
      pct(v, total),
    ]),
)}

Rattachement des liens résolus : ${Object.entries(rec(ls.resolution_par))
    .map(
      ([k, v]) =>
        `${{ version: 'version connue', version_ids: 'identifiant listé par un bloc VERSIONS', numero: 'numéro et code du lien (la version citée n’est pas dans le stock)' }[k] ?? k} ${fmt(v)}`,
    )
    .join(' · ')}.

**Citations textuelles.** ${fmt(num(ts.citations_extraites))} numéros d'articles extraits ; ${fmt(num(ts.resolues))} (${pct(num(ts.resolues), num(ts.citations_extraites))}) résolus
(${fmt(num(ts.vivantes))} en vigueur, ${fmt(num(ts.mortes))} sans version en vigueur) ; ${fmt(num(ts.ecartees_autre_norme))} écartés parce que la norme visée
est une autre (loi, décret, autre code…), ${fmt(num(ts.ecartees_prefixe))} par la règle des préfixes L/R/D, ${fmt(num(ts.inconnues_de_la_base))} absents de la base (non jugés).

## Écarts entre lien LEGI et texte

${fmt(results.ecartsLienTexte)} liens LEGI mènent à un article sans version en vigueur **alors que le texte actuel de la version
citante ne contient pas ce numéro** (liens hérités d'une rédaction antérieure, ou lien rattaché à la mauvaise
cible). Ce n'est pas une anomalie du texte : ils ne sont pas des candidats mais une information pour la DILA.
Liste complète : [\`ecarts-lien-texte.json\`](ecarts-lien-texte.json). L'inverse (numéro cité dans le texte sans lien LEGI
correspondant) est visible dans le certificat des candidats textuels (\`legi_link_to_target\`).

## Échantillon de triage — **tri par LLM, non probant**

Tirage de ${triage.length} candidats, graine \`20261125\`, strates fixées (liens 8, texte 12, numérotation 2, syntaxe 8) :
\`bun replications/c0.2/triage-input.ts\`. Chaque candidat a été classé par un modèle (Claude Sonnet 5.5) à partir du
certificat et de l'extrait, **sans consulter Légifrance**. C'est un tri par LLM, non probant (AGENTS.md §4.2) :
il sert à prioriser la qualification humaine et à corriger les détecteurs, rien d'autre. Un échantillon de ${triage.length} ne
donne qu'un ordre de grandeur (l'intervalle d'incertitude d'une proportion estimée sur 12 cas dépasse ±25 points).

${table(
  ['Strate', 'Tiré', 'Probablement réel', 'Probablement légitime', 'Faux positif du détecteur'],
  ['liens', 'texte', 'numerotation', 'syntaxe'].map((s) => {
    const v = byVerdict(s)
    return [s, v.n, v.real, v.legit, v.fp]
  }),
)}

« Probablement réel » signifie seulement que l'anomalie décrite par le candidat existe dans les données et ne
s'explique pas par un indice visible ; ce n'est pas une qualification. La principale source de faux positifs
écartée en cours de route : les liens LEGI vers un article mort dont le numéro n'est pas dans le texte (désormais
une note, voir plus haut).

${table(
  ['#', 'Identifiant', 'Détecteur / sous-type', 'Classement', 'Justification'],
  triage.map((t) => [
    t.n,
    `\`${ids.get(t.fingerprint) ?? '—'}\``,
    `${t.detector.split('@')[0]} / ${t.subtype}`,
    t.verdict,
    t.reason,
  ]),
)}

## Temps d'exécution

${table(
  ['Détecteur', 'Durée (ms)'],
  results.detectors.map((d) => [`\`${d.detector}\``, fmt(d.durationMs)]),
)}

Balayage complet, chargement du contexte compris (72 000 versions, 14 000 en vigueur) : ${fmt(results.durationMs)} ms,
sous \`nice\`, mémoire de pointe d'environ 550 Mio (aarch64, 4 cœurs partagés).

## Rejouer

\`\`\`sh
bun replications/c0.2/run.ts                      # balayage idempotent, régénère ce rapport et les JSON
bun packages/sweep/src/cli.ts run --dry-run       # même calcul, sans écrire en base
bun packages/sweep/src/cli.ts list --type REF_MORTE --limit 20
bun packages/sweep/src/cli.ts replay F-2026-0001  # recalcule la preuve depuis la base et la compare
\`\`\`

\`replay\` rejoue le détecteur sur la seule version citante, retrouve l'anomalie par son empreinte et compare le
SHA-256 de la preuve ; il dit aussi si la date de projection ou le lot DILA ont changé depuis le certificat.

## Limites connues

- **Un candidat n'est pas une erreur du législateur.** Un renvoi vers un article abrogé peut être voulu
  (disposition transitoire, citation d'un état antérieur) ; les indices ne couvrent que des formules usuelles.
- **Couverture partielle** : les cibles hors du CGI, du CSS et du CCH ne sont pas jugées (voir le tableau de couverture).
  Le stock ne contient pas tout l'historique : certains liens pointent vers des versions absentes de la base ;
  elles sont rattachées par leur numéro, ce qui suppose qu'un numéro n'a pas été réutilisé entre-temps.
- **Détection textuelle prudente** : plages (« L. 1 à L. 5 ») réduites à leurs bornes ; désignation lue sur la proposition
  seule ; numéros à lettres inhabituelles ou à plusieurs niveaux non reconnus ; un numéro cité mais absent de la base n'est pas jugé.
- Les articles d'**annexes** sont lus comme les autres pour les renvois, écartés pour la numérotation et la syntaxe.
- La date de projection de chaque code est celle de l'ingestion (\`legi_state.as_of\`) : une abrogation datée du lendemain
  n'est pas vue avant le lot suivant.
- NUMEROTATION : peu de candidats, précision limitée par les structures à titres imbriqués (I./A./1.) non reconnues.
- Rien dans ce rapport ne qualifie un candidat ; l'échantillon de triage ne remplace pas la revue humaine.
`
}
