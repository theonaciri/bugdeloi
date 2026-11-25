interface FileResult {
  file: string
  tests: number
  passed: number
  failed: number
  errors: string[]
  failedCases: string[]
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Objet Clerk invalide.')
  return value as Record<string, unknown>
}

function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Liste Clerk invalide.')
  return value
}

export function parseClerkReport(stdout: string): FileResult[] {
  // Ninja may print progress before Clerk's final single-line JSON report.
  const line = stdout.trimEnd().split('\n').at(-1) ?? ''
  const report = object(JSON.parse(line))
  return list(report['test-results']).map((raw) => {
    const { file, tests } = object(raw)
    if (typeof file !== 'string' || !file.startsWith('/work/')) throw new Error('Chemin Clerk invalide.')
    const { scopes, 'inline-tests': inlineTests } = object(tests)
    const cases = [...list(scopes), ...list(inlineTests)].map(object)
    const result: FileResult = {
      file: file.slice('/work/'.length),
      tests: cases.length,
      passed: 0,
      failed: 0,
      errors: [],
      failedCases: [],
    }
    for (const test of cases) {
      const name = test.scope_name ?? test.cmd
      if (typeof name !== 'string' || typeof test.success !== 'boolean') {
        throw new Error('Cas de test Clerk invalide.')
      }
      if (test.success) result.passed++
      else {
        result.failed++
        result.failedCases.push(name)
        for (const error of list(test.errors ?? [])) {
          const { message } = object(error)
          if (typeof message !== 'string') throw new Error('Message Clerk invalide.')
          result.errors.push(message)
        }
      }
    }
    return result
  })
}

export function buildErrors(output: string): FileResult[] {
  const errors = new Map<string, FileResult>()
  let file: FileResult | undefined
  for (const line of output.split('\n')) {
    const failed = /^FAILED:\s+(.*)/.exec(line)?.[1]
    if (failed !== undefined) {
      const catalaFile = /(?:^|\s)(?:\/build\/|\/work\/)?(\S+?\.catala_(?:fr|en))(?=[:@+\s]|$)/.exec(
        failed,
      )?.[1]
      file = catalaFile
        ? { file: catalaFile, tests: 0, passed: 0, failed: 0, errors: [], failedCases: [] }
        : undefined
      if (file) errors.set(file.file, file)
    } else if (file && /^\s*(?:\[ERROR\]|\[ERREUR\]|Error:|Fatal error:)/.test(line)) {
      file.errors.push(line.trim())
    }
  }
  return [...errors.values()]
}

export function firstDiagnostic(output: string) {
  const lines = output.split('\n').map((line) => line.trim())
  return (
    lines.find((line) => /^(?:\[ERROR\]|\[ERREUR\]|Error:|Fatal error:|Error |ninja: error)/.test(line)) ??
    lines.find((line) => /^FAILED:/.test(line))
  )
}
