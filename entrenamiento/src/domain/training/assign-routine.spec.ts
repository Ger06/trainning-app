import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { assignment, type Assignment, type NewAssignment } from './assignment'
import {
  InvalidTrainingInputError,
  RoutineNotFoundError,
} from './errors'
import { exercise, type Exercise } from './exercise'
import type {
  AccountLookup,
  AssignmentRepository,
  Clock,
  ExerciseRepository,
  RoutineRepository,
  TrainerClientLinkRepository,
} from './ports'
import { routine, type Routine } from './routine'
import { assignRoutine } from './assign-routine'

const NOW = new Date('2026-08-31T12:00:00.000Z')
const D = new Date('2026-08-01T00:00:00.000Z')

const ex1 = (name = 'Sentadilla') =>
  exercise({
    id: 'ex_1',
    trainerId: 't_1',
    name,
    nameNormalized: name.toLowerCase(),
    description: 'barra alta',
    createdAt: D,
    updatedAt: D,
  })

const validRoutine = () =>
  routine({
    id: 'rt_1',
    trainerId: 't_1',
    name: 'Full A',
    nameNormalized: 'full a',
    blocks: [
      {
        exercises: [
          { exerciseId: 'ex_1', sets: 3, reps: 10, restBetweenSetsSec: 90, restAfterExerciseSec: 0 },
        ],
        rounds: 2,
        restBetweenRoundsSec: 60,
      },
    ],
    createdAt: D,
    updatedAt: D,
  })

interface Over {
  routine?: Routine | null
  exercises?: Exercise[]
  accounts?: Record<string, { id: string; role: 'entrenador' | 'alumno' }>
}

function makeDeps(over: Over = {}) {
  const liveRoutine = over.routine === undefined ? validRoutine() : over.routine
  const catalog = over.exercises ?? [ex1()]
  const accountsMap = over.accounts ?? {
    ana: { id: 's_ana', role: 'alumno' as const },
    luis: { id: 's_luis', role: 'alumno' as const },
    coach: { id: 't_9', role: 'entrenador' as const },
  }

  const routines: RoutineRepository = {
    insert: vi.fn(),
    findById: vi.fn(async (t: string, id: string) =>
      liveRoutine && t === liveRoutine.trainerId && id === liveRoutine.id ? liveRoutine : null,
    ),
    listByTrainer: vi.fn(async () => []),
    update: vi.fn(),
    deleteById: vi.fn(),
    anyUsesExercise: vi.fn(async () => false),
  }
  const exercises: ExerciseRepository = {
    insert: vi.fn(),
    findById: vi.fn(async (t: string, id: string) =>
      catalog.find((e) => e.trainerId === t && e.id === id) ?? null,
    ),
    listByTrainer: vi.fn(async () => []),
    update: vi.fn(),
    deleteById: vi.fn(),
  }
  const slotStore = new Map<string, Assignment>()
  let seq = 0
  const assignments: AssignmentRepository = {
    replaceForSlot: vi.fn(async (data: NewAssignment) => {
      const key = `${data.studentId}|${data.week}|${data.weekday}`
      const replaced = slotStore.get(key) ?? null
      const created = assignment({ ...data, id: `as_${++seq}` })
      slotStore.set(key, created)
      return { created, replaced }
    }),
    listByStudent: vi.fn(async () => [...slotStore.values()]),
    deleteOwned: vi.fn(async () => false),
  }
  const links: TrainerClientLinkRepository = {
    ensureLink: vi.fn(async () => {}),
    listStudents: vi.fn(async () => []),
  }
  const created: string[] = []
  const accounts: AccountLookup = {
    findByUsername: vi.fn(async (u: string) => accountsMap[u] ?? null),
    createAlumno: vi.fn(async ({ username, password }: { username: string; password: string }) => {
      if (username.length < 2 || password.length < 8) {
        throw new InvalidTrainingInputError([{ field: 'passwordInicial', code: 'too_short' }])
      }
      created.push(username)
      return { id: `s_${username}` }
    }),
  }
  const clock: Clock = { now: () => NOW }
  return { routines, exercises, assignments, links, accounts, clock, createdAlumnos: created, slotStore }
}

const call = (input: Parameters<typeof assignRoutine>[0], deps: ReturnType<typeof makeDeps>) =>
  assignRoutine(input, deps)

