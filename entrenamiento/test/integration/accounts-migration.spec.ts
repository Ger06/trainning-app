import { randomUUID } from 'node:crypto'
import { ObjectId, type CollectionInfo } from 'mongodb'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectMongo, type MongoConnection } from '@/infra/db/mongo-client'
import { runMigrations } from '@/infra/db/migrations/migrate'
import { migrations } from '@/infra/db/migrations'
import { ACCOUNTS_COLLECTION } from '@/infra/db/migrations/0001-accounts-schema-and-unique-index'

const uri = process.env.MONGODB_URI

// Se ejecuta sólo si hay un MongoDB real accesible.
describe.skipIf(!uri)('T3 · migración 0001 accounts (integración)', () => {
  let conn: MongoConnection

  const validDoc = () => ({
    _id: new ObjectId(),
    username: 'Ana',
    usernameNormalized: `ana-${randomUUID().slice(0, 8)}`,
    role: 'alumno',
    passwordHash: 'scrypt$16384$8$1$c2FsdHNhbHQ$aGFzaGhhc2g',
    createdAt: new Date(),
  })

  const accounts = () => conn.db.collection(ACCOUNTS_COLLECTION)

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

  it('crea la colección accounts con validador $jsonSchema', async () => {
    const [info] = (await conn.db
      .listCollections({ name: ACCOUNTS_COLLECTION })
      .toArray()) as CollectionInfo[]
    if (!info) throw new Error('la colección accounts no existe tras migrar')

    const schema = info.options?.validator?.$jsonSchema as {
      additionalProperties?: boolean
      required?: string[]
      properties?: Record<string, { enum?: string[] }>
    }
    expect(schema).toBeDefined()
    expect(schema.additionalProperties).toBe(false)
    expect(schema.properties?.role?.enum).toEqual(['entrenador', 'alumno'])
    expect(Object.keys(schema.properties ?? {})).not.toContain('password')
    expect(schema.required ?? []).not.toContain('password')
  })

  it('define un índice único sobre usernameNormalized (RF-5)', async () => {
    const indexes = await accounts().indexes()
    const idx = indexes.find((i) => i.key?.usernameNormalized === 1)
    expect(idx).toBeDefined()
    expect(idx?.unique).toBe(true)
  })

  it('acepta un documento de cuenta válido', async () => {
    const res = await accounts().insertOne(validDoc())
    expect(res.acknowledged).toBe(true)
  })

  it('rechaza un role fuera del enum (RF-2, RF-7)', async () => {
    await expect(accounts().insertOne({ ...validDoc(), role: 'admin' })).rejects.toThrow()
  })

  it('rechaza un documento con campo "password" (RF-8)', async () => {
    await expect(
      accounts().insertOne({ ...validDoc(), password: 'plaintext123' }),
    ).rejects.toThrow()
  })

  it('rechaza username por debajo del mínimo (RF-3)', async () => {
    await expect(accounts().insertOne({ ...validDoc(), username: 'a' })).rejects.toThrow()
  })

  it('rechaza passwordHash sin prefijo scrypt$ (RF-8)', async () => {
    await expect(
      accounts().insertOne({ ...validDoc(), passwordHash: 'plaintext' }),
    ).rejects.toThrow()
  })

  it('rechaza un segundo documento con el mismo usernameNormalized (RF-5)', async () => {
    const doc = validDoc()
    await accounts().insertOne(doc)
    await expect(
      accounts().insertOne({ ...validDoc(), usernameNormalized: doc.usernameNormalized }),
    ).rejects.toThrow()
  })
})
