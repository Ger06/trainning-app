import type { Db } from 'mongodb'
import type { Migration } from './types'

export const SESSIONS_COLLECTION = 'sessions'
export const SESSIONS_TTL_INDEX = 'ttl_expiresAt'

/**
 * Esquema del documento de sesión (constitución P6). `_id` es el id de sesión
 * (UUID) que viaja firmado en la cookie; `expiresAt` es el instante absoluto de
 * caducidad. `additionalProperties:false` mantiene el documento mínimo.
 */
export const sessionsJsonSchema = {
  bsonType: 'object',
  additionalProperties: false,
  required: ['_id', 'accountId', 'createdAt', 'expiresAt'],
  properties: {
    _id: { bsonType: 'string', minLength: 1 },
    accountId: { bsonType: 'objectId' },
    createdAt: { bsonType: 'date' },
    expiresAt: { bsonType: 'date' },
  },
}

export const migration0002: Migration = {
  name: '0002-sessions-schema-and-ttl-index',
  async up(db: Db) {
    const exists = await db.listCollections({ name: SESSIONS_COLLECTION }).hasNext()
    const validatorOptions = {
      validator: { $jsonSchema: sessionsJsonSchema },
      validationLevel: 'strict',
      validationAction: 'error',
    }

    if (exists) {
      await db.command({ collMod: SESSIONS_COLLECTION, ...validatorOptions })
    } else {
      await db.createCollection(SESSIONS_COLLECTION, validatorOptions)
    }

    // RF‑14: la sesión desaparece en el instante `expiresAt` (TTL con
    // expireAfterSeconds:0). Qué valor escribe la app en `expiresAt` (tope de
    // sesión) sigue `[NECESITA ACLARACIÓN]` en spec.md; el índice ya queda listo.
    await db
      .collection(SESSIONS_COLLECTION)
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: SESSIONS_TTL_INDEX })
  },
}
