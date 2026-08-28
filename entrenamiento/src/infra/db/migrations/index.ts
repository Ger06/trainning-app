import { getConnection } from '../mongo-client'
import { migration0001 } from './0001-accounts-schema-and-unique-index'
import { migration0002 } from './0002-sessions-schema-and-ttl-index'
import { runMigrations, type MigrateResult } from './migrate'
import type { Migration } from './types'

/** Registro ordenado de migraciones de la aplicación. */
export const migrations: readonly Migration[] = [migration0001, migration0002]

/** Ejecuta el registro contra la conexión compartida (bootstrap de la app, CI). */
export async function migrate(): Promise<MigrateResult> {
  const { db } = await getConnection()
  return runMigrations(db, migrations)
}

export { runMigrations, MIGRATIONS_COLLECTION } from './migrate'
export {
  ACCOUNTS_COLLECTION,
  ACCOUNTS_USERNAME_INDEX,
} from './0001-accounts-schema-and-unique-index'
export {
  SESSIONS_COLLECTION,
  SESSIONS_TTL_INDEX,
} from './0002-sessions-schema-and-ttl-index'
export type { Migration } from './types'
