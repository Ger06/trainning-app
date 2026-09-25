import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { ExerciseNotFoundError, InvalidTrainingInputError } from './errors'
import { exercise } from './exercise'
import type { Clock, ExerciseRepository } from './ports'
import { updateExercise } from './update-exercise'

const NOW = new Date('2026-09-01T09:00:00.000Z')
const CREATED = new Date('2026-08-01T00:00:00.000Z')

const existing = exercise({
  id: 'ex_1',
  trainerId: 't_1',
  name: 'Sentadilla',
  nameNormalized: 'sentadilla',
  createdAt: CREATED,
  updatedAt: CREATED,
})

function makeDeps() {
  const exercises: ExerciseRepository = {
    insert: vi.fn(async (d) => exercise({ id: 'x', ...d })),
    findById: vi.fn(async (trainerId: string, id: string) =>
      trainerId === existing.trainerId && id === existing.id ? existing : null,
    ),
    listByTrainer: vi.fn(async () => []),
    update: vi.fn(async (e) => e),
    deleteById: vi.fn(async () => {}),
  }
  const clock: Clock = { now: () => NOW }
  return { exercises, clock }
}

describe('updateExercise (RF-2, RF-7)', () => {
  it('edita nombre y descripción de un ejercicio propio; conserva createdAt, mueve updatedAt', async () => {
    const deps = makeDeps()
    const r = await updateExercise(
      { trainerId: 't_1', id: 'ex_1', name: 'Sentadilla Frontal', description: 'barra alta' },
      deps,
    )

    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('debía valer')
    expect(deps.exercises.update).toHaveBeenCalledTimes(1)
    expect(r.value).toMatchObject({
      id: 'ex_1',
      trainerId: 't_1',
      name: 'Sentadilla Frontal',
      nameNormalized: 'sentadilla frontal',
      description: 'barra alta',
      createdAt: CREATED,
      updatedAt: NOW,
    })
  })

  it('ejercicio de otro entrenador → ExerciseNotFoundError, sin escribir (RF-2)', async () => {
    const deps = makeDeps()
    const r = await updateExercise({ trainerId: 't_2', id: 'ex_1', name: 'Otro nombre' }, deps)

    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(ExerciseNotFoundError)
    expect(deps.exercises.update).not.toHaveBeenCalled()
  })

  it('id inexistente → ExerciseNotFoundError', async () => {
    const deps = makeDeps()
    const r = await updateExercise({ trainerId: 't_1', id: 'ex_9', name: 'Nombre válido' }, deps)
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(ExerciseNotFoundError)
  })

  it('revalida la entrada: nombre corto → InvalidTrainingInputError sin buscar (RF-3)', async () => {
    const deps = makeDeps()
    const r = await updateExercise({ trainerId: 't_1', id: 'ex_1', name: 'x' }, deps)

    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(InvalidTrainingInputError)
    expect(deps.exercises.findById).not.toHaveBeenCalled()
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./update-exercise.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
