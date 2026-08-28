import type { Db } from 'mongodb'
import type { Migration } from './types'

export const ACCOUNTS_COLLECTION = 'accounts'
export const ACCOUNTS_USERNAME_INDEX = 'uniq_usernameNormalized'

/**
 * Esquema del documento de cuenta (constitución P6). `additionalProperties:false`
 * garantiza que RF‑8 se cumple a nivel de BD: no existe ni puede colarse un campo
 * `password`; sólo `passwordHash`, y con prefijo `scrypt$` (nunca texto claro).
 * `role` acotado al enum de RF‑2 / RF‑7. `username` con el mínimo de RF‑3.
 * (La longitud máxima y el charset siguen `[NECESITA ACLARACIÓN]` en spec.md.)
 */
export const accountsJsonSchema = {
  bsonType: 'object',
  additionalProperties: false,
  required: ['_id', 'username', 'usernameNormalized', 'role', 'passwordHash', 'createdAt'],
  properties: {
    _id: { bsonType: 'objectId' },
    username: { bsonType: 'string', minLength: 2 },
    usernameNormalized: { bsonType: 'string', minLength: 2 },
    role: { enum: ['entrenador', 'alumno'] },
    passwordHash: { bsonType: 'string', pattern: '^scrypt\\$' },
    createdAt: { bsonType: 'date' },
  },
}

export const migration0001: Migration = {
  name: '0001-accounts-schema-and-unique-index',
  async up(db: Db) {
    const exists = await db.listCollections({ name: ACCOUNTS_COLLECTION }).hasNext()
    const validatorOptions = {
      validator: { $jsonSchema: accountsJsonSchema },
      validationLevel: 'strict',
      validationAction: 'error',
    }

    if (exists) {
      await db.command({ collMod: ACCOUNTS_COLLECTION, ...validatorOptions })
    } else {
      await db.createCollection(ACCOUNTS_COLLECTION, validatorOptions)
    }

    // RF‑5: unicidad global del nombre de usuario, sobre el campo normalizado.
    await db
      .collection(ACCOUNTS_COLLECTION)
      .createIndex({ usernameNormalized: 1 }, { unique: true, name: ACCOUNTS_USERNAME_INDEX })
  },
}
