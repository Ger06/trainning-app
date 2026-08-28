import { ObjectId, type Collection, type Db } from 'mongodb'
import type { Clock, IdGenerator, SessionStore } from '@/domain/auth/ports'
import { isExpired, session, type Session } from '@/domain/auth/session'
import { SESSIONS_COLLECTION } from '@/infra/db/migrations'
import { MAX_AGE_SECONDS } from '@/infra/session/cookie-session'

/**
 * Adaptador de `SessionStore` sobre MongoDB (constitución P4). El estado vive en
 * la colección `sessions`, así que `revoke` invalida de verdad (RF‑15) y el
 * índice TTL limpia lo vencido (RF‑14). `_id` de sesión = string (UUID);
 * `accountId` se guarda como `ObjectId`.
 */

interface SessionDoc {
  _id: string
  accountId: ObjectId
  createdAt: Date
  expiresAt: Date
}

export interface MongoSessionRepositoryDeps {
  ids: IdGenerator
  clock: Clock
}

const toSession = (doc: SessionDoc): Session =>
  session({
    id: doc._id,
    accountId: doc.accountId.toHexString(),
    expiresAt: doc.expiresAt,
  })

export function createMongoSessionRepository(
  db: Db,
  { ids, clock }: MongoSessionRepositoryDeps,
): SessionStore {
  const collection: Collection<SessionDoc> = db.collection<SessionDoc>(SESSIONS_COLLECTION)

  return {
    async issue(accountId) {
      const now = clock.now()
      const doc: SessionDoc = {
        _id: ids.newId(),
        accountId: new ObjectId(accountId),
        createdAt: now,
        // RF‑14 / RF‑16: caducidad uniforme, la constante única de T17.
        expiresAt: new Date(now.getTime() + MAX_AGE_SECONDS * 1000),
      }
      await collection.insertOne(doc)
      return toSession(doc)
    },

    async get(id) {
      const doc = await collection.findOne({ _id: id })
      if (!doc) return null
      const found = toSession(doc)
      // RF‑14: una sesión vencida cuenta como ausente aunque el TTL no la haya barrido.
      return isExpired(found, clock.now()) ? null : found
    },

    async revoke(id) {
      await collection.deleteOne({ _id: id })
    },
  }
}
