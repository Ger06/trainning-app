import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { assignment, type Assignment } from './assignment'
import type { AssignmentRepository } from './ports'
import { listAssignments } from './list-assignments'

const D = new Date('2026-08-01T00:00:00.000Z')
const snap = { routineId: 'rt_1', name: 'Full A', blocks: [] as never[] }

const make = (id: string, trainerId: string, studentId: string, week: number): Assignment =>
  assignment({
    id,
    trainerId,
    studentId,
    week,
    weekday: 'lunes',
    routineSnapshot: snap,
    createdAt: D,
  })

const rows = [
  make('as_1', 't_1', 's_ana', 1),
  make('as_2', 't_1', 's_ana', 2),
  make('as_3', 't_1', 's_luis', 1),
  make('as_4', 't_2', 's_ana', 1),
]

const deps = {
  assignments: {
    replaceForSlot: vi.fn(),
    deleteOwned: vi.fn(async () => false),
    listByStudent: vi.fn(async (trainerId: string, studentId: string, week?: number) =>
      rows.filter(
        (a) =>
          a.trainerId === trainerId &&
          a.studentId === studentId &&
          (week === undefined || a.week === week),
      ),
    ),
  } as AssignmentRepository,
}

describe('listAssignments (RF-2, RF-18)', () => {
  it('devuelve solo las asignaciones del entrenador para ese alumno', async () => {
    const r = await listAssignments({ trainerId: 't_1', studentId: 's_ana' }, deps)
    expect(r.map((a) => a.id)).toEqual(['as_1', 'as_2'])
  })

  it('filtra por semana cuando se indica', async () => {
    const r = await listAssignments({ trainerId: 't_1', studentId: 's_ana', week: 2 }, deps)
    expect(r.map((a) => a.id)).toEqual(['as_2'])
  })

  it('no cruza a otro entrenador ni a otro alumno', async () => {
    expect(await listAssignments({ trainerId: 't_2', studentId: 's_luis' }, deps)).toEqual([])
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./list-assignments.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
