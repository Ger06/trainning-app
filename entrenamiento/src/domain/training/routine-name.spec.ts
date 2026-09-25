import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { normalizeRoutineName } from './routine-name'

describe('normalizeRoutineName (RF-16)', () => {
  it('recorta, colapsa espacios internos y pasa a minúsculas', () => {
    expect(normalizeRoutineName('  Full  Body  A ')).toBe('full body a')
  })

  it('colapsa tabuladores y saltos de línea', () => {
    expect(normalizeRoutineName('Fuerza\tSemana\n1')).toBe('fuerza semana 1')
  })

  it('es idempotente', () => {
    const once = normalizeRoutineName('  Full  BODY  A ')
    expect(normalizeRoutineName(once)).toBe(once)
  })

  it('deja intacto un nombre ya normalizado', () => {
    expect(normalizeRoutineName('empuje a')).toBe('empuje a')
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./routine-name.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
