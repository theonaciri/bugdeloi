import { expect, test } from 'bun:test'
import { LEGIARTI_RE } from '@bugdeloi/core/legi'
import { isLegiarti, LEGIARTI_PATTERN } from './ids.ts'

test('le motif client est identique à celui de core', () => {
  expect(LEGIARTI_PATTERN.source).toBe(LEGIARTI_RE.source)
  expect(isLegiarti('LEGIARTI000006308740')).toBe(true)
  expect(isLegiarti('LEGIARTI00000630874')).toBe(false)
  expect(isLegiarti(null)).toBe(false)
})
