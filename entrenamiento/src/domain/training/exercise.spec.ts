import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { exercise, newExercise } from './exercise'

const base = {
  trainerId: 't_1',
  name: 'Sentadilla',
  nameNormalized: 'sentadilla',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
}

describe('newExercise (RF-4, RF-5)', () => {
  it('construye los datos de alta sin id', () => {
    const ex = newExercise(base)
    expect(ex).toEqual(base)
    expect(ex).not.toHaveProperty('id')
  })

  it('acepta descripción opcional y la omite si no viene (RF-4)', () => {
    expect(newExercise({ ...base, description: 'de pie, barra alta' }).description).toBe(
      'de pie, barra alta',
    )
    expect(Object.keys(newExercise(base))).not.toContain('description')
  })

  it('rechaza un nombre de menos de 2 caracteres tras trim (RF-4)', () => {
    expect(() => newExercise({ ...base, name: 'S' })).toThrow()
    expect(() => newExercise({ ...base, name: '  ' })).toThrow()
  })

  it('descarta cualquier campo de prescripción que se cuele (RF-5)', () => {
    // @ts-expect-error el tipo de ejercicio no admite `sets` / `reps`
    const ex = newExercise({ ...base, sets: 3, reps: 10 })
    expect(ex).not.toHaveProperty('sets')
    expect(ex).not.toHaveProperty('reps')
  })

  it('devuelve el objeto congelado', () => {
    expect(Object.isFrozen(newExercise(base))).toBe(true)
  })
})

describe('exercise (RF-4)', () => {
  it('reconstruye un ejercicio con id y congelado', () => {
    const ex = exercise({ id: 'ex_1', ...base })
    expect(ex).toEqual({ id: 'ex_1', ...base })
    expect(Object.isFrozen(ex)).toBe(true)
  })

  it('rechaza nombre corto también al reconstruir (RF-4)', () => {
    expect(() => exercise({ id: 'ex_1', ...base, name: 'x' })).toThrow()
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./exercise.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
