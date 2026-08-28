import type { Db } from 'mongodb'

/**
 * Una migración versionada del esquema (constitución P6).
 *
 * `up` debe ser **idempotente**: aplicarla sobre una BD ya migrada no debe
 * fallar ni duplicar efectos (crear índices/colecciones y `collMod` en MongoDB
 * ya lo son). El runner además evita re-ejecutarla si ya está en `_migrations`.
 */
export interface Migration {
  /** Identificador único y ordenable lexicográficamente, p. ej. `0001-accounts`. */
  readonly name: string
  up(db: Db): Promise<void>
}
