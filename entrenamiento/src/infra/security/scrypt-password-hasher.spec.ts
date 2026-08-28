import { describe, expect, it } from 'vitest'
import { PASSWORD_HASH_PREFIX } from '@/domain/auth/account'
import { scryptPasswordHasher } from './scrypt-password-hasher'

const { hash, verify } = scryptPasswordHasher

describe('scryptPasswordHasher', () => {
  it('verify acepta la contraseña correcta', async () => {
    const stored = await hash('clave-larga-1')
    expect(await verify('clave-larga-1', stored)).toBe(true)
  })

  it('verify rechaza una contraseña distinta', async () => {
    const stored = await hash('clave-larga-1')
    expect(await verify('otra-clave-2', stored)).toBe(false)
  })

  it('produce el formato scrypt$N$r$p$salt$hash', async () => {
    const stored = await hash('clave-larga-1')
    expect(stored.startsWith(PASSWORD_HASH_PREFIX)).toBe(true)
    expect(stored).toMatch(/^scrypt\$16384\$8\$1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/)
  })

  it('usa una sal distinta en cada llamada', async () => {
    const a = await hash('clave-larga-1')
    const b = await hash('clave-larga-1')
    expect(a).not.toBe(b)
    // ambos siguen validando la misma contraseña
    expect(await verify('clave-larga-1', a)).toBe(true)
    expect(await verify('clave-larga-1', b)).toBe(true)
  })

  it('verify devuelve false ante un hash malformado, sin lanzar', async () => {
    expect(await verify('x', 'texto-plano')).toBe(false)
    expect(await verify('x', 'scrypt$mal')).toBe(false)
    expect(await verify('x', 'scrypt$16384$8$1$$')).toBe(false)
    expect(await verify('x', '')).toBe(false)
  })

  it('un hash de una contraseña no valida otra (aislamiento por sal)', async () => {
    const stored = await hash('primera-clave-1')
    expect(await verify('segunda-clave-2', stored)).toBe(false)
  })
})
