import { DESK_FAMILIES, DESK_RELEASE_REASONS, DESK_ROLES } from '@bugdeloi/db'

const handlePattern = /^(?=.{1,39}$)[a-z0-9]+(?:-[a-z0-9]+)*$/i
const leasePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function matches(pattern: RegExp) {
  return (value: string) => (pattern.test(value) ? value : undefined)
}

function oneOf<T extends string>(values: readonly T[]) {
  return (value: string) => values.find((item) => item === value)
}

const lease = matches(leasePattern)

export const deskInput = {
  next: { handle: matches(handlePattern), role: oneOf(DESK_ROLES), family: oneOf(DESK_FAMILIES) },
  beat: { lease },
  release: { lease, reason: oneOf(DESK_RELEASE_REASONS) },
}

type Validator = (value: string) => string | undefined
type Input<S extends Record<string, Validator>> = { [K in keyof S]: Exclude<ReturnType<S[K]>, undefined> }

export type DeskNextInput = {
  handle: string
  role?: (typeof DESK_ROLES)[number]
  family: (typeof DESK_FAMILIES)[number]
  limit: number
}

const ALLOWED_NEXT_KEYS = new Set(['handle', 'role', 'family', 'limit'])

/**
 * Parse les paramètres de `GET /desk/next`.
 * Tous les paramètres sont optionnels :
 * - `limit` : nombre de tâches souhaitées (1..100, défaut 20)
 * - `role` : rôle demandé (omission = `analyst` en priorité, puis `translate` s'il n'y en a plus)
 * - `handle` : pseudo contributeur (défaut `anonymous`)
 * - `family` : famille de modèle (défaut `local-autre`)
 */
export function parseDeskNextInput(query: URLSearchParams): DeskNextInput | null {
  for (const key of query.keys()) {
    if (!ALLOWED_NEXT_KEYS.has(key)) return null
    if (query.getAll(key).length !== 1) return null
  }

  let handle = 'anonymous'
  const rawHandle = query.get('handle')
  if (rawHandle !== null) {
    const valid = matches(handlePattern)(rawHandle)
    if (!valid) return null
    handle = valid
  }

  let role: (typeof DESK_ROLES)[number] | undefined
  const rawRole = query.get('role')
  if (rawRole !== null) {
    const valid = oneOf(DESK_ROLES)(rawRole)
    if (!valid) return null
    role = valid
  }

  let family: (typeof DESK_FAMILIES)[number] = 'local-autre'
  const rawFamily = query.get('family')
  if (rawFamily !== null) {
    const valid = oneOf(DESK_FAMILIES)(rawFamily)
    if (!valid) return null
    family = valid
  }

  let limit = 20
  const rawLimit = query.get('limit')
  if (rawLimit !== null) {
    if (!/^\d+$/.test(rawLimit)) return null
    const parsed = Number.parseInt(rawLimit, 10)
    if (parsed < 1 || parsed > 100) return null
    limit = parsed
  }

  return { handle, role, family, limit }
}

/** Chaque champ du schéma est obligatoire et doit apparaître une seule fois. */
export function parseDeskInput<S extends Record<string, Validator>>(
  query: URLSearchParams,
  fields: S,
): Input<S> | null {
  const keys = Object.keys(fields)
  if (query.size !== keys.length) return null

  const result: Record<string, string> = {}
  for (const key of keys) {
    const values = query.getAll(key)
    if (values.length !== 1 || values[0] === undefined) return null
    const value = fields[key]?.(values[0])
    if (value === undefined) return null
    result[key] = value
  }
  return result as Input<S>
}
