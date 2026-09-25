import { ObjectId, type CollectionInfo } from 'mongodb'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { migrations } from '@/infra/db/migrations'
import {
  ASSIGNMENTS_COLLECTION,
  ASSIGNMENTS_SLOT_INDEX,
  EXERCISES_COLLECTION,
  EXERCISES_NAME_INDEX,
  ROUTINES_COLLECTION,
  ROUTINES_NAME_INDEX,
  TRAINER_CLIENT_LINKS_COLLECTION,
  TRAINER_CLIENT_LINKS_INDEX,
} from '@/infra/db/migrations/0003-training-collections'
import { runMigrations } from '@/infra/db/migrations/migrate'
import { hasMongo, setupIntegrationDb, type IntegrationContext } from './_harness'

describe.skipIf(!hasMongo)('T23 · migración 0003 colecciones de entrenamiento (integración)', () => {
  let ctx: IntegrationContext

  beforeAll(async () => {
    ctx = await setupIntegrationDb()
  })
  afterAll(async () => {
    await ctx.teardown()
  })

  const validExercise = () => ({
    _id: new ObjectId(),
    trainerId: new ObjectId(),
    name: 'Sentadilla',
    nameNormalized: `sentadilla-${new ObjectId().toHexString()}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  const validRoutineBlock = () => ({
    exercises: [
      {
        exerciseId: 'ex_1',
        sets: 3,
        reps: 10,
        restBetweenSetsSec: 90,
        restAfterExerciseSec: 0,
      },
    ],
    rounds: 2,
    restBetweenRoundsSec: 60,
  })

  it('crea las cuatro colecciones con validador $jsonSchema', async () => {
    for (const name of [
      EXERCISES_COLLECTION,
      ROUTINES_COLLECTION,
      ASSIGNMENTS_COLLECTION,
      TRAINER_CLIENT_LINKS_COLLECTION,
    ]) {
      const [info] = (await ctx.db.listCollections({ name }).toArray()) as CollectionInfo[]
      expect(info?.options?.validator?.$jsonSchema, `${name} sin validador`).toBeDefined()
    }
  })

  it('define los índices únicos esperados', async () => {
    const uniq = async (coll: string, indexName: string) => {
      const idx = (await ctx.db.collection(coll).indexes()).find((i) => i.name === indexName)
      expect(idx, `${coll}.${indexName}`).toBeDefined()
      expect(idx?.unique).toBe(true)
    }
    await uniq(EXERCISES_COLLECTION, EXERCISES_NAME_INDEX)
    await uniq(ROUTINES_COLLECTION, ROUTINES_NAME_INDEX)
    await uniq(ASSIGNMENTS_COLLECTION, ASSIGNMENTS_SLOT_INDEX)
    await uniq(TRAINER_CLIENT_LINKS_COLLECTION, TRAINER_CLIENT_LINKS_INDEX)
  })

  it('acepta documentos válidos', async () => {
    const trainerId = new ObjectId()
    await expect(
      ctx.db.collection(EXERCISES_COLLECTION).insertOne(validExercise()),
    ).resolves.toBeTruthy()
    await expect(
      ctx.db.collection(ROUTINES_COLLECTION).insertOne({
        _id: new ObjectId(),
        trainerId,
        name: 'Full A',
        nameNormalized: `full-a-${new ObjectId().toHexString()}`,
        blocks: [validRoutineBlock()],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ).resolves.toBeTruthy()
  })

  it('rechaza un campo no declarado (RF-5) y un weekday fuera del enum (RF-19)', async () => {
    await expect(
      ctx.db.collection(EXERCISES_COLLECTION).insertOne({ ...validExercise(), sets: 3 }),
    ).rejects.toThrow()

    await expect(
      ctx.db.collection(ASSIGNMENTS_COLLECTION).insertOne({
        _id: new ObjectId(),
        trainerId: new ObjectId(),
        studentId: new ObjectId(),
        week: 1,
        weekday: 'monday',
        routineSnapshot: {
          routineId: 'rt_1',
          name: 'Full A',
          blocks: [
            {
              exercises: [
                { exerciseId: 'ex_1', name: 'Sentadilla', sets: 3, restBetweenSetsSec: 0, restAfterExerciseSec: 0 },
              ],
              rounds: 1,
              restBetweenRoundsSec: 0,
            },
          ],
        },
        createdAt: new Date(),
      }),
    ).rejects.toThrow()
  })

  it('rechaza rondas 0 y una rutina sin bloques (RF-12, RF-15)', async () => {
    const base = {
      _id: new ObjectId(),
      trainerId: new ObjectId(),
      name: 'Rota',
      nameNormalized: `rota-${new ObjectId().toHexString()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await expect(
      ctx.db.collection(ROUTINES_COLLECTION).insertOne({
        ...base,
        blocks: [{ ...validRoutineBlock(), rounds: 0 }],
      }),
    ).rejects.toThrow()
    await expect(
      ctx.db.collection(ROUTINES_COLLECTION).insertOne({ ...base, _id: new ObjectId(), blocks: [] }),
    ).rejects.toThrow()
  })

  it('una segunda ejecución de las migraciones no aplica nada', async () => {
    const res = await runMigrations(ctx.db, migrations)
    expect(res.applied).toEqual([])
    expect(res.skipped).toEqual(expect.arrayContaining(['0003-training-collections']))
  })
})
