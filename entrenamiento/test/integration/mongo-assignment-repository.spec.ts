import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { NewAssignment, RoutineSnapshot } from '@/domain/training/assignment'
import { ASSIGNMENTS_COLLECTION } from '@/infra/db/migrations'
import { createMongoAssignmentRepository } from '@/infra/repositories/mongo-assignment-repository'
import { hasMongo, setupIntegrationDb, type IntegrationContext } from './_harness'

const T1 = new ObjectId().toHexString()
const S1 = new ObjectId().toHexString()
const S2 = new ObjectId().toHexString()

const snapshot = (name = 'Full A'): RoutineSnapshot => ({
  routineId: 'rt_1',
  name,
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

const draft = (over: Partial<NewAssignment> = {}): NewAssignment => ({
  trainerId: T1,
  studentId: S1,
  week: 1,
  weekday: 'lunes',
  routineSnapshot: snapshot(),
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  ...over,
})

describe.skipIf(!hasMongo)('T26 · mongo-assignment-repository (integración)', () => {
  let ctx: IntegrationContext
  let repo: ReturnType<typeof createMongoAssignmentRepository>

  beforeAll(async () => {
    ctx = await setupIntegrationDb()
    repo = createMongoAssignmentRepository(ctx.db)
  })
  afterAll(async () => {
    await ctx.teardown()
  })

  const countSlot = (studentId: string, week: number, weekday: string) =>
    ctx.db.collection(ASSIGNMENTS_COLLECTION).countDocuments({
      trainerId: new ObjectId(T1),
      studentId: new ObjectId(studentId),
      week,
      weekday,
    })

  it('replaceForSlot en un slot libre devuelve replaced=null y deja un documento (RF-26)', async () => {
    const { created, replaced } = await repo.replaceForSlot(draft({ studentId: S2, week: 3 }))
    expect(replaced).toBeNull()
    expect(created.id).toMatch(/^[0-9a-f]{24}$/)
    expect(await countSlot(S2, 3, 'lunes')).toBe(1)
  })

  it('un segundo replaceForSlot sobre el mismo slot devuelve la previa y sigue habiendo un documento (RF-24, RF-26)', async () => {
    await repo.replaceForSlot(draft({ week: 5, routineSnapshot: snapshot('Vieja') }))
    const { replaced } = await repo.replaceForSlot(draft({ week: 5, routineSnapshot: snapshot('Nueva') }))
    expect(replaced?.routineSnapshot.name).toBe('Vieja')
    expect(await countSlot(S1, 5, 'lunes')).toBe(1)

    const rows = await repo.listByStudent(T1, S1, 5)
    expect(rows).toHaveLength(1)
    expect(rows[0].routineSnapshot.name).toBe('Nueva')
  })

  it('listByStudent filtra por entrenador, alumno y semana', async () => {
    await repo.replaceForSlot(draft({ week: 7, weekday: 'lunes' }))
    await repo.replaceForSlot(draft({ week: 7, weekday: 'jueves' }))
    expect(await repo.listByStudent(T1, S1, 7)).toHaveLength(2)
    expect(await repo.listByStudent(new ObjectId().toHexString(), S1, 7)).toHaveLength(0)
  })

  it('deleteOwned solo borra lo del propio trainerId (RF-2, RF-27)', async () => {
    const { created } = await repo.replaceForSlot(draft({ week: 9 }))
    expect(await repo.deleteOwned(new ObjectId().toHexString(), created.id)).toBe(false)
    expect(await repo.deleteOwned(T1, created.id)).toBe(true)
    expect(await countSlot(S1, 9, 'lunes')).toBe(0)
  })
})
