import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createExercise } from './create-exercise'
import { ExerciseNameTakenError, InvalidTrainingInputError } from './errors'
import { exercise, type Exercise, type NewExercise } from './exercise'
import type { Clock, ExerciseRepository } from './ports'

const NOW = new Date('2026-08-31T12:00:00.000Z')

function makeDeps(over: { insertImpl?: (d: NewExercise) => Promise<Exercise> } = {}) {
  const insertCalls: NewExercise[] = []
  const exercises: ExerciseRepository = {
    insert: vi.fn(async (data: NewExercise) => {
      insertCalls.push(data)
      return over.insertImpl ? over.insertImpl(data) : exercise({ id: 'ex_new', ...data })
    }),
    findById: vi.fn(async () => null),
    listByTrainer: vi.fn(async () => []),
    update: vi.fn(async (e) => e),
    deleteById: vi.fn(async () => {}),
  }
  const clock: Clock = { now: () => NOW }
  return { exercises, clock, insertCalls }
}

describe('createExercise (RF-4, RF-6)', () => {
  it('happy path: valida, normaliza e inserta con trainerId y timestamps', async () => {
    const deps = makeDeps()
    const r = await createExercise({ trainerId: 't_1', name: '  Sentadilla  ' }, deps)

    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('debía valer')
    expect(r.value.id).toBe('ex_new')
    expect(deps.insertCalls[0]).toMatchObject({
      trainerId: 't_1',
      name: 'Sentadilla',
      nameNormalized: 'sentadilla',
      createdAt: NOW,
      updatedAt: NOW,
    })
  })

  it('guarda la descripción cuando viene', async () => {
    const deps = makeDeps()
    await createExercise({ trainerId: 't_1', name: 'Peso muerto', description: 'convencional' }, deps)
    expect(deps.insertCalls[0]?.description).toBe('convencional')
  })

  it('nombre inválido → InvalidTrainingInputError, sin tocar el repo (RF-4)', async () => {
    const deps = makeDeps()
    const r = await createExercise({ trainerId: 't_1', name: 'S' }, deps)

    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(InvalidTrainingInputError)
    expect(deps.exercises.insert).not.toHaveBeenCalled()
  })

  it('nombre duplicado en el catálogo → ExerciseNameTakenError (RF-6)', async () => {
    const deps = makeDeps({
      insertImpl: async () => {
        throw new ExerciseNameTakenError('Sentadilla')
      },
    })
    const r = await createExercise({ trainerId: 't_1', name: 'Sentadilla' }, deps)

    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(ExerciseNameTakenError)
  })

  it('propaga un error inesperado del repo', async () => {
    const deps = makeDeps({
      insertImpl: async () => {
        throw new Error('mongo caído')
      },
    })
    await expect(
      createExercise({ trainerId: 't_1', name: 'Sentadilla' }, deps),
    ).rejects.toThrow('mongo caído')
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./create-exercise.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
