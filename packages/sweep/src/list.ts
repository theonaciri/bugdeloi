import { type Db, finding } from '@bugdeloi/db'
import { and, desc, eq, sql } from 'drizzle-orm'

export interface ListOptions {
  type?: string
  subtype?: string
  status?: string
  limit?: number
}

export interface ListedFinding {
  id: string
  type: string
  subtype: string
  status: string
  detector: string
  claim: string
}

export async function listFindings(db: Db, options: ListOptions = {}): Promise<ListedFinding[]> {
  const conds = [
    options.type ? eq(finding.type, options.type) : undefined,
    options.status ? eq(finding.status, options.status) : undefined,
    options.subtype ? sql`${finding.certificate}->>'subtype' = ${options.subtype}` : undefined,
    sql`${finding.certificate}->>'schema' = 'bugdeloi/finding-certificate@1'`,
  ].filter((c) => c !== undefined)
  const rows = await db
    .select({
      id: finding.id,
      type: finding.type,
      status: finding.status,
      detector: finding.detector,
      claim: finding.claim,
      subtype: sql<string>`${finding.certificate}->>'subtype'`,
    })
    .from(finding)
    .where(and(...conds))
    .orderBy(desc(finding.id))
    .limit(options.limit ?? 50)
  return rows
}
