import type { Db } from 'mongodb'
import type { Migration } from './types'

/** Libro mayor: una fila por migración aplicada. */
export const MIGRATIONS_COLLECTION = '_migrations'

export interface MigrationRecord {
  name: string
  appliedAt: Date
}

export interface MigrateResult {
  /** Migraciones ejecutadas en esta llamada, en orden. */
  applied: string[]
  /** Migraciones que ya estaban aplicadas y se omitieron. */
  skipped: string[]
}

/**
 * Parte pura del runner: ordena por `name` y separa lo pendiente de lo ya hecho.
 * Sin efectos ni acceso a BD → unit-testable (constitución P3, P5).
 */
export function planMigrations(
  all: readonly Migration[],
  done: ReadonlySet<string>,
): { toApply: Migration[]; toSkip: string[] } {
  const ordered = [...all].sort((a, b) => a.name.localeCompare(b.name))
  const toApply: Migration[] = []
  const toSkip: string[] = []
  for (const migration of ordered) {
    if (done.has(migration.name)) {
      toSkip.push(migration.name)
    } else {
      toApply.push(migration)
    }
  }
  return { toApply, toSkip }
}

export function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: number }).code === 11000
  )
}

/**
 * Aplica las migraciones pendientes en orden y registra cada una en
 * `_migrations`. Una segunda ejecución con el mismo conjunto no aplica nada.
 */
export async function runMigrations(
  db: Db,
  migrations: readonly Migration[],
): Promise<MigrateResult> {
  const ledger = db.collection<MigrationRecord>(MIGRATIONS_COLLECTION)
  await ledger.createIndex({ name: 1 }, { unique: true })

  const recorded = await ledger.find({}, { projection: { name: 1 } }).toArray()
  const { toApply, toSkip } = planMigrations(migrations, new Set(recorded.map((r) => r.name)))

  const applied: string[] = []
  const skipped = [...toSkip]

  for (const migration of toApply) {
    await migration.up(db)
    try {
      await ledger.insertOne({ name: migration.name, appliedAt: new Date() })
      applied.push(migration.name)
    } catch (err) {
      // Otra ejecución concurrente la registró primero: no es un fallo.
      if (isDuplicateKeyError(err)) {
        skipped.push(migration.name)
        continue
      }
      throw err
    }
  }

  return { applied, skipped }
}
