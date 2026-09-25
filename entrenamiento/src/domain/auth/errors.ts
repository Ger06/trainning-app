/**
 * Errores del dominio de autenticación (constitución P3: módulo puro, sin React,
 * sin red y sin driver de BD). Son clases con una etiqueta `kind`, así sirven
 * tanto para `throw` / `instanceof` como para un `switch` exhaustivo sobre el
 * discriminante.
 *
 * Los textos de `Error.message` son internos (logs y depuración). La copia que
 * ve la persona vive en el módulo de mensajes (T21) — idioma `[NECESITA
 * ACLARACIÓN]` en spec.md.
 */

export type AuthErrorKind =
  | 'InvalidInput'
  | 'UsernameTaken'
  | 'UserNotFound'
  | 'WrongPassword'

export type CredentialField = 'username' | 'password' | 'role'

export type InvalidInputCode = 'required' | 'too_short' | 'invalid_value'

export interface InvalidInputIssue {
  readonly field: CredentialField
  readonly code: InvalidInputCode
}

export abstract class AuthError extends Error {
  abstract readonly kind: AuthErrorKind

  protected constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

/** RF‑2, RF‑3, RF‑4, RF‑13: uno o más campos no cumplen las reglas. */
export class InvalidInputError extends AuthError {
  readonly kind = 'InvalidInput' as const

  constructor(readonly issues: readonly InvalidInputIssue[]) {
    super(`invalid input (${issues.map((i) => `${i.field}:${i.code}`).join(', ')})`)
  }
}

/** RF‑5: el nombre de usuario ya está registrado. */
export class UsernameTakenError extends AuthError {
  readonly kind = 'UsernameTaken' as const

  constructor(readonly username: string) {
    super('username already registered')
  }
}

/** RF‑11: no hay ninguna cuenta con ese nombre de usuario. */
export class UserNotFoundError extends AuthError {
  readonly kind = 'UserNotFound' as const

  constructor(readonly username: string) {
    super('username not registered')
  }
}

/** RF‑12: la cuenta existe pero la contraseña no coincide. */
export class WrongPasswordError extends AuthError {
  readonly kind = 'WrongPassword' as const

  constructor() {
    super('password does not match')
  }
}

export type AnyAuthError =
  | InvalidInputError
  | UsernameTakenError
  | UserNotFoundError
  | WrongPasswordError

export function isAuthError(value: unknown): value is AnyAuthError {
  return value instanceof AuthError
}

/** Fuerza la exhaustividad de un `switch` sobre `AnyAuthError`. */
export function assertNever(value: never): never {
  throw new Error(`unhandled AuthError variant: ${String(value)}`)
}
