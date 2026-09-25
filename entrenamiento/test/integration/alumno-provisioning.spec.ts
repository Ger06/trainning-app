import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { newAccount } from '@/domain/auth/account'
import { InvalidTrainingInputError } from '@/domain/training/errors'
import { SESSIONS_COLLECTION } from '@/infra/db/migrations'
import { createAlumnoProvisioning } from '@/infra/auth/alumno-provisioning'
import { createMongoAccountRepository } from '@/infra/repositories/mongo-account-repository'
import { scryptPasswordHasher } from '@/infra/security/scrypt-password-hasher'
import { hasMongo, setupIntegrationDb, type IntegrationContext } from './_harness'

describe.skipIf(!hasMongo)('T28 · alumno-provisioning (integración)', () => {
  let ctx: IntegrationContext
  let lookup: ReturnType<typeof createAlumnoProvisioning>

  beforeAll(async () => {
    ctx = await setupIntegrationDb()
    lookup = createAlumnoProvisioning(ctx.db)
  })
  afterAll(async () => {
    await ctx.teardown()
  })

  it('findByUsername resuelve una cuenta existente y devuelve null si no existe (RF-21)', async () => {
    const accounts = createMongoAccountRepository(ctx.db)
    await accounts.insert(
      newAccount({
        username: 'Ana',
        usernameNormalized: 'ana',
        role: 'alumno',
        passwordHash: await scryptPasswordHasher.hash('contrasena8'),
        createdAt: new Date(),
      }),
    )
    expect(await lookup.findByUsername('  ANA ')).toMatchObject({ role: 'alumno' })
    expect(await lookup.findByUsername('nadie')).toBeNull()
  })

  it('createAlumno da de alta con rol alumno y hash, y NO crea sesión (RF-21b)', async () => {
    const { id } = await lookup.createAlumno({ username: 'marta', password: 'contrasena8' })
    const account = await createMongoAccountRepository(ctx.db).findById(id)
    expect(account?.role).toBe('alumno')
    expect(account?.passwordHash.startsWith('scrypt$')).toBe(true)
    expect(await ctx.db.collection(SESSIONS_COLLECTION).countDocuments({})).toBe(0)
  })

  it('createAlumno con contraseña corta → InvalidTrainingInputError (RF-21b)', async () => {
    await expect(
      lookup.createAlumno({ username: 'pepe', password: 'corta' }),
    ).rejects.toBeInstanceOf(InvalidTrainingInputError)
  })
})
