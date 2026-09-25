import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GET as healthGet } from '@/app/api/health/route'
import { ACCOUNTS_COLLECTION, SESSIONS_COLLECTION, MIGRATIONS_COLLECTION } from '@/infra/db/migrations'
import { hasMongo, setupIntegrationDb, type IntegrationContext } from './_harness'

// Ejemplo del harness: BD única → migraciones → fetch a una ruta → limpieza.
describe.skipIf(!hasMongo)('T5 · harness de integración', () => {
  let ctx: IntegrationContext

  beforeAll(async () => {
    ctx = await setupIntegrationDb()
  })

  afterAll(async () => {
    await ctx.teardown()
  })

  it('crea una BD única para la ejecución', () => {
    expect(ctx.dbName).toMatch(/^ent_it_[0-9a-f]{12}$/)
  })

  it('deja las migraciones aplicadas en esa BD', async () => {
    const names = (await ctx.db.listCollections().toArray()).map((c) => c.name)
    expect(names).toEqual(
      expect.arrayContaining([ACCOUNTS_COLLECTION, SESSIONS_COLLECTION, MIGRATIONS_COLLECTION]),
    )
  })

  it('permite ejercitar una ruta de la app contra esa BD', async () => {
    const res = await healthGet(new Request('http://localhost/api/health'))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ status: 'ok', db: 'up' })
  })

  it('teardown borra la BD efímera', async () => {
    // Se comprueba en un segundo contexto para no interferir con afterAll.
    const temp = await setupIntegrationDb()
    const { dbName } = temp
    await temp.teardown()

    const admin = ctx.db.admin()
    const { databases } = await admin.listDatabases({ nameOnly: true })
    expect(databases.map((d) => d.name)).not.toContain(dbName)
  })
})
