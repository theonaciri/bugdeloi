import { expect, test } from 'bun:test'
import { renderReport, type TriageEntry } from './report.ts'
import type { Results } from './results.ts'

const results = {
  generatedAt: '2026-11-25T10:00:00.000Z',
  sweepRunId: 7,
  projection: [
    {
      code: 'CGI',
      textId: 'LEGITEXT000006069577',
      asOf: '2026-11-25',
      archive: 'a.tar.gz',
      archiveSha256: 'a'.repeat(64),
    },
  ],
  versionsLoaded: 10,
  articlesChecked: { CGI: 3 },
  durationMs: 100,
  totalMs: 150,
  contextMs: 60,
  scanMs: { 'ref-morte-liens@1.0.0': 5 },
  peakRssMb: 400,
  detectors: [
    {
      detector: 'ref-morte-liens@1.0.0',
      candidates: 1,
      new: 1,
      alreadyKnown: 0,
      bySubtype: { abrogé: 1 },
      stats: {
        liens_citation_sortants: 10,
        liens_resolus: 8,
        liens_par_classe: { vivante: 7, morte: 1, hors_codes_ingeres: 2 },
        resolution_par: { version: 8 },
      },
    },
  ],
  candidatesByTypeAndSubtype: { 'REF_MORTE / abrogé': 1 },
  candidatesByDetector: { 'ref-morte-liens@1.0.0': 1 },
  refMorteTexteAvecLienLegi: 0,
  refMorteTexteRecoupeLesLiens: 0,
  refMorteTexteTotal: 0,
  refMorteLiensTotal: 1,
  ecartsLienTexte: 2,
  reproducedByType: { SYNTAXE: 1 },
  withdrawals: [{ id: 'F-2026-0002', type: 'REF_MORTE', by: 'ref-morte-liens@1.1.0' }],
  numerosReattribues: 1,
  triage: { size: 1, byStratumAndVerdict: {} },
} as unknown as Results

const triage: TriageEntry[] = [
  {
    n: 1,
    fingerprint: 'fp1',
    stratum: 'liens',
    detector: 'ref-morte-liens@1.0.0',
    subtype: 'abrogé',
    verdict: 'probablement réel',
    reason: 'test',
  },
]

test('le rapport annonce « candidats non qualifiés », le tri non probant, la couverture et évite le vocabulaire interdit', () => {
  const md = renderReport(results, triage, new Map([['fp1', 'F-2026-0001']]))
  expect(md).toContain('Candidats non qualifiés')
  expect(md).toContain('tri par LLM, non probant')
  expect(md).toContain('80 %') // 8 liens résolus sur 10
  expect(md).toContain('`F-2026-0001`')
  expect(md).toContain('`F-2026-0002`')
  expect(md).toContain('SYNTAXE 1')
  for (const banned of ['prouvé', 'certifié', 'vérifié', 'bug de la loi'])
    expect(md.toLowerCase()).not.toContain(banned)
})
