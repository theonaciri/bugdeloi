import { describe, expect, test } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { applyArchive, canonicalPath, type LegiState } from './archive.ts'
import { type Candidate, checkCandidate, LegiIndex } from './checks.ts'
import { CODES, inForce, normalizeForMatch, normalizeNum, parseArticle } from './legi-xml.ts'
import { paxPath, TarStream } from './tar.ts'

const REF = '2026-11-25'

interface V {
  id: string
  num: string
  etat: string
  debut: string
  fin: string
}

function articleXml(
  a: V & { cid?: string; versions?: V[]; contenu?: string; liens?: { id: string; typelien: string }[] },
): string {
  const versions = (a.versions ?? [a])
    .map(
      (v) =>
        `<VERSION etat="${v.etat}">\n<LIEN_ART debut="${v.debut}" etat="${v.etat}" fin="${v.fin}" id="${v.id}" num="${v.num}" origine="LEGI"/>\n</VERSION>`,
    )
    .join('\n')
  const liens = (a.liens ?? [])
    .map(
      (l) =>
        `<LIEN cidtexte="${a.cid ?? CODES.CSS}" id="${l.id}" naturetexte="CODE" num="x" sens="source" typelien="${l.typelien}">lien</LIEN>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<ARTICLE>
<META>
<META_COMMUN>
<ID>${a.id}</ID>
<NATURE>Article</NATURE>
</META_COMMUN>
<META_SPEC>
<META_ARTICLE>

<NUM>${a.num}</NUM>

<ETAT>${a.etat}</ETAT>

<DATE_DEBUT>${a.debut}</DATE_DEBUT>
<DATE_FIN>${a.fin}</DATE_FIN>
<TYPE>AUTONOME</TYPE>
</META_ARTICLE>
</META_SPEC>
</META>
<CONTEXTE>
<TEXTE autorite="" cid="${a.cid ?? CODES.CSS}" nature="CODE">
<TITRE_TXT id_txt="${a.cid ?? CODES.CSS}">Code</TITRE_TXT>
</TEXTE>
</CONTEXTE>
<VERSIONS>
${versions}
</VERSIONS>
<NOTA>
<CONTENU/>
</NOTA>
<BLOC_TEXTUEL>
<CONTENU>
${a.contenu ?? ''}
</CONTENU>
</BLOC_TEXTUEL>
<LIENS>
${liens}
</LIENS>
</ARTICLE>
`
}

// --- petit écrivain tar (ustar, préfixe pour les chemins longs) pour les tests ---
function octal(n: number, len: number): string {
  return `${n.toString(8).padStart(len - 1, '0')}\0`
}
function tarHeader(path: string, size: number, type = '0'): Uint8Array {
  const h = new Uint8Array(512)
  const enc = new TextEncoder()
  let name = path
  let prefix = ''
  if (enc.encode(path).length > 100) {
    const cut = path.lastIndexOf('/', path.length - 1 - 0)
    let i = cut
    while (i > 0 && enc.encode(path.slice(i + 1)).length <= 100 && enc.encode(path.slice(0, i)).length > 155)
      i = path.lastIndexOf('/', i - 1)
    prefix = path.slice(0, i)
    name = path.slice(i + 1)
  }
  h.set(enc.encode(name), 0)
  h.set(enc.encode('0000644\0'), 100)
  h.set(enc.encode(octal(0, 8)), 108)
  h.set(enc.encode(octal(0, 8)), 116)
  h.set(enc.encode(octal(size, 12)), 124)
  h.set(enc.encode(octal(0, 12)), 136)
  h.set(enc.encode('        '), 148)
  h.set(enc.encode(type), 156)
  h.set(enc.encode('ustar\0'), 257)
  h.set(enc.encode('00'), 263)
  h.set(enc.encode(prefix), 345)
  let sum = 0
  for (const b of h) sum += b
  h.set(enc.encode(`${sum.toString(8).padStart(6, '0')}\0 `), 148)
  return h
}
function makeTar(files: { path: string; content: string; type?: string }[]): Uint8Array<ArrayBuffer> {
  const parts: Uint8Array[] = []
  const enc = new TextEncoder()
  for (const f of files) {
    const data = enc.encode(f.content)
    parts.push(tarHeader(f.path, data.length, f.type ?? '0'))
    parts.push(data)
    const pad = (512 - (data.length % 512)) % 512
    parts.push(new Uint8Array(pad))
  }
  parts.push(new Uint8Array(1024))
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

function artPath(code: string, id: string, prefix = ''): string {
  const d = id.slice(8)
  return `${prefix}legi/global/code_et_TNC_en_vigueur/code_en_vigueur/LEGI/TEXT/00/00/06/06/95/${code}/article/LEGI/ARTI/${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4, 6)}/${d.slice(6, 8)}/${d.slice(8, 10)}/${id}.xml`
}

describe('tar', () => {
  test('lit des chemins longs (préfixe ustar) et ne garde que les fichiers voulus, même en petits morceaux', () => {
    const long = artPath(CODES.CGI, 'LEGIARTI000000000001')
    const tar = makeTar([
      { path: 'legi/', content: '', type: '5' },
      { path: long, content: 'A'.repeat(700) },
      { path: 'autre.txt', content: 'ignoré' },
      { path: 'liste_suppression_legi.dat', content: 'x\ny\n' },
    ])
    const got: Record<string, number> = {}
    const s = new TarStream(
      (p) => p !== 'autre.txt',
      (e, d) => {
        got[e.path] = d.length
      },
    )
    for (let i = 0; i < tar.length; i += 37) s.push(tar.subarray(i, i + 37))
    expect(got[long]).toBe(700)
    expect(got['liste_suppression_legi.dat']).toBe(4)
    expect(got['autre.txt']).toBeUndefined()
  })

  test('extension GNU « L » et pax « x »', () => {
    const longName = `${'a/'.repeat(120)}fichier.xml`
    const pax = `${`path=${longName}\n`.length + 4} path=${longName}\n`
    // la longueur pax inclut son propre préfixe : on l'ajuste
    const len = pax.length
    const fixed = `${len} path=${longName}\n`
    expect(paxPath(new TextEncoder().encode(fixed))).toBe(longName)
    const tar = makeTar([
      { path: '././@LongLink', content: `${longName}\0`, type: 'L' },
      { path: 'tronqué', content: 'gnu' },
      { path: 'PaxHeader', content: fixed, type: 'x' },
      { path: 'tronqué2', content: 'pax' },
    ])
    const got: string[] = []
    const s = new TarStream(
      () => true,
      (e) => {
        got.push(e.path)
      },
    )
    s.push(tar)
    expect(got).toEqual([longName, longName])
  })
})

describe('lecture XML et normalisation', () => {
  test('parseArticle lit métadonnées, VERSIONS, texte et liens', () => {
    const xml = articleXml({
      id: 'LEGIARTI000000000010',
      num: 'L. 131-8',
      etat: 'VIGUEUR',
      debut: '2020-01-01',
      fin: '2999-01-01',
      contenu: '<p>Selon l&apos;article<br/>L. 131-7 « du présent code » — voir&#160;aussi.</p>',
      liens: [{ id: 'LEGIARTI000000000011', typelien: 'CITATION' }],
    })
    const r = parseArticle(xml, { withText: true })
    expect(r?.num).toBe('L. 131-8')
    expect(r?.etat).toBe('VIGUEUR')
    expect(r?.textCid).toBe(CODES.CSS)
    expect(r?.versions).toHaveLength(1)
    expect(r?.text).toBe(`Selon l'article L. 131-7"du présent code"- voir aussi.`)
    expect(r?.links?.[0]).toMatchObject({ id: 'LEGIARTI000000000011', typelien: 'CITATION' })
    expect(parseArticle(xml, { withText: false })?.text).toBeUndefined()
  })

  test('normalisations', () => {
    expect(normalizeForMatch('l’article  « L. 1 » – x')).toBe(`l'article"L. 1"- x`)
    expect(normalizeNum('L. 521-1')).toBe(normalizeNum('L521-1'))
    expect(normalizeNum('199 decies E')).toBe('199deciese')
  })

  test('inForce : intervalle [début, fin[ et états', () => {
    const v = (etat: string, debut: string, fin: string) => ({ etat, debut, fin })
    expect(inForce(v('VIGUEUR', '2020-01-01', '2999-01-01'), REF)).toBe(true)
    expect(inForce(v('VIGUEUR', '2026-11-25', '2999-01-01'), REF)).toBe(true)
    expect(inForce(v('VIGUEUR', '2020-01-01', '2026-11-25'), REF)).toBe(false)
    expect(inForce(v('ABROGE_DIFF', '2020-01-01', '2222-02-22'), REF)).toBe(true)
    expect(inForce(v('MODIFIE', '2020-01-01', '2999-01-01'), REF)).toBe(false)
    expect(inForce(v('MODIFIE', '2020-01-01', '2027-01-01'), REF)).toBe(true)
    expect(inForce(v('ABROGE', '2020-01-01', '2999-01-01'), REF)).toBe(false)
    expect(inForce(v('VIGUEUR_DIFF', '2027-01-01', '2999-01-01'), REF)).toBe(false)
  })
})

// --- verdicts ---
function index(arts: Parameters<typeof articleXml>[0][], code: 'CGI' | 'CSS' | 'CCH' = 'CSS'): LegiIndex {
  const idx = new LegiIndex()
  for (const a of arts) {
    const r = parseArticle(articleXml({ ...a, cid: CODES[code] }), { withText: true })
    if (r) idx.add(r, code)
  }
  idx.finish()
  return idx
}

const SOURCE = {
  id: 'LEGIARTI000000000100',
  num: 'D174-13',
  etat: 'VIGUEUR',
  debut: '1985-12-21',
  fin: '2999-01-01',
  contenu: '<p>dans les conditions prévues par les articles D. 174-2 à D. 174-11.</p>',
}
const T1 = {
  id: 'LEGIARTI000000000201',
  num: 'D174-2',
  etat: 'MODIFIE',
  debut: '1985-12-21',
  fin: '1988-03-02',
}
const T2 = {
  id: 'LEGIARTI000000000202',
  num: 'D174-2',
  etat: 'ABROGE',
  debut: '1988-03-02',
  fin: '2017-05-06',
}
const lineage = [T1, T2]

function cand(over: Partial<Candidate> = {}): Candidate {
  return {
    id: 'F-TEST',
    detector: 'ref-morte-liens@1.1.0',
    subtype: 'abrogé',
    sourceId: SOURCE.id,
    excerpts: ['prévues par les articles D. 174-2 à D. 174-11.'],
    target: { kind: 'link', id: T1.id, num: 'D174-2', textCid: CODES.CSS },
    claimedLastId: T2.id,
    ...over,
  }
}

describe('checkCandidate', () => {
  test('confirmé : cible abrogée, lignée reconstituée par VERSIONS', () => {
    const idx = index([SOURCE, { ...T1, versions: lineage }, { ...T2, versions: lineage }])
    const r = checkCandidate(cand(), idx, REF)
    expect(r.verdict).toBe('confirmé')
    expect(r.facts.target_last?.id).toBe(T2.id)
  })

  test('lignée connue par le seul bloc VERSIONS (fichier de la dernière version absent)', () => {
    const idx = index([SOURCE, { ...T1, versions: lineage }])
    const r = checkCandidate(cand(), idx, REF)
    expect(r.verdict).toBe('confirmé')
    expect(r.facts.target_last?.from).toBe('versions')
  })

  test('infirmé : une version de la lignée est en vigueur', () => {
    const T3 = {
      id: 'LEGIARTI000000000203',
      num: 'D174-2',
      etat: 'VIGUEUR',
      debut: '2017-05-06',
      fin: '2999-01-01',
    }
    const l = [T1, T2, T3]
    const idx = index([SOURCE, { ...T1, versions: l }, { ...T2, versions: l }, { ...T3, versions: l }])
    const r = checkCandidate(cand(), idx, REF)
    expect(r.verdict).toBe('infirmé')
    expect(r.reason).toContain(T3.id)
  })

  test('infirmé : numéro réattribué à un autre article en vigueur du même code', () => {
    const other = {
      id: 'LEGIARTI000000000300',
      num: 'D. 174-2',
      etat: 'VIGUEUR',
      debut: '2021-06-01',
      fin: '2999-01-01',
    }
    const idx = index([SOURCE, { ...T1, versions: lineage }, { ...T2, versions: lineage }, other])
    const r = checkCandidate(cand(), idx, REF)
    expect(r.verdict).toBe('infirmé')
    expect(r.reason).toContain('autre lignée')
  })

  test('infirmé : sous-type annoncé différent du dernier état', () => {
    const idx = index([SOURCE, { ...T1, versions: lineage }, { ...T2, versions: lineage }])
    expect(checkCandidate(cand({ subtype: 'transféré' }), idx, REF).verdict).toBe('infirmé')
  })

  test('infirmé : source non en vigueur (MODIFIE à fin ouverte) ou extrait absent', () => {
    const idx = index([
      { ...SOURCE, etat: 'MODIFIE' },
      { ...T1, versions: lineage },
    ])
    expect(checkCandidate(cand(), idx, REF).verdict).toBe('infirmé')
    const idx2 = index([SOURCE, { ...T1, versions: lineage }])
    const r = checkCandidate(cand({ excerpts: ['texte qui ne figure pas'] }), idx2, REF)
    expect(r.verdict).toBe('infirmé')
    expect(r.facts.excerpt_match).toBe('aucun')
  })

  test('indéterminé : dernier état non terminal (MODIFIE sans version suivante)', () => {
    const l = [T1]
    const idx = index([SOURCE, { ...T1, versions: l }])
    const r = checkCandidate(cand({ subtype: 'autre:MODIFIE' }), idx, REF)
    expect(r.verdict).toBe('indéterminé')
    expect(r.reason).toContain('non terminal')
  })

  test('candidat textuel : résolution par numéro dans le code visé', () => {
    const idx = index([SOURCE, { ...T1, versions: lineage }, { ...T2, versions: lineage }])
    const r = checkCandidate(
      cand({ detector: 'ref-morte-texte@1.1.0', target: { kind: 'num', num: 'd174-2', textCid: CODES.CSS } }),
      idx,
      REF,
    )
    expect(r.verdict).toBe('confirmé')
  })

  test('indéterminé : source absente, cible hors des trois codes, cible introuvable', () => {
    const idx = index([SOURCE])
    expect(checkCandidate(cand({ sourceId: 'LEGIARTI000000009999' }), idx, REF).verdict).toBe('indéterminé')
    expect(
      checkCandidate(
        cand({ target: { kind: 'link', id: 'X', num: '1', textCid: 'LEGITEXT000000000001' } }),
        idx,
        REF,
      ).verdict,
    ).toBe('indéterminé')
    expect(checkCandidate(cand(), idx, REF).verdict).toBe('indéterminé')
  })
})

describe('archives', () => {
  test('canonicalPath retire le préfixe des incréments', () => {
    expect(canonicalPath('20261124-221545/legi/global/x.xml')).toBe('legi/global/x.xml')
    expect(canonicalPath('legi/global/x.xml')).toBe('legi/global/x.xml')
  })

  test('stock puis incrément : mise à jour, suppression annoncée, filtre des codes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'c02xml-'))
    const a1 = artPath(CODES.CGI, 'LEGIARTI000000000001')
    const a2 = artPath(CODES.CGI, 'LEGIARTI000000000002')
    const out = artPath('LEGITEXT000000000999', 'LEGIARTI000000000003')
    const x = (id: string, etat: string) =>
      articleXml({ id, num: '1', etat, debut: '2000-01-01', fin: '2999-01-01', cid: CODES.CGI })
    const stock = makeTar([
      { path: a1, content: x('LEGIARTI000000000001', 'VIGUEUR') },
      { path: a2, content: x('LEGIARTI000000000002', 'VIGUEUR') },
      { path: out, content: x('LEGIARTI000000000003', 'VIGUEUR') },
    ])
    const inc = makeTar([
      { path: '20261124-221545/liste_suppression_legi.dat', content: `${a2.slice(0, -4)}\n` },
      { path: `20261124-221545/${a1}`, content: x('LEGIARTI000000000001', 'ABROGE') },
    ])
    const stockPath = join(dir, 'stock.tar.gz')
    const incPath = join(dir, 'inc.tar.gz')
    writeFileSync(stockPath, Bun.gzipSync(stock))
    writeFileSync(incPath, Bun.gzipSync(inc))
    const state: LegiState = new Map()
    const s1 = await applyArchive(stockPath, state, new Set())
    expect(s1.articleFiles).toBe(2)
    const s2 = await applyArchive(incPath, state, new Set())
    expect(s2.deletionsApplied).toBe(1)
    expect([...state.values()].map((v) => `${v.rec.id}:${v.rec.etat}`)).toEqual([
      'LEGIARTI000000000001:ABROGE',
    ])
  })
})
