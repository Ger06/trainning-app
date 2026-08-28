import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ROLES } from './credentials'
import { landingPathForRole } from './landing-path'

describe('landingPathForRole (RF-6, RF-10)', () => {
  it('lleva al entrenador a su ruta', () => {
    expect(landingPathForRole('entrenador')).toBe('/')
  })

  it('lleva al alumno a su ruta', () => {
    expect(landingPathForRole('alumno')).toBe('/')
  })

  it('devuelve una ruta absoluta no vacía para todo rol', () => {
    for (const role of ROLES) {
      const path = landingPathForRole(role)
      expect(path.startsWith('/')).toBe(true)
      expect(path.length).toBeGreaterThan(0)
    }
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./landing-path.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
