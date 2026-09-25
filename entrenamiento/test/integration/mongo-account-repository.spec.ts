import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { UsernameTakenError } from '@/domain/auth/errors'
import type { NewAccount } from '@/domain/auth/account'
import { ACCOUNTS_COLLECTION } from '@/infra/db/migrations'
import { createMongoAccountRepository } from '@/infra/repositories/mongo-account-repository'
import { hasMongo, setupIntegrationDb, type IntegrationContext } from './_harness'

const draft = (over: Partial<NewAccount> = {}): NewAccount => ({
  username: 'Ana',
  usernameNormalized: 'ana',
  role: 'alumno',
  passwordHash: 'scrypt$16384$8$1$c2FsdHNhbHQ$aGFzaGhhc2g',
  createdAt: new Date('2026-08-27T10:00:00.000Z'),
  ...over,
})

describe.skipIf(!hasMongo)('T18 · mongo-account-repository (integración)', () => {
  let ctx: IntegrationContext
  let repo: ReturnType<typeof createMongoAccountRepository>

  beforeAll(async () => {
    ctx = await setupIntegrationDb()
    repo = createMongoAccountRepository(ctx.db)
  })

  afterAll(async () => {
    await ctx.teardown()
  })

  it('insert persiste el documento con usernameNormalized y sin campo password (RF-8)', async () => {
    const created = await repo.insert(draft({ usernameNormalized: 'ana-1' }))
    expect(created.id).toMatch(/^[0-9a-f]{24}$/)

    const raw = await ctx.db.collection(ACCOUNTS_COLLECTION).findOne({ usernameNormalized: 'ana-1' })
    expect(raw?.passwordHash).toBe(draft().passwordHash)
    expect(raw).not.toHaveProperty('password')
  })

  it('findByNormalizedUsername devuelve la Account mapeada', async () => {
    await repo.insert(draft({ username: 'Bruno', usernameNormalized: 'ana-2', role: 'entrenador' }))
    const found = await repo.findByNormalizedUsername('ana-2')
    expect(found).not.toBeNull()
    expect(found?.username).toBe('Bruno')
    expect(found?.role).toBe('entrenador')
    expect(found?.id).toMatch(/^[0-9a-f]{24}$/)
  })

  it('findByNormalizedUsername devuelve null si no existe', async () => {
    expect(await repo.findByNormalizedUsername('no-existe')).toBeNull()
  })

  it('un segundo insert con el mismo usernameNormalized lanza UsernameTakenError (RF-5)', async () => {
    await repo.insert(draft({ usernameNormalized: 'ana-3' }))
    await expect(repo.insert(draft({ username: 'Otra', usernameNormalized: 'ana-3' }))).rejects.toBeInstanceOf(
      UsernameTakenError,
    )
    await expect(
      repo.insert(draft({ username: 'Otra', usernameNormalized: 'ana-3' })),
    ).rejects.toMatchObject({ username: 'Otra' })
  })

  it('no expone ninguna operación de actualización de role (RF-7)', () => {
    expect(Object.keys(repo).sort()).toEqual(['findById', 'findByNormalizedUsername', 'insert'])
  })
})
