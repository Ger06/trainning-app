import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Assignment, NewAssignment, RoutineSnapshot } from './assignment'
import type { Exercise } from './exercise'
import type { Routine } from './routine'
import type {
  AccountLookup,
  AssignmentRepository,
  Clock,
  ExerciseRepository,
  IdGenerator,
  RoutineRepository,
  TrainerClientLinkRepository,
} from './ports'

// Los puertos no tienen lógica: el "test" es que se puedan implementar de forma
// coherente con las entidades del dominio (compila) y que el módulo no aporte
// nada en runtime.

const D = new Date('2026-08-31T00:00:00.000Z')

const exercise = (over: Partial<Exercise> = {}): Exercise => ({
  id: 'ex_1',
  trainerId: 't_1',
  name: 'Sentadilla',
  nameNormalized: 'sentadilla',
  createdAt: D,
  updatedAt: D,
  ...over,
})

const routine = (over: Partial<Routine> = {}): Routine => ({
  id: 'rt_1',
  trainerId: 't_1',
  name: 'Full A',
  nameNormalized: 'full a',
  blocks: [
    {
      exercises: [
        { exerciseId: 'ex_1', sets: 3, reps: 10, restBetweenSetsSec: 90, restAfterExerciseSec: 0 },
      ],
      rounds: 1,
      restBetweenRoundsSec: 0,
    },
  ],
  createdAt: D,
  updatedAt: D,
  ...over,
})

const snapshot = (): RoutineSnapshot => ({
  routineId: 'rt_1',
  name: 'Full A',
  blocks: [
    {
      exercises: [
        {
          exerciseId: 'ex_1',
          name: 'Sentadilla',
          sets: 3,
          reps: 10,
          restBetweenSetsSec: 90,
          restAfterExerciseSec: 0,
        },
      ],
      rounds: 1,
      restBetweenRoundsSec: 0,
    },
  ],
})

describe('ports · contrato de tipos', () => {
  it('ExerciseRepository se implementa con un doble en memoria', async () => {
    const rows = new Map<string, Exercise>()
    const repo: ExerciseRepository = {
      async insert(data) {
        const e = exercise({ ...data, id: `ex_${rows.size + 1}` })
        rows.set(e.id, e)
        return e
      },
      async findById(trainerId, id) {
        const e = rows.get(id)
        return e && e.trainerId === trainerId ? e : null
      },
      async listByTrainer(trainerId) {
        return [...rows.values()].filter((e) => e.trainerId === trainerId)
      },
      async update(e) {
        rows.set(e.id, e)
        return e
      },
      async deleteById(_trainerId, id) {
        rows.delete(id)
      },
    }

    const e = await repo.insert({
      trainerId: 't_1',
      name: 'Press',
      nameNormalized: 'press',
      createdAt: D,
      updatedAt: D,
    })
    expect(e.id).toBe('ex_1')
    expect(await repo.findById('t_1', e.id)).toEqual(e)
    expect(await repo.findById('t_2', e.id)).toBeNull()
    expect(await repo.listByTrainer('t_1')).toHaveLength(1)
  })

  it('RoutineRepository se implementa, incluido anyUsesExercise (RF-8)', async () => {
    const repo: RoutineRepository = {
      async insert(data) {
        return routine({ ...data, id: 'rt_9' })
      },
      async findById() {
        return null
      },
      async listByTrainer() {
        return []
      },
      async update(r) {
        return r
      },
      async deleteById() {},
      async anyUsesExercise(_trainerId, exerciseId) {
        return exerciseId === 'ex_1'
      },
    }

    expect((await repo.insert(routine())).id).toBe('rt_9')
    expect(await repo.anyUsesExercise('t_1', 'ex_1')).toBe(true)
    expect(await repo.anyUsesExercise('t_1', 'ex_2')).toBe(false)
  })

  it('AssignmentRepository reemplaza el slot y devuelve creada + previa (RF-26)', async () => {
    let current: Assignment | null = null
    let n = 0
    const repo: AssignmentRepository = {
      async replaceForSlot(data: NewAssignment) {
        const replaced = current
        current = { ...data, id: `as_${++n}` }
        return { created: current, replaced }
      },
      async listByStudent() {
        return current ? [current] : []
      },
      async deleteOwned() {
        const had = current !== null
        current = null
        return had
      },
    }

    const base: NewAssignment = {
      trainerId: 't_1',
      studentId: 's_1',
      week: 1,
      weekday: 'lunes',
      routineSnapshot: snapshot(),
      createdAt: D,
    }
    const first = await repo.replaceForSlot(base)
    expect(first.replaced).toBeNull()
    expect(first.created.id).toBe('as_1')
    const second = await repo.replaceForSlot(base)
    expect(second.replaced?.id).toBe('as_1')
    expect(second.created.id).toBe('as_2')
    expect(await repo.deleteOwned('t_1', 'as_2')).toBe(true)
    expect(await repo.deleteOwned('t_1', 'as_2')).toBe(false)
  })

  it('TrainerClientLinkRepository registra vínculos idempotentes (RF-22)', async () => {
    const links = new Set<string>()
    const repo: TrainerClientLinkRepository = {
      async ensureLink(trainerId, studentId) {
        links.add(`${trainerId}:${studentId}`)
      },
      async listStudents(trainerId) {
        return [...links]
          .filter((k) => k.startsWith(`${trainerId}:`))
          .map((k) => k.split(':')[1])
      },
    }

    await repo.ensureLink('t_1', 's_1')
    await repo.ensureLink('t_1', 's_1')
    expect(await repo.listStudents('t_1')).toEqual(['s_1'])
  })

  it('AccountLookup resuelve por username y da de alta sin sesión (RF-21, RF-21b)', async () => {
    const lookup: AccountLookup = {
      async findByUsername(u) {
        return u === 'ana' ? { id: 's_ana', role: 'alumno' } : null
      },
      async createAlumno({ username }) {
        return { id: `s_${username}` }
      },
    }

    expect(await lookup.findByUsername('ana')).toEqual({ id: 's_ana', role: 'alumno' })
    expect(await lookup.findByUsername('nadie')).toBeNull()
    expect(await lookup.createAlumno({ username: 'marta', password: 'contrasena8' })).toEqual({
      id: 's_marta',
    })
  })

  it('Clock e IdGenerator se implementan', () => {
    const clock: Clock = { now: () => new Date(0) }
    const ids: IdGenerator = { newId: () => 'id-1' }
    expect(clock.now().getTime()).toBe(0)
    expect(ids.newId()).toBe('id-1')
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./ports.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })

  it('sólo declara tipos: no exporta nada en runtime', async () => {
    const mod = await import('./ports')
    expect(Object.keys(mod)).toHaveLength(0)
  })
})
