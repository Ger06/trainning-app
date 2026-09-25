import { assertNever, type AnyAuthError } from '@/domain/auth/errors'

/**
 * T21 · Único módulo con la copia que ve la persona. Los route handlers y el
 * middleware no llevan literales de estos textos.
 *
 * `[NECESITA ACLARACIÓN]` (spec.md): idioma de los mensajes (el repo tiene
 * es/en). Provisional: español.
 */
export const AUTH_MESSAGES = {
  usernameTaken: 'ese nombre de usuario ya está en uso',
  userNotFound: 'no existe una cuenta con ese usuario',
  wrongPassword: 'contraseña incorrecta',
  invalidInput: 'revisá los datos ingresados',
  noSession: 'no hay una sesión activa',
} as const

export function messageForAuthError(error: AnyAuthError): string {
  switch (error.kind) {
    case 'UsernameTaken':
      return AUTH_MESSAGES.usernameTaken
    case 'UserNotFound':
      return AUTH_MESSAGES.userNotFound
    case 'WrongPassword':
      return AUTH_MESSAGES.wrongPassword
    case 'InvalidInput':
      return AUTH_MESSAGES.invalidInput
    default:
      return assertNever(error)
  }
}
