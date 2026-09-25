import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { ExerciseNotFoundError, InvalidTrainingInputError, RoutineNotFoundError } from './errors'
import { exercise } from './exercise'
import type { Clock, ExerciseRepository, RoutineRepository } from './ports'
import { routine } from './routine'
import { updateRoutine } from './update-routine'

const NOW = new Date('2026-09-01T09:00:00.000Z')
const CREATED = new Date('2026-08-01T00:00:00.000Z')

const existing = routine({
  id: 'rt_1',
  trainerId: 't_1',
  name: 'Full A',
  nameNormalized: 'full a',
  blocks: [
    {
      exercises: [{ exerciseId: 'ex_1', sets: 3, reps: 10, restBetweenSetsSec: 0, restAfterExerciseSec: 0 }],
      rounds: 1,
      restBetweenRoundsSec: 0,
    },
  ],
  createdAt: CREATED,
  updatedAt: CREATED,
})

const catalog: Record<string, boolean> = { ex_1: true, ex_2: true }

function makeDeps() {
  const routines: RoutineRepository = {
    insert: vi.fn(async (d) => routine({ id: 'x', ...d })),
    findById: vi.fn(async (trainerId: string, id: string) =>
      trainerId === existing.trainerId && id === existing.id ? existing : null,
    ),
    listByTrainer: vi.fn(async () => []),
    update: vi.fn(async (r) => r),
    deleteById: vi.fn(async () => {}),
    anyUsesExercise: vi.fn(async () => false),
  }
  const exercises: ExerciseRepository = {
    insert: vi.fn(async (d) => exercise({ id: 'x', ...d })),
    findById: vi.fn(async (trainerId: string, id: string) =>
      trainerId === 't_1' && catalog[id]
        ? exercise({ id, trainerId, name: id, nameNormalized: id, createdAt: CREATED, updatedAt: CREATED })
        : null,
    ),
    listByTrainer: vi.fn(async () => []),
    update: vi.fn(async (e) => e),
    deleteById: vi.fn(async () => {}),
  }
  const clock: Clock = { now: () => NOW }
  return { routines, exercises, clock }
}

const patch = (over: Record<string, unknown> = {}) => ({
  trainerId: 't_1',
  id: 'rt_1',
  name: 'Full A v2',
  blocks: [{ exercises: [{ exerciseId: 'ex_2', sets: 4, reps: 8 }], rounds: 3, restBetweenRoundsSec: 90 }],
  ...over,
})

describe('updateRoutine (RF-2, RF-17)', () => {
  it('sustituye bloques y nombre de una rutina propia; conserva createdAt, mueve updatedAt', async () => {
    const deps = makeDeps()
    const r = await updateRoutine(patch(), deps)

    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('debía valer')
    expect(deps.routines.update).toHaveBeenCalledTimes(1)
    expect(r.value).toMatchObject({
      id: 'rt_1',
      name: 'Full A v2',
      nameNormalized: 'full a v2',
      createdAt: CREATED,
      updatedAt: NOW,
    })
    expect(r.value.blocks[0].exercises[0].exerciseId).toBe('ex_2')
    expect(r.value.blocks[0].rounds).toBe(3)
  })

  it('rutina de otro entrenador → RoutineNotFoundError, sin escribir (RF-2)', async () => {
    const deps = makeDeps()
    const r = await updateRoutine(patch({ trainerId: 't_2' }), deps)

    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(RoutineNotFoundError)
    expect(deps.routines.update).not.toHaveBeenCalled()
  })

  it('borrador inválido → InvalidTrainingInputError sin buscar la rutina (RF-3)', async () => {
    const deps = makeDeps()
    const r = await updateRoutine(patch({ blocks: [] }), deps)

    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(InvalidTrainingInputError)
    expect(deps.routines.findById).not.toHaveBeenCalled()
  })

  it('exerciseId fuera del catálogo → ExerciseNotFoundError (RF-12)', async () => {
    const deps = makeDeps()
    const bad = patch({
      blocks: [{ exercises: [{ exerciseId: 'ex_9', sets: 3, reps: 10 }], rounds: 1, restBetweenRoundsSec: 0 }],
    })
    const r = await updateRoutine(bad, deps)

    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(ExerciseNotFoundError)
    expect(deps.routines.update).not.toHaveBeenCalled()
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./update-routine.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
