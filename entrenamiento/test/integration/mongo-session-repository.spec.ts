import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Clock } from '@/domain/auth/ports'
import { SESSIONS_COLLECTION } from '@/infra/db/migrations'
import { MAX_AGE_SECONDS } from '@/infra/session/cookie-session'
import { createMongoSessionRepository } from '@/infra/repositories/mongo-session-repository'
import { uuidIdGenerator } from '@/infra/system'
import { hasMongo, setupIntegrationDb, type IntegrationContext } from './_harness'

describe.skipIf(!hasMongo)('T19 · mongo-session-repository (integración)', () => {
  let ctx: IntegrationContext
  let clockNow: Date
  const clock: Clock = { now: () => clockNow }
  let repo: ReturnType<typeof createMongoSessionRepository>
  const accountId = new ObjectId().toHexString()

  const rawSessions = () =>
    ctx.db.collection<{ _id: string; accountId: ObjectId; createdAt: Date; expiresAt: Date }>(
      SESSIONS_COLLECTION,
    )

  beforeAll(async () => {
    ctx = await setupIntegrationDb()
    repo = createMongoSessionRepository(ctx.db, { ids: uuidIdGenerator, clock })
  })

  afterAll(async () => {
    await ctx.teardown()
  })

  it('issue crea el documento y devuelve la Session (RF-10, RF-14)', async () => {
    clockNow = new Date('2026-08-27T10:00:00.000Z')
    const s = await repo.issue(accountId)

    expect(s.accountId).toBe(accountId)
    expect(s.expiresAt.getTime()).toBe(clockNow.getTime() + MAX_AGE_SECONDS * 1000)

    const raw = await rawSessions().findOne({ _id: s.id })
    expect(raw?.accountId).toBeInstanceOf(ObjectId)
    expect(raw?.createdAt).toEqual(clockNow)
    expect(raw?.expiresAt).toEqual(s.expiresAt)
  })

  it('expiresAt queda lejos en el futuro (RF-14)', async () => {
    clockNow = new Date('2026-08-27T10:00:00.000Z')
    const s = await repo.issue(accountId)
    const days = (s.expiresAt.getTime() - clockNow.getTime()) / (24 * 60 * 60 * 1000)
    expect(days).toBeGreaterThanOrEqual(30)
  })

  it('get devuelve la sesión vigente', async () => {
    clockNow = new Date('2026-08-27T10:00:00.000Z')
    const s = await repo.issue(accountId)
    const got = await repo.get(s.id)
    expect(got?.id).toBe(s.id)
    expect(got?.accountId).toBe(accountId)
  })

  it('get devuelve null si el id no existe', async () => {
    expect(await repo.get('inexistente')).toBeNull()
  })

  it('get trata una sesión vencida como ausente aunque el doc siga en Mongo (RF-14)', async () => {
    clockNow = new Date('2026-08-27T10:00:00.000Z')
    const s = await repo.issue(accountId)

    clockNow = new Date(s.expiresAt.getTime() + 1000)
    expect(await repo.get(s.id)).toBeNull()

    const raw = await rawSessions().findOne({ _id: s.id })
    expect(raw).not.toBeNull() // el TTL no la barrió todavía; get la filtra igual
  })

  it('revoke elimina la sesión y es idempotente (RF-15)', async () => {
    clockNow = new Date('2026-08-27T10:00:00.000Z')
    const s = await repo.issue(accountId)

    await repo.revoke(s.id)
    expect(await repo.get(s.id)).toBeNull()
    expect(await rawSessions().countDocuments({ _id: s.id })).toBe(0)

    await expect(repo.revoke(s.id)).resolves.toBeUndefined()
    await expect(repo.revoke('nunca-existió')).resolves.toBeUndefined()
  })
})
