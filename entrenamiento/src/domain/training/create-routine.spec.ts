import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createRoutine } from './create-routine'
import { ExerciseNotFoundError, InvalidTrainingInputError, RoutineNameTakenError } from './errors'
import { exercise } from './exercise'
import type { Clock, ExerciseRepository, RoutineRepository } from './ports'
import { routine, type NewRoutine, type Routine } from './routine'

const NOW = new Date('2026-08-31T12:00:00.000Z')
const D = new Date('2026-08-01T00:00:00.000Z')

const catalog: Record<string, boolean> = { ex_1: true, ex_2: true }

function makeDeps(over: { insertImpl?: (d: NewRoutine) => Promise<Routine> } = {}) {
  const insertCalls: NewRoutine[] = []
  const routines: RoutineRepository = {
    insert: vi.fn(async (data: NewRoutine) => {
      insertCalls.push(data)
      return over.insertImpl ? over.insertImpl(data) : routine({ id: 'rt_new', ...data })
    }),
    findById: vi.fn(async () => null),
    listByTrainer: vi.fn(async () => []),
    update: vi.fn(async (r) => r),
    deleteById: vi.fn(async () => {}),
    anyUsesExercise: vi.fn(async () => false),
  }
  const exercises: ExerciseRepository = {
    insert: vi.fn(async (d) => exercise({ id: 'x', ...d })),
    findById: vi.fn(async (trainerId: string, id: string) =>
      trainerId === 't_1' && catalog[id]
        ? exercise({ id, trainerId, name: id, nameNormalized: id, createdAt: D, updatedAt: D })
        : null,
    ),
    listByTrainer: vi.fn(async () => []),
    update: vi.fn(async (e) => e),
    deleteById: vi.fn(async () => {}),
  }
  const clock: Clock = { now: () => NOW }
  return { routines, exercises, clock, insertCalls }
}

const draft = (over: Record<string, unknown> = {}) => ({
  trainerId: 't_1',
  name: 'Full A',
  blocks: [{ exercises: [{ exerciseId: 'ex_1', sets: 3, reps: 10 }], rounds: 2, restBetweenRoundsSec: 60 }],
  ...over,
})

describe('createRoutine (RF-2, RF-12, RF-15, RF-16)', () => {
  it('happy path: valida, comprueba el catálogo e inserta con trainerId y timestamps', async () => {
    const deps = makeDeps()
    const r = await createRoutine(draft(), deps)

    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('debía valer')
    expect(r.value.id).toBe('rt_new')
    expect(deps.insertCalls[0]).toMatchObject({
      trainerId: 't_1',
      name: 'Full A',
      nameNormalized: 'full a',
      createdAt: NOW,
      updatedAt: NOW,
    })
    expect(deps.insertCalls[0]?.blocks[0].exercises[0].exerciseId).toBe('ex_1')
  })

  it('exerciseId fuera del catálogo del entrenador → ExerciseNotFoundError, sin insertar (RF-12)', async () => {
    const deps = makeDeps()
    const bad = draft({
      blocks: [{ exercises: [{ exerciseId: 'ex_9', sets: 3, reps: 10 }], rounds: 1, restBetweenRoundsSec: 0 }],
    })
    const r = await createRoutine(bad, deps)

    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(ExerciseNotFoundError)
    expect(deps.routines.insert).not.toHaveBeenCalled()
  })

  it('nombre de rutina duplicado → RoutineNameTakenError (RF-16)', async () => {
    const deps = makeDeps({
      insertImpl: async () => {
        throw new RoutineNameTakenError('Full A')
      },
    })
    const r = await createRoutine(draft(), deps)

    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(RoutineNameTakenError)
  })

  it('borrador inválido → InvalidTrainingInputError, sin tocar repos (RF-15)', async () => {
    const deps = makeDeps()
    const r = await createRoutine(draft({ blocks: [] }), deps)

    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(InvalidTrainingInputError)
    expect(deps.exercises.findById).not.toHaveBeenCalled()
    expect(deps.routines.insert).not.toHaveBeenCalled()
  })

  it('propaga un error inesperado del repo', async () => {
    const deps = makeDeps({
      insertImpl: async () => {
        throw new Error('mongo caído')
      },
    })
    await expect(createRoutine(draft(), deps)).rejects.toThrow('mongo caído')
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./create-routine.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
