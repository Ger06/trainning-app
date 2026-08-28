import { newAccount, type Account } from './account'
import { parseCredentials } from './credentials'
import { InvalidInputError, UsernameTakenError } from './errors'
import type { AccountRepository, Clock, PasswordHasher, SessionStore } from './ports'
import { err, ok, type Result } from './result'
import type { Session } from './session'

/**
 * Caso de uso de registro (constitución P3: función pura de orquestación; toda
 * dependencia entra por `deps`). Cubre RF‑1…RF‑8.
 */

export interface RegisterInput {
  username?: unknown
  password?: unknown
  role?: unknown
}

export interface RegisterDeps {
  accounts: AccountRepository
  hasher: PasswordHasher
  sessions: SessionStore
  clock: Clock
}

export interface RegisterSuccess {
  account: Account
  session: Session
}

export type RegisterError = InvalidInputError | UsernameTakenError

export async function registerUser(
  input: RegisterInput,
  deps: RegisterDeps,
): Promise<Result<RegisterSuccess, RegisterError>> {
  // RF‑1…RF‑4, RF‑13: validación autoritativa antes de tocar nada externo (RF‑17).
  const parsed = parseCredentials(input)
  if (!parsed.ok) {
    return parsed
  }
  const creds = parsed.value

  // RF‑5: mensaje específico "nombre de usuario ya en uso".
  const existing = await deps.accounts.findByNormalizedUsername(creds.usernameNormalized)
  if (existing) {
    return err(new UsernameTakenError(creds.username))
  }

  // RF‑8: al repo sólo llega el hash, nunca la contraseña.
  const passwordHash = await deps.hasher.hash(creds.password)

  // RF‑7: el rol elegido se persiste tal cual.
  const draft = newAccount({
    username: creds.username,
    usernameNormalized: creds.usernameNormalized,
    role: creds.role,
    passwordHash,
    createdAt: deps.clock.now(),
  })

  let account: Account
  try {
    account = await deps.accounts.insert(draft)
  } catch (error) {
    // RF‑5: carrera entre dos altas simultáneas del mismo nombre.
    if (error instanceof UsernameTakenError) {
      return err(error)
    }
    throw error
  }

  // RF‑6: queda con la sesión iniciada, sin pedir login de nuevo.
  const session = await deps.sessions.issue(account.id)
  return ok({ account, session })
}
