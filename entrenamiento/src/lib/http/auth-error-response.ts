import type { AnyAuthError } from '@/domain/auth/errors'
import { messageForAuthError } from '@/lib/auth-messages'
import { problem } from './problem'

/** Traduce un error del dominio de autenticación a status + cuerpo `problem`. */
const MAP: Record<AnyAuthError['kind'], { status: number; code: string }> = {
  InvalidInput: { status: 422, code: 'invalid_input' },
  UsernameTaken: { status: 409, code: 'username_taken' },
  UserNotFound: { status: 401, code: 'user_not_found' },
  WrongPassword: { status: 401, code: 'wrong_password' },
}

export function authErrorResponse(error: AnyAuthError): Response {
  const { status, code } = MAP[error.kind]
  return problem(status, {
    error: code,
    message: messageForAuthError(error),
    issues: error.kind === 'InvalidInput' ? error.issues : undefined,
  })
}
