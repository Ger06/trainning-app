import { randomUUID } from 'node:crypto'
import { ObjectId, type CollectionInfo } from 'mongodb'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectMongo, type MongoConnection } from '@/infra/db/mongo-client'
import { MIGRATIONS_COLLECTION, runMigrations } from '@/infra/db/migrations/migrate'
import { migrations } from '@/infra/db/migrations'
import {
  SESSIONS_COLLECTION,
  SESSIONS_TTL_INDEX,
} from '@/infra/db/migrations/0002-sessions-schema-and-ttl-index'

const uri = process.env.MONGODB_URI

describe.skipIf(!uri)('T4 · migración 0002 sessions (integración)', () => {
  let conn: MongoConnection

  const validDoc = () => ({
    _id: randomUUID(),
    accountId: new ObjectId(),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
  })

  const sessions = () => conn.db.collection(SESSIONS_COLLECTION)
  // `sessions._id` es un string (UUID), no un ObjectId; y los tests negativos
  // insertan documentos deliberadamente inválidos.
  const insertSession = (doc: Record<string, unknown>) =>
    conn.db.collection(SESSIONS_COLLECTION).insertOne(doc as never)

  beforeAll(async () => {
    conn = await connectMongo(uri as string, `ent_test_${randomUUID().slice(0, 8)}`)
    await runMigrations(conn.db, migrations)
  })

  afterAll(async () => {
    if (conn) {
      await conn.db.dropDatabase()
      await conn.close()
    }
  })

  it('crea la colección sessions con validador $jsonSchema', async () => {
    const [info] = (await conn.db
      .listCollections({ name: SESSIONS_COLLECTION })
      .toArray()) as CollectionInfo[]
    if (!info) throw new Error('la colección sessions no existe tras migrar')

    const schema = info.options?.validator?.$jsonSchema as {
      additionalProperties?: boolean
      required?: string[]
    }
    expect(schema).toBeDefined()
    expect(schema.additionalProperties).toBe(false)
    expect(schema.required ?? []).toEqual(
      expect.arrayContaining(['_id', 'accountId', 'createdAt', 'expiresAt']),
    )
  })

  it('define un índice TTL sobre expiresAt (RF-14)', async () => {
    const indexes = await sessions().indexes()
    const idx = indexes.find((i) => i.name === SESSIONS_TTL_INDEX)
    expect(idx).toBeDefined()
    expect(idx?.key?.expiresAt).toBe(1)
    expect((idx as { expireAfterSeconds?: number }).expireAfterSeconds).toBe(0)
  })

  it('acepta un documento de sesión válido', async () => {
    const res = await insertSession(validDoc())
    expect(res.acknowledged).toBe(true)
  })

  it('rechaza un documento con un campo no declarado', async () => {
    await expect(insertSession({ ...validDoc(), userAgent: 'x' })).rejects.toThrow()
  })

  it('rechaza expiresAt que no sea date (RF-14)', async () => {
    await expect(insertSession({ ...validDoc(), expiresAt: 12_345 })).rejects.toThrow()
  })

  it('el libro mayor registra 0001 y 0002 en orden', async () => {
    const recorded = await conn.db
      .collection(MIGRATIONS_COLLECTION)
      .find({}, { projection: { _id: 0, name: 1 } })
      .sort({ name: 1 })
      .toArray()
    expect(recorded.map((r) => r.name)).toEqual([
      '0001-accounts-schema-and-unique-index',
      '0002-sessions-schema-and-ttl-index',
    ])
  })
})
