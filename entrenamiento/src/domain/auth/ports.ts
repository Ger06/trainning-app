import type { Account, NewAccount } from './account'
import type { Session } from './session'

/**
 * Puertos del dominio de autenticación (constitución P3 y P4). **Sólo tipos**:
 * las implementaciones concretas (MongoDB, `node:crypto`, cookies) viven en
 * `src/infra` y se ensamblan en el composition root (T20). Este archivo no
 * importa `mongodb` ni `react`.
 */

export interface AccountRepository {
  /** La cuenta con ese `usernameNormalized`, o `null` si no existe (RF‑11). */
  findByNormalizedUsername(usernameNormalized: string): Promise<Account | null>

  /** La cuenta con ese `id`, o `null` si no existe (solo lectura). */
  findById(id: string): Promise<Account | null>

  /**
   * Persiste una cuenta nueva y devuelve la `Account` resultante (con `id`).
   * @throws `UsernameTakenError` si el índice único de `usernameNormalized` la
   *   rechaza — carrera entre dos altas simultáneas (RF‑5, plan D6).
   */
  insert(data: NewAccount): Promise<Account>
}

export interface PasswordHasher {
  /** Deriva el hash almacenable (`scrypt$…`) a partir de la contraseña (RF‑8). */
  hash(plain: string): Promise<string>
  /** Compara la contraseña con un hash almacenado, en tiempo constante (RF‑12). */
  verify(plain: string, stored: string): Promise<boolean>
}

export interface SessionStore {
  /** Crea una sesión para la cuenta y devuelve el value object (RF‑6, RF‑10). */
  issue(accountId: string): Promise<Session>
  /** La sesión vigente con ese `id`, o `null` si no existe o venció (RF‑14). */
  get(id: string): Promise<Session | null>
  /** Elimina la sesión. Idempotente: no falla si ya no existe (RF‑15). */
  revoke(id: string): Promise<void>
}

export interface Clock {
  now(): Date
}

export interface IdGenerator {
  newId(): string
}
