import { ObjectId, type Collection, type Db } from 'mongodb'
import { RoutineNameTakenError } from '@/domain/training/errors'
import type { RoutineRepository } from '@/domain/training/ports'
import { routine, type Block, type NewRoutine, type Routine } from '@/domain/training/routine'
import { ROUTINES_COLLECTION } from '@/infra/db/migrations'
import { isDuplicateKeyError } from '@/infra/db/migrations/migrate'

/**
 * Adaptador de `RoutineRepository` sobre MongoDB (constitución P4). El árbol
 * `blocks` se guarda tal cual (ids de ejercicio como `string`). Índice único
 * `{ trainerId, nameNormalized }` → `RoutineNameTakenError` (RF-16).
 * `anyUsesExercise` recorre `blocks.exercises.exerciseId` (RF-8).
 */

interface RoutineDoc {
  _id: ObjectId
  trainerId: ObjectId
  name: string
  nameNormalized: string
  note?: string
  blocks: readonly Block[]
  createdAt: Date
  updatedAt: Date
}

const toRoutine = (doc: RoutineDoc): Routine =>
  routine({
    id: doc._id.toHexString(),
    trainerId: doc.trainerId.toHexString(),
    name: doc.name,
    nameNormalized: doc.nameNormalized,
    ...(doc.note !== undefined ? { note: doc.note } : {}),
    blocks: doc.blocks,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  })

const bodyOf = (data: NewRoutine) => ({
  trainerId: new ObjectId(data.trainerId),
  name: data.name,
  nameNormalized: data.nameNormalized,
  ...(data.note !== undefined ? { note: data.note } : {}),
  // copia plana y mutable (los bloques del dominio están congelados).
  blocks: structuredClone(data.blocks) as Block[],
  createdAt: data.createdAt,
  updatedAt: data.updatedAt,
})

export function createMongoRoutineRepository(db: Db): RoutineRepository {
  const collection: Collection<RoutineDoc> = db.collection<RoutineDoc>(ROUTINES_COLLECTION)

  return {
    async insert(data) {
      const _id = new ObjectId()
      try {
        await collection.insertOne({ _id, ...bodyOf(data) } as RoutineDoc)
      } catch (error) {
        if (isDuplicateKeyError(error)) throw new RoutineNameTakenError(data.name)
        throw error
      }
      return routine({ id: _id.toHexString(), ...data })
    },

    async findById(trainerId, id) {
      if (!ObjectId.isValid(id) || !ObjectId.isValid(trainerId)) return null
      const doc = await collection.findOne({
        _id: new ObjectId(id),
        trainerId: new ObjectId(trainerId),
      })
      return doc ? toRoutine(doc) : null
    },

    async listByTrainer(trainerId) {
      if (!ObjectId.isValid(trainerId)) return []
      const docs = await collection
        .find({ trainerId: new ObjectId(trainerId) })
        .sort({ createdAt: 1, _id: 1 })
        .toArray()
      return docs.map(toRoutine)
    },

    async update(updated) {
      try {
        await collection.replaceOne(
          { _id: new ObjectId(updated.id), trainerId: new ObjectId(updated.trainerId) },
          bodyOf(updated),
        )
      } catch (error) {
        if (isDuplicateKeyError(error)) throw new RoutineNameTakenError(updated.name)
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

    async anyUsesExercise(trainerId, exerciseId) {
      if (!ObjectId.isValid(trainerId)) return false
      const count = await collection.countDocuments(
        { trainerId: new ObjectId(trainerId), 'blocks.exercises.exerciseId': exerciseId },
        { limit: 1 },
      )
      return count > 0
    },
  }
}
