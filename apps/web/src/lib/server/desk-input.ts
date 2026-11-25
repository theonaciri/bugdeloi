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
