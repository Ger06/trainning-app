import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { InvalidInputError } from './errors'
import {
  normalizeUsername,
  parseCredentials,
  parseLoginInput,
  parsePassword,
  parseRole,
  parseUsername,
} from './credentials'

describe('parseUsername (RF-3)', () => {
  it('rechaza 1 carácter como too_short', () => {
    const r = parseUsername('a')
    expect(r).toEqual({ ok: false, error: { field: 'username', code: 'too_short' } })
  })

  it('acepta 2 caracteres y devuelve el valor recortado', () => {
    expect(parseUsername('ab')).toEqual({ ok: true, value: 'ab' })
    expect(parseUsername('  ab  ')).toEqual({ ok: true, value: 'ab' })
  })

  it('trata la entrada de sólo espacios como required', () => {
    expect(parseUsername('   ')).toEqual({ ok: false, error: { field: 'username', code: 'required' } })
  })

  it('trata la ausencia o un no-string como required', () => {
    expect(parseUsername(undefined)).toEqual({
      ok: false,
      error: { field: 'username', code: 'required' },
    })
    expect(parseUsername(123)).toEqual({
      ok: false,
      error: { field: 'username', code: 'required' },
    })
  })
})

describe('parsePassword (RF-4)', () => {
  it('rechaza 7 caracteres como too_short', () => {
    expect(parsePassword('abcdefg')).toEqual({
      ok: false,
      error: { field: 'password', code: 'too_short' },
    })
  })

  it('acepta 8 caracteres y conserva el valor tal cual', () => {
    expect(parsePassword('abcdefgh')).toEqual({ ok: true, value: 'abcdefgh' })
    expect(parsePassword('  hunter22  ')).toEqual({ ok: true, value: '  hunter22  ' })
  })

  it('trata una contraseña de sólo espacios como required', () => {
    expect(parsePassword('        ')).toEqual({
      ok: false,
      error: { field: 'password', code: 'required' },
    })
  })

  it('trata la ausencia o un no-string como required', () => {
    expect(parsePassword(undefined)).toEqual({
      ok: false,
      error: { field: 'password', code: 'required' },
    })
  })
})

describe('parseRole (RF-2)', () => {
  it('acepta los dos valores válidos', () => {
    expect(parseRole('entrenador')).toEqual({ ok: true, value: 'entrenador' })
    expect(parseRole('alumno')).toEqual({ ok: true, value: 'alumno' })
  })

  it('trata la ausencia (sin valor por defecto) como required', () => {
    expect(parseRole(undefined)).toEqual({ ok: false, error: { field: 'role', code: 'required' } })
    expect(parseRole(null)).toEqual({ ok: false, error: { field: 'role', code: 'required' } })
    expect(parseRole('')).toEqual({ ok: false, error: { field: 'role', code: 'required' } })
  })

  it('rechaza un valor fuera del enum como invalid_value', () => {
    expect(parseRole('admin')).toEqual({ ok: false, error: { field: 'role', code: 'invalid_value' } })
    expect(parseRole(1)).toEqual({ ok: false, error: { field: 'role', code: 'invalid_value' } })
  })
})

describe('normalizeUsername', () => {
  it('recorta y pasa a minúsculas', () => {
    expect(normalizeUsername('  Ana  ')).toBe('ana')
  })

  it('es idempotente', () => {
    const once = normalizeUsername('  AnA  ')
    expect(normalizeUsername(once)).toBe(once)
    expect(once).toBe('ana')
  })
})

describe('parseCredentials (registro, RF-13 acumula incidencias)', () => {
  it('valida el caso correcto y añade usernameNormalized', () => {
    const r = parseCredentials({ username: '  Ana ', password: 'abcdefgh', role: 'alumno' })
    expect(r).toEqual({
      ok: true,
      value: {
        username: 'Ana',
        usernameNormalized: 'ana',
        password: 'abcdefgh',
        role: 'alumno',
      },
    })
  })

  it('acumula TODAS las incidencias en un solo InvalidInputError', () => {
    const r = parseCredentials({ username: 'a', password: 'x', role: undefined })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(InvalidInputError)
    expect(r.error.issues).toEqual([
      { field: 'username', code: 'too_short' },
      { field: 'password', code: 'too_short' },
      { field: 'role', code: 'required' },
    ])
  })

  it('conserva la contraseña con espacios internos sin recortar', () => {
    const r = parseCredentials({ username: 'ab', password: '  hunter22  ', role: 'entrenador' })
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('debía valer')
    expect(r.value.password).toBe('  hunter22  ')
  })
})

describe('parseLoginInput (login, sin rol)', () => {
  it('valida usuario y contraseña y normaliza', () => {
    const r = parseLoginInput({ username: 'Ana', password: 'abcdefgh' })
    expect(r).toEqual({
      ok: true,
      value: { username: 'Ana', usernameNormalized: 'ana', password: 'abcdefgh' },
    })
  })

  it('acumula incidencias de ambos campos', () => {
    const r = parseLoginInput({ username: '', password: 'short' })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error.issues).toEqual([
      { field: 'username', code: 'required' },
      { field: 'password', code: 'too_short' },
    ])
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./credentials.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
