import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ExerciseNameTakenError } from '@/domain/training/errors'
import type { NewExercise } from '@/domain/training/exercise'
import { EXERCISES_COLLECTION } from '@/infra/db/migrations'
import { createMongoExerciseRepository } from '@/infra/repositories/mongo-exercise-repository'
import { hasMongo, setupIntegrationDb, type IntegrationContext } from './_harness'

const T1 = new ObjectId().toHexString()
const T2 = new ObjectId().toHexString()

const draft = (over: Partial<NewExercise> = {}): NewExercise => ({
  trainerId: T1,
  name: 'Sentadilla',
  nameNormalized: 'sentadilla',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  ...over,
})

describe.skipIf(!hasMongo)('T24 · mongo-exercise-repository (integración)', () => {
  let ctx: IntegrationContext
  let repo: ReturnType<typeof createMongoExerciseRepository>

  beforeAll(async () => {
    ctx = await setupIntegrationDb()
    repo = createMongoExerciseRepository(ctx.db)
  })
  afterAll(async () => {
    await ctx.teardown()
  })

  it('insert traduce _id ↔ id y guarda trainerId como ObjectId', async () => {
    const created = await repo.insert(draft({ nameNormalized: 'sentadilla-a', description: 'barra alta' }))
    expect(created.id).toMatch(/^[0-9a-f]{24}$/)

    const raw = await ctx.db.collection(EXERCISES_COLLECTION).findOne({ _id: new ObjectId(created.id) })
    expect(raw?.trainerId).toBeInstanceOf(ObjectId)
    expect((raw?.trainerId as ObjectId).toHexString()).toBe(T1)

    const back = await repo.findById(T1, created.id)
    expect(back).toEqual(created)
  })

  it('un segundo insert con el mismo trainerId+nameNormalized → ExerciseNameTakenError (RF-6)', async () => {
    await repo.insert(draft({ nameNormalized: 'press-banca' }))
    await expect(repo.insert(draft({ nameNormalized: 'press-banca' }))).rejects.toBeInstanceOf(
      ExerciseNameTakenError,
    )
  })

  it('otro entrenador puede usar el mismo nombre normalizado', async () => {
    await repo.insert(draft({ nameNormalized: 'remo', trainerId: T1 }))
    await expect(
      repo.insert(draft({ nameNormalized: 'remo', trainerId: T2 })),
    ).resolves.toBeTruthy()
  })

  it('findById y listByTrainer están acotados al trainerId (RF-2)', async () => {
    const mine = await repo.insert(draft({ nameNormalized: 'zancada', trainerId: T1 }))
    expect(await repo.findById(T2, mine.id)).toBeNull()

    const list1 = await repo.listByTrainer(T1)
    expect(list1.every((e) => e.trainerId === T1)).toBe(true)
    expect(list1.some((e) => e.id === mine.id)).toBe(true)
  })

  it('update reemplaza los campos y deleteById elimina', async () => {
    const ex = await repo.insert(draft({ nameNormalized: 'peso-muerto' }))
    await repo.update({ ...ex, name: 'Peso Muerto Rumano', nameNormalized: 'peso-muerto-rumano' })
    const updated = await repo.findById(T1, ex.id)
    expect(updated?.name).toBe('Peso Muerto Rumano')

    await repo.deleteById(T1, ex.id)
    expect(await repo.findById(T1, ex.id)).toBeNull()
  })

  it('el validador de BD rechaza un documento con un campo de prescripción (P6, RF-5)', async () => {
    await expect(
      ctx.db.collection(EXERCISES_COLLECTION).insertOne({
        _id: new ObjectId(),
        trainerId: new ObjectId(),
        name: 'X',
        nameNormalized: `x-${new ObjectId().toHexString()}`,
        sets: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).rejects.toThrow()
  })
})
