/** Applique les migrations versionnées (packages/db/migrations). Usage : bun run db:migrate */
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { createDb, databaseUrl } from './client.ts'

const { db, sql } = createDb()
try {
  await migrate(db, { migrationsFolder: new URL('../migrations', import.meta.url).pathname })
  console.log(`migrations appliquées sur ${databaseUrl().replace(/:[^:@/]+@/, ':***@')}`)
} finally {
  await sql.end()
}
