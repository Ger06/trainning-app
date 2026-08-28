import {
  InvalidInputError,
  type CredentialField,
  type InvalidInputCode,
  type InvalidInputIssue,
} from './errors'
import { err, ok, type Result } from './result'

/**
 * Validación pura de credenciales (constitución P3: sin React, sin red, sin
 * `mongodb`). Reglas escritas a mano, sin librería de validación (D7 del plan).
 * El servidor es la autoridad (RF‑17); el formulario sólo replica estas reglas.
 */

export type Role = 'entrenador' | 'alumno'
export const ROLES: readonly Role[] = ['entrenador', 'alumno']

export interface Credentials {
  readonly username: string
  readonly usernameNormalized: string
  readonly password: string
  readonly role: Role
}

export interface LoginInput {
  readonly username: string
  readonly usernameNormalized: string
  readonly password: string
}

const issue = (field: CredentialField, code: InvalidInputCode): InvalidInputIssue => ({
  field,
  code,
})

/**
 * `[NECESITA ACLARACIÓN]` (spec.md): regla definitiva de normalización —
 * mayúsculas/minúsculas, acentos, charset. Provisional: `trim` + `toLowerCase`.
 * Punto único de cambio: el índice único de `accounts` (RF‑5) se apoya en su
 * salida, así que un cambio de regla implica una migración de re-cálculo.
 */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

/** RF‑3: nombre de usuario obligatorio, mínimo 2 caracteres (tras `trim`). */
export function parseUsername(input: unknown): Result<string, InvalidInputIssue> {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return err(issue('username', 'required'))
  }
  const value = input.trim()
  if (value.length < 2) {
    return err(issue('username', 'too_short'))
  }
  return ok(value)
}

/** RF‑4: contraseña obligatoria, mínimo 8 caracteres. */
export function parsePassword(input: unknown): Result<string, InvalidInputIssue> {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return err(issue('password', 'required'))
  }
  // `[NECESITA ACLARACIÓN]` (spec.md): ¿recortar espacios extremos?, ¿complejidad?
  // Provisional: se conserva tal cual; la longitud se cuenta en bruto.
  if (input.length < 8) {
    return err(issue('password', 'too_short'))
  }
  return ok(input)
}

/** RF‑2: rol obligatorio y sin valor por defecto; exactamente uno del enum. */
export function parseRole(input: unknown): Result<Role, InvalidInputIssue> {
  if (input === undefined || input === null || input === '') {
    return err(issue('role', 'required'))
  }
  if (input === 'entrenador' || input === 'alumno') {
    return ok(input)
  }
  return err(issue('role', 'invalid_value'))
}

/** Valida el registro (RF‑1…RF‑4) acumulando TODAS las incidencias (RF‑13). */
export function parseCredentials(input: {
  username?: unknown
  password?: unknown
  role?: unknown
}): Result<Credentials, InvalidInputError> {
  const username = parseUsername(input.username)
  const password = parsePassword(input.password)
  const role = parseRole(input.role)

  const issues: InvalidInputIssue[] = []
  if (!username.ok) issues.push(username.error)
  if (!password.ok) issues.push(password.error)
  if (!role.ok) issues.push(role.error)

  if (!username.ok || !password.ok || !role.ok) {
    return err(new InvalidInputError(issues))
  }

  return ok({
    username: username.value,
    usernameNormalized: normalizeUsername(username.value),
    password: password.value,
    role: role.value,
  })
}

/** Valida el login (RF‑9, RF‑13): usuario y contraseña, sin rol. */
export function parseLoginInput(input: {
  username?: unknown
  password?: unknown
}): Result<LoginInput, InvalidInputError> {
  const username = parseUsername(input.username)
  const password = parsePassword(input.password)

  const issues: InvalidInputIssue[] = []
  if (!username.ok) issues.push(username.error)
  if (!password.ok) issues.push(password.error)

  if (!username.ok || !password.ok) {
    return err(new InvalidInputError(issues))
  }

  return ok({
    username: username.value,
    usernameNormalized: normalizeUsername(username.value),
    password: password.value,
  })
}
