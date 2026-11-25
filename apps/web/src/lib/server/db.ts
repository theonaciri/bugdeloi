/**
 * Connexion du serveur web à Postgres — **en lecture seule** (`default_transaction_read_only`) :
 * le site affiche, il n'écrit jamais. Le LISTEN du flux temps réel reste autorisé.
 * Une seule instance par process (survit au rechargement à chaud en dev via globalThis).
 */
import { createSql, databaseUrl, schema } from '@bugdeloi/db'
import { drizzle } from 'drizzle-orm/postgres-js'

function connect() {
  const sql = createSql(databaseUrl(), {
    max: 8,
    idle_timeout: 30,
    connect_timeout: 5,
    connection: { application_name: 'bugdeloi-web', default_transaction_read_only: true },
  })
  return { sql, db: drizzle(sql, { schema }) }
}

type Conn = ReturnType<typeof connect>
const g = globalThis as typeof globalThis & { __bugdeloiWebDb?: Conn }

export function conn(): Conn {
  g.__bugdeloiWebDb ??= connect()
  return g.__bugdeloiWebDb
}

export const db = () => conn().db

/** Nom de la base (sans identifiants) pour la page d'état. */
export function databaseName(): string {
  try {
    return new URL(databaseUrl()).pathname.replace(/^\//, '') || '?'
  } catch {
    return '?'
  }
}

/** Ferme le pool et la connexion LISTEN : sans cela, la boucle d'événements ne se vide jamais. */
export async function closeDb(): Promise<void> {
  const c = g.__bugdeloiWebDb
  g.__bugdeloiWebDb = undefined
  await c?.sql.end({ timeout: 5 })
}
