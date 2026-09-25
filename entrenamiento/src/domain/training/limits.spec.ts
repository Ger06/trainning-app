import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  MAX_BLOCKS,
  MAX_DESCRIPTION_LENGTH,
  MAX_EXERCISE_NOTE_LENGTH,
  MAX_EXERCISES_PER_BLOCK,
  MAX_NAME_LENGTH,
  MAX_REPS,
  MAX_ROUNDS,
  MAX_SECONDS,
  MAX_SETS,
  MAX_WEEK,
} from './limits'

const ALL = {
  MAX_BLOCKS,
  MAX_EXERCISES_PER_BLOCK,
  MAX_SETS,
  MAX_ROUNDS,
  MAX_REPS,
  MAX_SECONDS,
  MAX_WEEK,
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_EXERCISE_NOTE_LENGTH,
}

describe('limits · topes provisionales (T2, D13)', () => {
  it('cada tope es un entero positivo', () => {
    for (const [name, value] of Object.entries(ALL)) {
      expect(Number.isInteger(value), `${name} debe ser entero`).toBe(true)
      expect(value, `${name} debe ser > 0`).toBeGreaterThan(0)
    }
  })

  it('fija los valores documentados en plan.md (D13)', () => {
    expect(MAX_WEEK).toBe(104)
    expect(MAX_NAME_LENGTH).toBe(120)
    expect(MAX_DESCRIPTION_LENGTH).toBe(2000)
    expect(MAX_EXERCISE_NOTE_LENGTH).toBe(500)
  })

  it('la nota corta de ejercicio es más breve que la descripción/nota larga', () => {
    expect(MAX_EXERCISE_NOTE_LENGTH).toBeLessThan(MAX_DESCRIPTION_LENGTH)
  })

  it('los topes de rango numérico caben en un entero de 32 bits', () => {
    for (const name of [
      'MAX_BLOCKS',
      'MAX_EXERCISES_PER_BLOCK',
      'MAX_SETS',
      'MAX_ROUNDS',
      'MAX_REPS',
      'MAX_SECONDS',
    ] as const) {
      expect(ALL[name]).toBeLessThanOrEqual(2_147_483_647)
    }
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./limits.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
