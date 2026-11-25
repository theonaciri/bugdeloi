import { defineConfig } from 'drizzle-kit'
import { databaseUrl } from './src/client.ts'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
  dbCredentials: { url: databaseUrl() },
  strict: true,
  verbose: true,
})
