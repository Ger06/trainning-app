import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TRAINER_CLIENT_LINKS_COLLECTION } from '@/infra/db/migrations'
import { createMongoTrainerClientLinkRepository } from '@/infra/repositories/mongo-trainer-client-link-repository'
import { hasMongo, setupIntegrationDb, type IntegrationContext } from './_harness'

const T1 = new ObjectId().toHexString()
const S1 = new ObjectId().toHexString()
const S2 = new ObjectId().toHexString()

describe.skipIf(!hasMongo)('T27 · mongo-trainer-client-link-repository (integración)', () => {
  let ctx: IntegrationContext
  let repo: ReturnType<typeof createMongoTrainerClientLinkRepository>

  beforeAll(async () => {
    ctx = await setupIntegrationDb()
    repo = createMongoTrainerClientLinkRepository(ctx.db)
  })
  afterAll(async () => {
    await ctx.teardown()
  })

  it('ensureLink es idempotente: dos llamadas dejan una sola fila (RF-22)', async () => {
    await repo.ensureLink(T1, S1)
    await repo.ensureLink(T1, S1)
    const count = await ctx.db
      .collection(TRAINER_CLIENT_LINKS_COLLECTION)
      .countDocuments({ trainerId: new ObjectId(T1), studentId: new ObjectId(S1) })
    expect(count).toBe(1)
  })

  it('listStudents devuelve los alumnos vinculados al entrenador', async () => {
    await repo.ensureLink(T1, S1)
    await repo.ensureLink(T1, S2)
    const students = await repo.listStudents(T1)
    expect(new Set(students)).toEqual(new Set([S1, S2]))
    expect(await repo.listStudents(new ObjectId().toHexString())).toEqual([])
  })
})
