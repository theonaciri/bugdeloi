const families = ['anthropic', 'google'] as const
type Family = (typeof families)[number]
type Test = 'Test3' | 'Test12'

const verdicts = {
  inria_correct: 'Le résultat Inria est retenu.',
  traduction_correcte: 'Le résultat de la traduction est retenu.',
  ambiguïté: 'Plusieurs lectures sont possibles.',
  les_deux_faux: 'Les deux résultats sont écartés.',
  indéterminé: 'Impossible de trancher.',
} as const
type Verdict = keyof typeof verdicts
type Verification = {
  family: Family | undefined
  url: string | null
  verdict: (typeof verdicts)[Verdict] | null
}

function familyOf(filename: string, content: string): Family | undefined {
  for (const line of content.split(/\r?\n/u)) {
    const declared = /^(?:[\s>*#_-]*)(?:famille|family)\b.*?\b(anthropic|google)\b/iu.exec(line)?.[1]
    if (declared) return declared.toLowerCase() as Family
  }
  return families.find((family) =>
    new RegExp(
      `(?:^|[-_.])${family === 'anthropic' ? '(?:anthropic|claude)' : '(?:google|gemini)'}(?:[-_.]|$)`,
      'iu',
    ).test(filename),
  )
}

function verdictFor(test: Test, content: string) {
  const verdictKeys = Object.keys(verdicts).join('|')
  const verdictPattern = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${verdictKeys})(?![\\p{L}\\p{N}_])`, 'giu')
  const testPattern = new RegExp(`(?<![\\p{L}\\p{N}_])${test}(?![\\p{L}\\p{N}_])`, 'iu')
  const lines = content
    .normalize('NFC')
    .split(/\r?\n/u)
    .filter((line) => testPattern.test(line))
  const rows = lines.filter((line) => !/\bTest(?:3|12)\b.*\bTest(?:3|12)\b/iu.test(line))
  const found = new Set(
    rows.flatMap((line) => [...line.matchAll(verdictPattern)].map(([match]) => match.toLowerCase())),
  )
  if (found.size !== 1) return null
  const [verdict] = found
  return verdicts[verdict as Verdict]
}

export function readVerifications(
  test: Test,
  files: Record<string, string>,
  baseUrl: string,
): Verification[] {
  const reports = Object.entries(files)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, content]) => {
      const filename = path.split('/').at(-1) ?? ''
      return {
        family: familyOf(filename, content),
        url: `${baseUrl}/${encodeURIComponent(filename)}`,
        verdict: verdictFor(test, content),
      }
    })
  return [
    ...families.flatMap<Verification>((family) => {
      const matches = reports.filter((report) => report.family === family)
      return matches.length ? matches : [{ family, verdict: null, url: null }]
    }),
    ...reports.filter((report) => !report.family),
  ]
}
