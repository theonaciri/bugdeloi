import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.ts'

/**
 * Connexion locale par socket Unix avec authentification « peer » (rôle Postgres = utilisateur
 * système `ubuntu`) : aucun mot de passe à stocker. Surchargable par DATABASE_URL.
 */
export const DEFAULT_DATABASE_URL = 'postgres://ubuntu@localhost:5432/bugdeloi?host=/var/run/postgresql'

export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL
}

export function createSql(url = databaseUrl(), options: postgres.Options<Record<string, never>> = {}) {
  return postgres(url, { max: 10, idle_timeout: 30, ...options })
}

export function createDb(url = databaseUrl()) {
  const sql = createSql(url)
  return { db: drizzle(sql, { schema }), sql }
}

export type Db = ReturnType<typeof createDb>['db']
