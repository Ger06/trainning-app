import { describe, expect, it } from 'vitest'
import { PROTECTED_PREFIXES, config, isProtected } from './middleware'

describe('isProtected', () => {
  const prefixes = ['/api/auth/session', '/app']

  it('marca como protegida una ruta exacta o descendiente de un prefijo', () => {
    expect(isProtected('/api/auth/session', prefixes)).toBe(true)
    expect(isProtected('/api/auth/session/', prefixes)).toBe(true)
    expect(isProtected('/app', prefixes)).toBe(true)
    expect(isProtected('/app/rutinas/1', prefixes)).toBe(true)
  })

  it('no marca rutas fuera de los prefijos', () => {
    expect(isProtected('/', prefixes)).toBe(false)
    expect(isProtected('/login', prefixes)).toBe(false)
    expect(isProtected('/api/auth/login', prefixes)).toBe(false)
    expect(isProtected('/application', prefixes)).toBe(false) // prefijo parcial, no descendiente
  })

  it('por defecto protege la sonda de sesión', () => {
    expect(PROTECTED_PREFIXES).toContain('/api/auth/session')
    expect(isProtected('/api/auth/session')).toBe(true)
    expect(isProtected('/api/auth/login')).toBe(false)
  })

  it('protege las APIs y páginas de entrenamiento de la spec 002 (RF-1)', () => {
    const prefixes = [
      '/api/exercises',
      '/api/routines',
      '/api/assignments',
      '/exercises',
      '/routines',
      '/assign',
    ]
    for (const p of prefixes) {
      expect(PROTECTED_PREFIXES, `falta ${p}`).toContain(p)
      expect(isProtected(p)).toBe(true)
      expect(isProtected(`${p}/abc123`)).toBe(true)
      // el matcher estático debe listar cada prefijo (exacto + descendientes)
      expect(config.matcher).toEqual(expect.arrayContaining([p, `${p}/:path*`]))
    }
  })
})