describe('assignRoutine', () => {
  it('produce N alumnos × M slots asignaciones (RF-18)', async () => {
    const deps = makeDeps()
    const r = await call(
      {
        trainerId: 't_1',
        routineId: 'rt_1',
        recipients: [{ username: 'ana' }, { username: 'luis' }],
        slots: [
          { week: 1, weekday: 'lunes' },
          { week: 1, weekday: 'jueves' },
        ],
      },
      deps,
    )

    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('debía valer')
    expect(r.value.created).toHaveLength(4)
    expect(new Set(r.value.created.map((a) => a.studentId))).toEqual(new Set(['s_ana', 's_luis']))
    expect(deps.slotStore.size).toBe(4)
  })

  it('rutina inexistente o de otro entrenador → RoutineNotFoundError (RF-2)', async () => {
    const deps = makeDeps()
    const r = await call(
      { trainerId: 't_2', routineId: 'rt_1', recipients: [{ username: 'ana' }], slots: [{ week: 1, weekday: 'lunes' }] },
      deps,
    )
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(RoutineNotFoundError)
  })

  it('rutina sin contenido válido → InvalidTrainingInputError, nada asignado (RF-20)', async () => {
    const broken = { ...validRoutine(), blocks: [] } as unknown as Routine
    const deps = makeDeps({ routine: broken })
    const r = await call(
      { trainerId: 't_1', routineId: 'rt_1', recipients: [{ username: 'ana' }], slots: [{ week: 1, weekday: 'lunes' }] },
      deps,
    )
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(InvalidTrainingInputError)
    expect(deps.slotStore.size).toBe(0)
  })

  it('slot mal formado → InvalidTrainingInputError (RF-19)', async () => {
    const deps = makeDeps()
    const r = await call(
      { trainerId: 't_1', routineId: 'rt_1', recipients: [{ username: 'ana' }], slots: [{ week: 0, weekday: 'lunes' }] },
      deps,
    )
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(InvalidTrainingInputError)
  })

  it('destinatario inexistente sin confirmar → needsConfirmation, sin crear nada (RF-21)', async () => {
    const deps = makeDeps()
    const r = await call(
      { trainerId: 't_1', routineId: 'rt_1', recipients: [{ username: 'nadie' }], slots: [{ week: 1, weekday: 'lunes' }] },
      deps,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('debía valer')
    expect(r.value.needsConfirmation).toEqual(['nadie'])
    expect(r.value.created).toHaveLength(0)
    expect(deps.accounts.createAlumno).not.toHaveBeenCalled()
    expect(deps.slotStore.size).toBe(0)
  })

  it('alta confirmada crea la cuenta sin sesión y el lote sigue (RF-21b, RF-21c)', async () => {
    const deps = makeDeps()
    const r = await call(
      {
        trainerId: 't_1',
        routineId: 'rt_1',
        recipients: [
          { username: 'marta', confirmarAlta: true, passwordInicial: 'contrasena8' },
          { username: 'ana' },
        ],
        slots: [{ week: 1, weekday: 'lunes' }],
      },
      deps,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('debía valer')
    expect(deps.createdAlumnos).toContain('marta')
    expect(new Set(r.value.created.map((a) => a.studentId))).toEqual(new Set(['s_marta', 's_ana']))
    // El puerto de alta no tiene noción de sesión: no hay `issue` ni cookie.
    expect(Object.keys(deps.accounts)).toEqual(['findByUsername', 'createAlumno'])
  })

  it('alta con contraseña insuficiente → rejected, el resto del lote continúa (RF-21b, RF-21c)', async () => {
    const deps = makeDeps()
    const r = await call(
      {
        trainerId: 't_1',
        routineId: 'rt_1',
        recipients: [
          { username: 'pepe', confirmarAlta: true, passwordInicial: 'corta' },
          { username: 'ana' },
        ],
        slots: [{ week: 2, weekday: 'martes' }],
      },
      deps,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('debía valer')
    expect(r.value.rejected).toContainEqual({ username: 'pepe', reason: 'invalid_credentials' })
    expect(r.value.created.map((a) => a.studentId)).toEqual(['s_ana'])
  })

  it('username de un entrenador → rejected, sin alta ni asignación (RF-23)', async () => {
    const deps = makeDeps()
    const r = await call(
      { trainerId: 't_1', routineId: 'rt_1', recipients: [{ username: 'coach' }], slots: [{ week: 1, weekday: 'lunes' }] },
      deps,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('debía valer')
    expect(r.value.rejected).toContainEqual({
      username: 'coach',
      reason: 'username_belongs_to_trainer',
    })
    expect(deps.accounts.createAlumno).not.toHaveBeenCalled()
    expect(deps.slotStore.size).toBe(0)
  })

  it('registra el vínculo entrenador–alumno una vez por alumno resuelto (RF-22)', async () => {
    const deps = makeDeps()
    await call(
      {
        trainerId: 't_1',
        routineId: 'rt_1',
        recipients: [{ username: 'ana' }],
        slots: [
          { week: 1, weekday: 'lunes' },
          { week: 1, weekday: 'jueves' },
        ],
      },
      deps,
    )
    expect(deps.links.ensureLink).toHaveBeenCalledWith('t_1', 's_ana')
    expect(deps.links.ensureLink).toHaveBeenCalledTimes(1)
  })

  it('reasignar el mismo slot sobrescribe y reporta la previa (RF-25, RF-26)', async () => {
    const deps = makeDeps()
    const input = {
      trainerId: 't_1',
      routineId: 'rt_1',
      recipients: [{ username: 'ana' }],
      slots: [{ week: 2, weekday: 'miercoles' as const }],
    }
    const first = await call(input, deps)
    if (!first.ok) throw new Error('debía valer')
    expect(first.value.overwritten).toHaveLength(0)

    const second = await call(input, deps)
    if (!second.ok) throw new Error('debía valer')
    expect(second.value.overwritten).toHaveLength(1)
    expect(second.value.overwritten[0].id).toBe(first.value.created[0].id)
    expect(deps.slotStore.size).toBe(1)
  })

  it('el snapshot refleja el estado actual del ejercicio al reasignar (RF-24, RF-25)', async () => {
    const deps = makeDeps()
    const input = {
      trainerId: 't_1',
      routineId: 'rt_1',
      recipients: [{ username: 'ana' }],
      slots: [{ week: 1, weekday: 'lunes' as const }],
    }
    const first = await call(input, deps)
    if (!first.ok) throw new Error('debía valer')
    expect(first.value.created[0].routineSnapshot.blocks[0].exercises[0].name).toBe('Sentadilla')

    // el entrenador renombra el ejercicio del catálogo antes de reasignar
    deps.exercises.findById = vi.fn(async () => ex1('Sentadilla Frontal'))
    const second = await call(input, deps)
    if (!second.ok) throw new Error('debía valer')
    expect(second.value.created[0].routineSnapshot.blocks[0].exercises[0].name).toBe('Sentadilla Frontal')
    expect(second.value.overwritten[0].routineSnapshot.blocks[0].exercises[0].name).toBe('Sentadilla')
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./assign-routine.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
