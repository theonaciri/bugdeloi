import { CACHE } from '#lib/server/http.ts'
import {
  FINDINGS_LIMIT_MAX,
  FINDINGS_NOTE,
  FINDINGS_OFFSET_MAX,
  isCodeKey,
  isFindingStatus,
  isFindingType,
  workingFindings,
} from '#lib/server/queries.ts'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ url }) => {
  const params = url.searchParams
  const status = params.get('status') ?? 'reproduced'
  const type = params.get('type') ?? undefined
  const code = params.get('code') ?? undefined
  const limit = params.get('limit') ?? '20'
  const offset = params.get('offset') ?? '0'
  const keys = new Set(params.keys())

  if (
    keys.size !== params.size ||
    [...keys].some((key) => !['status', 'type', 'code', 'limit', 'offset'].includes(key)) ||
    !isFindingStatus(status) ||
    (type !== undefined && !isFindingType(type)) ||
    (code !== undefined && !isCodeKey(code)) ||
    !/^[1-9]\d{0,2}$/u.test(limit) ||
    Number(limit) > FINDINGS_LIMIT_MAX ||
    !/^\d{1,10}$/u.test(offset) ||
    Number(offset) > FINDINGS_OFFSET_MAX
  ) {
    return Response.json(
      { error: 'invalid_parameters' },
      { status: 400, headers: { 'cache-control': CACHE.none } },
    )
  }

  const result = await workingFindings({ status, type, code, limit: Number(limit), offset: Number(offset) })
  return Response.json(
    { ...result, status, note: FINDINGS_NOTE },
    { headers: { 'cache-control': CACHE.live } },
  )
}
