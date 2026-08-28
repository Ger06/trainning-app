import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectMongo, type MongoConnection } from '@/infra/db/mongo-client'
import { MIGRATIONS_COLLECTION, runMigrations } from '@/infra/db/migrations/migrate'
import type { Migration } from '@/infra/db/migrations/types'

const uri = process.env.MONGODB_URI

// Se ejecuta sólo si hay un MongoDB real accesible (T5 estandariza el harness).
describe.skipIf(!uri)('T2 · runner de migraciones (integración)', () => {
  let conn: MongoConnection
  const calls: string[] = []

  const migrations: Migration[] = [
    {
      name: '0001-alpha',
      up: async (db) => {
        calls.push('0001-alpha')
        await db.createCollection('alpha')
      },
    },
    {
      name: '0002-beta',
      up: async (db) => {
        calls.push('0002-beta')
        await db.createCollection('beta')
      },
    },
  ]

  beforeAll(async () => {
    conn = await connectMongo(uri as string, `ent_test_${randomUUID().slice(0, 8)}`)
  })

  afterAll(async () => {
    if (conn) {
      await conn.db.dropDatabase()
      await conn.close()
    }
  })

  it('aplica todas las migraciones pendientes y las registra en _migrations', async () => {
    const result = await runMigrations(conn.db, migrations)

    expect(result.applied).toEqual(['0001-alpha', '0002-beta'])
    expect(result.skipped).toEqual([])
    expect(calls).toEqual(['0001-alpha', '0002-beta'])

    const recorded = await conn.db
      .collection(MIGRATIONS_COLLECTION)
      .find({}, { projection: { _id: 0, name: 1 } })
      .sort({ name: 1 })
      .toArray()
    expect(recorded.map((r) => r.name)).toEqual(['0001-alpha', '0002-beta'])

    const names = await conn.db.listCollections().toArray()
    expect(names.map((c) => c.name).sort()).toEqual(
      expect.arrayContaining(['alpha', 'beta']),
    )
  })

  it('una segunda ejecución no aplica nada (idempotente)', async () => {
    calls.length = 0
    const result = await runMigrations(conn.db, migrations)

    expect(result.applied).toEqual([])
    expect(result.skipped).toEqual(['0001-alpha', '0002-beta'])
    expect(calls).toEqual([])

    const count = await conn.db.collection(MIGRATIONS_COLLECTION).countDocuments()
    expect(count).toBe(2)
  })

  it('aplica sólo la nueva cuando se añade una migración al conjunto', async () => {
    calls.length = 0
    const extended: Migration[] = [
      ...migrations,
      {
        name: '0003-gamma',
        up: async (db) => {
          calls.push('0003-gamma')
          await db.createCollection('gamma')
        },
      },
    ]

    const result = await runMigrations(conn.db, extended)

    expect(result.applied).toEqual(['0003-gamma'])
    expect(result.skipped).toEqual(['0001-alpha', '0002-beta'])
    expect(calls).toEqual(['0003-gamma'])
  })
})
