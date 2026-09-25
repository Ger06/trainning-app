import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Block, BlockExercise } from './routine'
import { newRoutine, routine } from './routine'

const D = new Date('2026-01-01T00:00:00.000Z')

const be = (over: Partial<BlockExercise> = {}): BlockExercise => ({
  exerciseId: 'ex_1',
  sets: 3,
  reps: 10,
  restBetweenSetsSec: 90,
  restAfterExerciseSec: 0,
  ...over,
})

const block = (over: Partial<Block> = {}): Block => ({
  exercises: [be()],
  rounds: 1,
  restBetweenRoundsSec: 0,
  ...over,
})

const base = {
  trainerId: 't_1',
  name: 'Full A',
  nameNormalized: 'full a',
  blocks: [block()],
  createdAt: D,
  updatedAt: D,
}

describe('newRoutine (RF-10..RF-14, RF-13b)', () => {
  it('construye los datos de alta sin id', () => {
    const r = newRoutine(base)
    expect(r).toEqual(base)
    expect(r).not.toHaveProperty('id')
  })

  it('congela todos los niveles (rutina, blocks, bloque, exercises, ejercicio)', () => {
    const r = newRoutine(base)
    expect(Object.isFrozen(r)).toBe(true)
    expect(Object.isFrozen(r.blocks)).toBe(true)
    expect(Object.isFrozen(r.blocks[0])).toBe(true)
    expect(Object.isFrozen(r.blocks[0].exercises)).toBe(true)
    expect(Object.isFrozen(r.blocks[0].exercises[0])).toBe(true)
  })

  it('la nota es opcional', () => {
    expect(Object.keys(newRoutine(base))).not.toContain('note')
    expect(newRoutine({ ...base, note: 'día de piernas' }).note).toBe('día de piernas')
  })

  it('rechaza nombre de menos de 2 caracteres (RF-10)', () => {
    expect(() => newRoutine({ ...base, name: 'A' })).toThrow()
  })

  it('rechaza una rutina sin bloques y un bloque sin ejercicios (RF-15)', () => {
    expect(() => newRoutine({ ...base, blocks: [] })).toThrow()
    expect(() => newRoutine({ ...base, blocks: [block({ exercises: [] })] })).toThrow()
  })

  it('rechaza rondas < 1 y series < 1 (RF-12, RF-13)', () => {
    expect(() => newRoutine({ ...base, blocks: [block({ rounds: 0 })] })).toThrow()
    expect(() => newRoutine({ ...base, blocks: [block({ exercises: [be({ sets: 0 })] })] })).toThrow()
  })

  it('rechaza un ejercicio sin repeticiones ni tiempo (RF-13)', () => {
    const noWork = { exerciseId: 'ex_1', sets: 3, restBetweenSetsSec: 0, restAfterExerciseSec: 0 }
    expect(() => newRoutine({ ...base, blocks: [block({ exercises: [noWork] })] })).toThrow()
  })

  it('acepta repeticiones y tiempo a la vez (RF-13)', () => {
    const both = be({ reps: 8, timeSec: 30 })
    expect(() => newRoutine({ ...base, blocks: [block({ exercises: [both] })] })).not.toThrow()
  })

  it('acepta el mismo ejercicio repetido en un bloque (RF-14)', () => {
    const r = newRoutine({ ...base, blocks: [block({ exercises: [be(), be()] })] })
    expect(r.blocks[0].exercises).toHaveLength(2)
  })
})

describe('routine (RF-10)', () => {
  it('reconstruye una rutina con id y congelada', () => {
    const r = routine({ id: 'rt_1', ...base })
    expect(r).toEqual({ id: 'rt_1', ...base })
    expect(Object.isFrozen(r)).toBe(true)
    expect(Object.isFrozen(r.blocks[0])).toBe(true)
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./routine.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
