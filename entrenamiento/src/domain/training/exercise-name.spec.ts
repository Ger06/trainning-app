import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { normalizeExerciseName } from './exercise-name'

describe('normalizeExerciseName (RF-6)', () => {
  it('recorta, colapsa espacios internos y pasa a minúsculas', () => {
    expect(normalizeExerciseName('  Press  Banca ')).toBe('press banca')
  })

  it('colapsa tabuladores y saltos de línea', () => {
    expect(normalizeExerciseName('Peso\tMuerto\n Rumano')).toBe('peso muerto rumano')
  })

  it('es idempotente', () => {
    const once = normalizeExerciseName('  Press  BANCA ')
    expect(normalizeExerciseName(once)).toBe(once)
  })

  it('deja intacto un nombre ya normalizado', () => {
    expect(normalizeExerciseName('sentadilla frontal')).toBe('sentadilla frontal')
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./exercise-name.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
