import type { Account } from './account'
import { parseLoginInput } from './credentials'
import { UserNotFoundError, WrongPasswordError, type InvalidInputError } from './errors'
import type { AccountRepository, PasswordHasher, SessionStore } from './ports'
import { err, ok, type Result } from './result'
import type { Session } from './session'

/**
 * Caso de uso de login (constitución P3: orquestación pura). Cubre RF‑10…RF‑13
 * y RF‑17 (la validación se aplica aquí, con independencia del formulario).
 */

export interface AuthenticateInput {
  username?: unknown
  password?: unknown
}

export interface AuthenticateDeps {
  accounts: AccountRepository
  hasher: PasswordHasher
  sessions: SessionStore
}

export interface AuthenticateSuccess {
  account: Account
  session: Session
}

export type AuthenticateError = InvalidInputError | UserNotFoundError | WrongPasswordError

export async function authenticateUser(
  input: AuthenticateInput,
  deps: AuthenticateDeps,
): Promise<Result<AuthenticateSuccess, AuthenticateError>> {
  // RF‑13, RF‑17: mínimos de usuario y contraseña antes de consultar credenciales.
  const parsed = parseLoginInput(input)
  if (!parsed.ok) {
    return parsed
  }
  const login = parsed.value

  // RF‑11: mensaje específico "no existe una cuenta con ese usuario".
  const account = await deps.accounts.findByNormalizedUsername(login.usernameNormalized)
  if (!account) {
    return err(new UserNotFoundError(login.username))
  }

  // RF‑12: sólo se compara el hash si la cuenta existe.
  const matches = await deps.hasher.verify(login.password, account.passwordHash)
  if (!matches) {
    return err(new WrongPasswordError())
  }

  // RF‑10: sesión iniciada; entra a su espacio según el rol.
  const session = await deps.sessions.issue(account.id)
  return ok({ account, session })
}
