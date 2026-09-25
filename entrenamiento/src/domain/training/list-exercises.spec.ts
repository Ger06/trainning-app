import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { exercise } from './exercise'
import { listExercises } from './list-exercises'
import type { ExerciseRepository } from './ports'

const D = new Date('2026-08-01T00:00:00.000Z')
const make = (id: string, trainerId: string, name: string) =>
  exercise({ id, trainerId, name, nameNormalized: name.toLowerCase(), createdAt: D, updatedAt: D })

const t1a = make('ex_1', 't_1', 'Sentadilla')
const t1b = make('ex_2', 't_1', 'Press')
const t2a = make('ex_3', 't_2', 'Remo')
const all = [t1a, t1b, t2a]

const deps = {
  exercises: {
    insert: vi.fn(async (d) => exercise({ id: 'x', ...d })),
    findById: vi.fn(async () => null),
    listByTrainer: vi.fn(async (trainerId: string) => all.filter((e) => e.trainerId === trainerId)),
    update: vi.fn(async (e) => e),
    deleteById: vi.fn(async () => {}),
  } as ExerciseRepository,
}

describe('listExercises (RF-2)', () => {
  it('devuelve solo el catálogo del trainerId indicado', async () => {
    expect(await listExercises('t_1', deps)).toEqual([t1a, t1b])
    expect(await listExercises('t_2', deps)).toEqual([t2a])
    expect(await listExercises('t_3', deps)).toEqual([])
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./list-exercises.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
