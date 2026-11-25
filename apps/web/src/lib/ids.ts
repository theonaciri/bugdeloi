/**
 * Identifiants LEGI utilisables côté navigateur. `@bugdeloi/core/legi` importe `node:crypto`
 * (empreintes) et ne doit pas entrer dans le bundle client : on ne réexpose ici que le motif.
 * Doit rester identique à `LEGIARTI_RE` de core (vérifié par `ids.test.ts`).
 */
export const LEGIARTI_PATTERN = /^LEGIARTI\d{12}$/

export function isLegiarti(value: string | null | undefined): value is string {
  return !!value && LEGIARTI_PATTERN.test(value)
}
