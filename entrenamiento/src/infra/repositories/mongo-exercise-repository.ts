import { ObjectId, type Collection, type Db } from 'mongodb'
import { exercise, type Exercise, type NewExercise } from '@/domain/training/exercise'
import { ExerciseNameTakenError } from '@/domain/training/errors'
import type { ExerciseRepository } from '@/domain/training/ports'
import { EXERCISES_COLLECTION } from '@/infra/db/migrations'
import { isDuplicateKeyError } from '@/infra/db/migrations/migrate'

/**
 * Adaptador de `ExerciseRepository` sobre MongoDB (constitución P4: el driver
 * solo vive aquí). Traduce `_id`/`trainerId` (`ObjectId`) ↔ dominio (`string`).
 * El índice único `{ trainerId, nameNormalized }` → `ExerciseNameTakenError` (RF-6).
 */

interface ExerciseDoc {
  _id: ObjectId
  trainerId: ObjectId
  name: string
  nameNormalized: string
  description?: string
  createdAt: Date
  updatedAt: Date
}

const toExercise = (doc: ExerciseDoc): Exercise =>
  exercise({
    id: doc._id.toHexString(),
    trainerId: doc.trainerId.toHexString(),
    name: doc.name,
    nameNormalized: doc.nameNormalized,
    ...(doc.description !== undefined ? { description: doc.description } : {}),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  })

const bodyOf = (data: NewExercise) => ({
  trainerId: new ObjectId(data.trainerId),
  name: data.name,
  nameNormalized: data.nameNormalized,
  ...(data.description !== undefined ? { description: data.description } : {}),
  createdAt: data.createdAt,
  updatedAt: data.updatedAt,
})

export function createMongoExerciseRepository(db: Db): ExerciseRepository {
  const collection: Collection<ExerciseDoc> = db.collection<ExerciseDoc>(EXERCISES_COLLECTION)

  return {
    async insert(data) {
      const _id = new ObjectId()
      try {
        await collection.insertOne({ _id, ...bodyOf(data) } as ExerciseDoc)
      } catch (error) {
        if (isDuplicateKeyError(error)) throw new ExerciseNameTakenError(data.name)
        throw error
      }
      return exercise({ id: _id.toHexString(), ...data })
    },

    async findById(trainerId, id) {
      if (!ObjectId.isValid(id) || !ObjectId.isValid(trainerId)) return null
      const doc = await collection.findOne({
        _id: new ObjectId(id),
        trainerId: new ObjectId(trainerId),
      })
      return doc ? toExercise(doc) : null
    },

    async listByTrainer(trainerId) {
      if (!ObjectId.isValid(trainerId)) return []
      const docs = await collection
        .find({ trainerId: new ObjectId(trainerId) })
        .sort({ createdAt: 1, _id: 1 })
        .toArray()
      return docs.map(toExercise)
    },

    async update(updated) {
      try {
        await collection.replaceOne(
          { _id: new ObjectId(updated.id), trainerId: new ObjectId(updated.trainerId) },
          bodyOf(updated),
        )
      } catch (error) {
        if (isDuplicateKeyError(error)) throw new ExerciseNameTakenError(updated.name)
        throw error
      }
      return updated
    },

    async deleteById(trainerId, id) {
      if (!ObjectId.isValid(id) || !ObjectId.isValid(trainerId)) return
      await collection.deleteOne({
        _id: new ObjectId(id),
        trainerId: new ObjectId(trainerId),
      })
    },
  }
}
