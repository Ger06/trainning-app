import { ObjectId, type Collection, type Db } from 'mongodb'
import type { TrainerClientLinkRepository } from '@/domain/training/ports'
import { TRAINER_CLIENT_LINKS_COLLECTION } from '@/infra/db/migrations'

/**
 * Adaptador de `TrainerClientLinkRepository` sobre MongoDB (constitución P4).
 * `ensureLink` es idempotente vía upsert sobre el índice único
 * `{ trainerId, studentId }` (RF-22). Provisional no exclusivo (plan D11): un
 * alumno puede tener varios entrenadores; el único punto de cambio es aquí.
 */

interface LinkDoc {
  _id: ObjectId
  trainerId: ObjectId
  studentId: ObjectId
  createdAt: Date
}

export function createMongoTrainerClientLinkRepository(db: Db): TrainerClientLinkRepository {
  const collection: Collection<LinkDoc> = db.collection<LinkDoc>(TRAINER_CLIENT_LINKS_COLLECTION)

  return {
    async ensureLink(trainerId, studentId) {
      await collection.updateOne(
        { trainerId: new ObjectId(trainerId), studentId: new ObjectId(studentId) },
        { $setOnInsert: { createdAt: new Date() } },
        { upsert: true },
      )
    },

    async listStudents(trainerId) {
      if (!ObjectId.isValid(trainerId)) return []
      const docs = await collection.find({ trainerId: new ObjectId(trainerId) }).toArray()
      return docs.map((d) => d.studentId.toHexString())
    },
  }
}
