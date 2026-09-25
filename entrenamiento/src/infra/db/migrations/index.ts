import { getConnection } from '../mongo-client'
import { migration0001 } from './0001-accounts-schema-and-unique-index'
import { migration0002 } from './0002-sessions-schema-and-ttl-index'
import { migration0003 } from './0003-training-collections'
import { runMigrations, type MigrateResult } from './migrate'
import type { Migration } from './types'

/** Registro ordenado de migraciones de la aplicación. */
export const migrations: readonly Migration[] = [migration0001, migration0002, migration0003]

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
export {
  EXERCISES_COLLECTION,
  EXERCISES_NAME_INDEX,
  ROUTINES_COLLECTION,
  ROUTINES_NAME_INDEX,
  ASSIGNMENTS_COLLECTION,
  ASSIGNMENTS_SLOT_INDEX,
  TRAINER_CLIENT_LINKS_COLLECTION,
  TRAINER_CLIENT_LINKS_INDEX,
} from './0003-training-collections'
export type { Migration } from './types'
