import { ObjectId, type Collection, type Db } from 'mongodb'
import { account, type Account, type NewAccount } from '@/domain/auth/account'
import type { Role } from '@/domain/auth/credentials'
import { UsernameTakenError } from '@/domain/auth/errors'
import type { AccountRepository } from '@/domain/auth/ports'
import { isDuplicateKeyError } from '@/infra/db/migrations/migrate'
import { ACCOUNTS_COLLECTION } from '@/infra/db/migrations'

/**
 * Adaptador de `AccountRepository` sobre MongoDB (constitución P4: el driver sólo
 * vive aquí). Traduce entre el documento (`_id: ObjectId`) y la entidad de
 * dominio (`id: string`). No expone ninguna forma de modificar `role` (RF‑7).
 */

interface AccountDoc {
  _id: ObjectId
  username: string
  usernameNormalized: string
  role: Role
  passwordHash: string
  createdAt: Date
}

const toAccount = (doc: AccountDoc): Account =>
  account({
    id: doc._id.toHexString(),
    username: doc.username,
    usernameNormalized: doc.usernameNormalized,
    role: doc.role,
    passwordHash: doc.passwordHash,
    createdAt: doc.createdAt,
  })

export function createMongoAccountRepository(db: Db): AccountRepository {
  const collection: Collection<AccountDoc> = db.collection<AccountDoc>(ACCOUNTS_COLLECTION)

  return {
    async findByNormalizedUsername(usernameNormalized) {
      const doc = await collection.findOne({ usernameNormalized })
      return doc ? toAccount(doc) : null
    },

    async findById(id) {
      if (!ObjectId.isValid(id)) return null
      const doc = await collection.findOne({ _id: new ObjectId(id) })
      return doc ? toAccount(doc) : null
    },

    async insert(data: NewAccount) {
      const _id = new ObjectId()
      try {
        await collection.insertOne({
          _id,
          username: data.username,
          usernameNormalized: data.usernameNormalized,
          role: data.role,
          passwordHash: data.passwordHash,
          createdAt: data.createdAt,
        })
      } catch (error) {
        // RF‑5: el índice único perdió la carrera con otra alta simultánea.
        if (isDuplicateKeyError(error)) {
          throw new UsernameTakenError(data.username)
        }
        throw error
      }
      return account({ id: _id.toHexString(), ...data })
    },
  }
}
