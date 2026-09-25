import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { ExerciseInUseError, ExerciseNotFoundError } from './errors'
import { exercise } from './exercise'
import type { ExerciseRepository, RoutineRepository } from './ports'
import { deleteExercise } from './delete-exercise'

const D = new Date('2026-08-01T00:00:00.000Z')
const existing = exercise({
  id: 'ex_1',
  trainerId: 't_1',
  name: 'Sentadilla',
  nameNormalized: 'sentadilla',
  createdAt: D,
  updatedAt: D,
})

function makeDeps(over: { inUse?: boolean } = {}) {
  const exercises: ExerciseRepository = {
    insert: vi.fn(async (d) => exercise({ id: 'x', ...d })),
    findById: vi.fn(async (trainerId: string, id: string) =>
      trainerId === existing.trainerId && id === existing.id ? existing : null,
    ),
    listByTrainer: vi.fn(async () => []),
    update: vi.fn(async (e) => e),
    deleteById: vi.fn(async () => {}),
  }
  const routines: RoutineRepository = {
    insert: vi.fn(async () => {
      throw new Error('no usado')
    }),
    findById: vi.fn(async () => null),
    listByTrainer: vi.fn(async () => []),
    update: vi.fn(async (r) => r),
    deleteById: vi.fn(async () => {}),
    anyUsesExercise: vi.fn(async () => over.inUse ?? false),
  }
  return { exercises, routines }
}

describe('deleteExercise (RF-2, RF-8)', () => {
  it('borra el ejercicio si ninguna rutina lo usa', async () => {
    const deps = makeDeps({ inUse: false })
    const r = await deleteExercise({ trainerId: 't_1', id: 'ex_1' }, deps)

    expect(r.ok).toBe(true)
    expect(deps.routines.anyUsesExercise).toHaveBeenCalledWith('t_1', 'ex_1')
    expect(deps.exercises.deleteById).toHaveBeenCalledWith('t_1', 'ex_1')
  })

  it('ejercicio en uso por una rutina → ExerciseInUseError, sin borrar (RF-8)', async () => {
    const deps = makeDeps({ inUse: true })
    const r = await deleteExercise({ trainerId: 't_1', id: 'ex_1' }, deps)

    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(ExerciseInUseError)
    expect(deps.exercises.deleteById).not.toHaveBeenCalled()
  })

  it('ejercicio de otro entrenador → ExerciseNotFoundError, sin consultar uso (RF-2)', async () => {
    const deps = makeDeps()
    const r = await deleteExercise({ trainerId: 't_2', id: 'ex_1' }, deps)

    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(ExerciseNotFoundError)
    expect(deps.routines.anyUsesExercise).not.toHaveBeenCalled()
    expect(deps.exercises.deleteById).not.toHaveBeenCalled()
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./delete-exercise.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
