import { describe, expect, it } from 'vitest'
import {
  AuthError,
  InvalidInputError,
  UserNotFoundError,
  UsernameTakenError,
  WrongPasswordError,
  assertNever,
  isAuthError,
  type AnyAuthError,
} from './errors'

// Consumidor exhaustivo: si se añade una variante de AuthError sin su `case`,
// este archivo deja de compilar (constitución P5, "Hecho cuando" de T6).
function describeError(err: AnyAuthError): string {
  switch (err.kind) {
    case 'InvalidInput':
      return `campos:${err.issues.map((i) => `${i.field}/${i.code}`).join(',')}`
    case 'UsernameTaken':
      return `tomado:${err.username}`
    case 'UserNotFound':
      return `sin-cuenta:${err.username}`
    case 'WrongPassword':
      return 'password'
    default:
      return assertNever(err)
  }
}

describe('AuthError', () => {
  it('InvalidInputError lleva kind, name y las incidencias', () => {
    const err = new InvalidInputError([
      { field: 'username', code: 'too_short' },
      { field: 'role', code: 'required' },
    ])
    expect(err.kind).toBe('InvalidInput')
    expect(err.name).toBe('InvalidInputError')
    expect(err).toBeInstanceOf(AuthError)
    expect(err).toBeInstanceOf(Error)
    expect(err.issues).toEqual([
      { field: 'username', code: 'too_short' },
      { field: 'role', code: 'required' },
    ])
  })

  it('UsernameTakenError y UserNotFoundError llevan el username', () => {
    expect(new UsernameTakenError('ana').username).toBe('ana')
    expect(new UsernameTakenError('ana').kind).toBe('UsernameTaken')
    expect(new UserNotFoundError('ana').username).toBe('ana')
    expect(new UserNotFoundError('ana').kind).toBe('UserNotFound')
  })

  it('WrongPasswordError no expone ningún dato', () => {
    const err = new WrongPasswordError()
    expect(err.kind).toBe('WrongPassword')
    expect(err).not.toHaveProperty('username')
    expect(err).not.toHaveProperty('password')
  })

  it('isAuthError distingue errores del dominio de otros valores', () => {
    expect(isAuthError(new WrongPasswordError())).toBe(true)
    expect(isAuthError(new InvalidInputError([]))).toBe(true)
    expect(isAuthError(new Error('otro'))).toBe(false)
    expect(isAuthError({ kind: 'WrongPassword' })).toBe(false)
    expect(isAuthError(null)).toBe(false)
  })

  it('un switch exhaustivo cubre las cuatro variantes', () => {
    expect(
      describeError(new InvalidInputError([{ field: 'password', code: 'too_short' }])),
    ).toBe('campos:password/too_short')
    expect(describeError(new UsernameTakenError('ana'))).toBe('tomado:ana')
    expect(describeError(new UserNotFoundError('ana'))).toBe('sin-cuenta:ana')
    expect(describeError(new WrongPasswordError())).toBe('password')
  })

  it('assertNever lanza si llega a ejecutarse', () => {
    expect(() => assertNever('inesperado' as never)).toThrow(/unhandled AuthError/)
  })
})
