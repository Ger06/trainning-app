import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { listRoutines } from './list-routines'
import type { RoutineRepository } from './ports'
import { routine } from './routine'

const D = new Date('2026-08-01T00:00:00.000Z')
const make = (id: string, trainerId: string, name: string) =>
  routine({
    id,
    trainerId,
    name,
    nameNormalized: name.toLowerCase(),
    blocks: [
      {
        exercises: [
          { exerciseId: 'ex_1', sets: 3, reps: 10, restBetweenSetsSec: 0, restAfterExerciseSec: 0 },
        ],
        rounds: 1,
        restBetweenRoundsSec: 0,
      },
    ],
    createdAt: D,
    updatedAt: D,
  })

const t1a = make('rt_1', 't_1', 'Full A')
const t1b = make('rt_2', 't_1', 'Full B')
const t2a = make('rt_3', 't_2', 'Empuje')
const all = [t1a, t1b, t2a]

const deps = {
  routines: {
    insert: vi.fn(async (d) => routine({ id: 'x', ...d })),
    findById: vi.fn(async () => null),
    listByTrainer: vi.fn(async (trainerId: string) => all.filter((r) => r.trainerId === trainerId)),
    update: vi.fn(async (r) => r),
    deleteById: vi.fn(async () => {}),
    anyUsesExercise: vi.fn(async () => false),
  } as RoutineRepository,
}

describe('listRoutines (RF-2)', () => {
  it('devuelve solo las rutinas del trainerId indicado', async () => {
    expect(await listRoutines('t_1', deps)).toEqual([t1a, t1b])
    expect(await listRoutines('t_2', deps)).toEqual([t2a])
    expect(await listRoutines('t_3', deps)).toEqual([])
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./list-routines.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
