import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { RoutineNotFoundError } from './errors'
import type { RoutineRepository } from './ports'
import { deleteRoutine } from './delete-routine'
import { routine } from './routine'

const D = new Date('2026-08-01T00:00:00.000Z')
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
  createdAt: D,
  updatedAt: D,
})

function makeDeps() {
  // `deps` solo lleva `routines`: eliminar una rutina no toca las asignaciones (RF-17).
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
  return { routines }
}

describe('deleteRoutine (RF-2, RF-17)', () => {
  it('borra una rutina propia', async () => {
    const deps = makeDeps()
    const r = await deleteRoutine({ trainerId: 't_1', id: 'rt_1' }, deps)

    expect(r.ok).toBe(true)
    expect(deps.routines.deleteById).toHaveBeenCalledWith('t_1', 'rt_1')
  })

  it('rutina de otro entrenador o inexistente → RoutineNotFoundError, sin borrar (RF-2)', async () => {
    const deps = makeDeps()
    const ajena = await deleteRoutine({ trainerId: 't_2', id: 'rt_1' }, deps)
    const inexistente = await deleteRoutine({ trainerId: 't_1', id: 'rt_9' }, deps)

    for (const r of [ajena, inexistente]) {
      expect(r.ok).toBe(false)
      if (r.ok) throw new Error('debía fallar')
      expect(r.error).toBeInstanceOf(RoutineNotFoundError)
    }
    expect(deps.routines.deleteById).not.toHaveBeenCalled()
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./delete-routine.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
