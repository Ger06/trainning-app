import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PASSWORD_HASH_PREFIX, account, newAccount } from './account'

const base = {
  username: 'Ana',
  usernameNormalized: 'ana',
  role: 'entrenador' as const,
  passwordHash: `${PASSWORD_HASH_PREFIX}16384$8$1$c2FsdHNhbHQ$aGFzaGhhc2g`,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
}

describe('newAccount', () => {
  it('construye los datos de alta sin id ni password', () => {
    const acc = newAccount(base)
    expect(acc).toEqual(base)
    expect(acc).not.toHaveProperty('id')
    expect(acc).not.toHaveProperty('password')
  })

  it('rechaza un passwordHash sin prefijo scrypt$ (RF-8)', () => {
    expect(() => newAccount({ ...base, passwordHash: 'plaintext123' })).toThrow()
  })

  it('rechaza un passwordHash vacío (RF-8)', () => {
    expect(() => newAccount({ ...base, passwordHash: '' })).toThrow()
  })
})

describe('account', () => {
  it('reconstruye una cuenta con id y los cinco campos', () => {
    expect(account({ id: 'acc_1', ...base })).toEqual({ id: 'acc_1', ...base })
  })

  it('no tiene campo password y sí passwordHash (RF-8)', () => {
    const acc = account({ id: 'acc_1', ...base })
    expect(Object.keys(acc)).not.toContain('password')
    expect(Object.keys(acc).sort()).toEqual(
      ['createdAt', 'id', 'passwordHash', 'role', 'username', 'usernameNormalized'].sort(),
    )
  })

  it('role es de sólo lectura en tipos y en runtime (RF-7)', () => {
    const acc = account({ id: 'acc_1', ...base })
    expect(() => {
      // @ts-expect-error role es readonly: no hay setter ni withRole
      acc.role = 'alumno'
    }).toThrow(TypeError)
    expect(acc.role).toBe('entrenador')
  })

  it('devuelve el objeto congelado', () => {
    expect(Object.isFrozen(account({ id: 'acc_1', ...base }))).toBe(true)
    expect(Object.isFrozen(newAccount(base))).toBe(true)
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./account.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
