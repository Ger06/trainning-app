import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { RoutineNameTakenError } from '@/domain/training/errors'
import type { NewRoutine } from '@/domain/training/routine'
import { ROUTINES_COLLECTION } from '@/infra/db/migrations'
import { createMongoRoutineRepository } from '@/infra/repositories/mongo-routine-repository'
import { hasMongo, setupIntegrationDb, type IntegrationContext } from './_harness'

const T1 = new ObjectId().toHexString()

const draft = (over: Partial<NewRoutine> = {}): NewRoutine => ({
  trainerId: T1,
  name: 'Full A',
  nameNormalized: 'full-a',
  blocks: [
    {
      exercises: [
        { exerciseId: 'ex_1', sets: 3, reps: 10, restBetweenSetsSec: 90, restAfterExerciseSec: 0 },
      ],
      rounds: 2,
      restBetweenRoundsSec: 60,
    },
  ],
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  ...over,
})

describe.skipIf(!hasMongo)('T25 · mongo-routine-repository (integración)', () => {
  let ctx: IntegrationContext
  let repo: ReturnType<typeof createMongoRoutineRepository>

  beforeAll(async () => {
    ctx = await setupIntegrationDb()
    repo = createMongoRoutineRepository(ctx.db)
  })
  afterAll(async () => {
    await ctx.teardown()
  })

  it('insert conserva el árbol de bloques y traduce _id ↔ id', async () => {
    const created = await repo.insert(draft({ nameNormalized: 'full-a-1' }))
    const back = await repo.findById(T1, created.id)
    expect(back?.blocks[0].exercises[0].exerciseId).toBe('ex_1')
    expect(back?.blocks[0].rounds).toBe(2)
  })

  it('nombre duplicado por entrenador → RoutineNameTakenError (RF-16)', async () => {
    await repo.insert(draft({ nameNormalized: 'empuje' }))
    await expect(repo.insert(draft({ nameNormalized: 'empuje' }))).rejects.toBeInstanceOf(
      RoutineNameTakenError,
    )
  })

  it('anyUsesExercise detecta la referencia y respeta el trainerId (RF-8)', async () => {
    await repo.insert(
      draft({
        nameNormalized: 'usa-ex9',
        blocks: [
          {
            exercises: [
              { exerciseId: 'ex_9', sets: 2, reps: 8, restBetweenSetsSec: 0, restAfterExerciseSec: 0 },
            ],
            rounds: 1,
            restBetweenRoundsSec: 0,
          },
        ],
      }),
    )
    expect(await repo.anyUsesExercise(T1, 'ex_9')).toBe(true)
    expect(await repo.anyUsesExercise(T1, 'ex_inexistente')).toBe(false)
    expect(await repo.anyUsesExercise(new ObjectId().toHexString(), 'ex_9')).toBe(false)
  })

  it('el validador de BD rechaza un bloque con rondas 0 (P6, RF-12)', async () => {
    await expect(
      ctx.db.collection(ROUTINES_COLLECTION).insertOne({
        _id: new ObjectId(),
        trainerId: new ObjectId(),
        name: 'Rota',
        nameNormalized: `rota-${new ObjectId().toHexString()}`,
        blocks: [
          {
            exercises: [
              { exerciseId: 'ex_1', sets: 3, restBetweenSetsSec: 0, restAfterExerciseSec: 0 },
            ],
            rounds: 0,
            restBetweenRoundsSec: 0,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).rejects.toThrow()
  })
})
