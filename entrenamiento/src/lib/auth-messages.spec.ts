import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  InvalidInputError,
  UserNotFoundError,
  UsernameTakenError,
  WrongPasswordError,
} from '@/domain/auth/errors'
import { AUTH_MESSAGES, messageForAuthError } from './auth-messages'

const SRC = fileURLToPath(new URL('..', import.meta.url))

const EXACT = [
  'ese nombre de usuario ya está en uso',
  'no existe una cuenta con ese usuario',
  'contraseña incorrecta',
]

describe('AUTH_MESSAGES', () => {
  it('contiene los textos exactos de la spec', () => {
    expect(AUTH_MESSAGES.usernameTaken).toBe(EXACT[0])
    expect(AUTH_MESSAGES.userNotFound).toBe(EXACT[1])
    expect(AUTH_MESSAGES.wrongPassword).toBe(EXACT[2])
  })
})

describe('messageForAuthError', () => {
  it('mapea cada error del dominio a su mensaje', () => {
    expect(messageForAuthError(new UsernameTakenError('ana'))).toBe(EXACT[0])
    expect(messageForAuthError(new UserNotFoundError('ana'))).toBe(EXACT[1])
    expect(messageForAuthError(new WrongPasswordError())).toBe(EXACT[2])
    expect(messageForAuthError(new InvalidInputError([]))).toBe(AUTH_MESSAGES.invalidInput)
  })
})

describe('los handlers y el middleware no hardcodean la copia (T21)', () => {
  const files = [
    'app/api/auth/register/route.ts',
    'app/api/auth/login/route.ts',
    'app/api/auth/logout/route.ts',
    'app/api/auth/session/route.ts',
    'middleware.ts',
  ]

  it('ninguno contiene los textos exactos', () => {
    for (const rel of files) {
      const src = readFileSync(join(SRC, rel), 'utf8')
      for (const text of EXACT) {
        expect(src, `${rel} contiene "${text}"`).not.toContain(text)
      }
    }
  })
})
