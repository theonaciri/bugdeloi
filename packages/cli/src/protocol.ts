// Contrat du guichet (AGENTS.md §5–6), partagé par les commandes et les contrôles hors ligne.
export const roles = [
  'analyst',
  'translate',
  'oracle',
  'redteam',
  'backtranslate',
  'judge',
  'doctrine',
  'reduce',
] as const
export const families = [
  'anthropic',
  'openai',
  'google',
  'mistral',
  'meta',
  'deepseek',
  'qwen',
  'local-autre',
  'humain',
] as const
export const releaseReasons = [
  'submitted',
  'text_mismatch',
  'ambiguous_text',
  'missing_dependency',
  'interface_too_weak',
  'needs_reduction',
  'out_of_time',
  'other',
] as const
export const taskIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/
export const digestPattern = /^[a-f0-9]{64}$/

export function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmpty)
}

export function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return values.some((item) => item === value)
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function serviceOrigin(value: string) {
  const url = new URL(value)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('L’adresse du service doit être une origine HTTP(S).')
  return url.origin
}

export const defaultApi = 'https://bugdeloi.theonaciri.fr'

export function git(cwd: string, ...args: string[]) {
  const result = Bun.spawnSync(['git', ...args], { cwd, stdin: 'ignore' })
  if (!result.success) {
    throw new Error(result.stderr.toString().trim() || `Échec de git ${args[0]}.`)
  }
  return result.stdout.toString()
}
