import { ObjectId, type Collection, type Db } from 'mongodb'
import { assignment, type Assignment, type NewAssignment } from '@/domain/training/assignment'
import type { AssignmentRepository } from '@/domain/training/ports'
import type { RoutineSnapshot } from '@/domain/training/assignment'
import type { Weekday } from '@/domain/training/slot'
import { ASSIGNMENTS_COLLECTION } from '@/infra/db/migrations'

/**
 * Adaptador de `AssignmentRepository` sobre MongoDB (constitución P4). El índice
 * único `{ trainerId, studentId, week, weekday }` garantiza un slot, una rutina
 * (RF-26); `replaceForSlot` hace upsert y devuelve la creada y la previa
 * (RF-24, RF-26). `deleteOwned` filtra por `trainerId` (RF-2, RF-27).
 */

interface AssignmentDoc {
  _id: ObjectId
  trainerId: ObjectId
  studentId: ObjectId
  week: number
  weekday: Weekday
  routineSnapshot: RoutineSnapshot
  createdAt: Date
}

const toAssignment = (doc: AssignmentDoc): Assignment =>
  assignment({
    id: doc._id.toHexString(),
    trainerId: doc.trainerId.toHexString(),
    studentId: doc.studentId.toHexString(),
    week: doc.week,
    weekday: doc.weekday,
    routineSnapshot: doc.routineSnapshot,
    createdAt: doc.createdAt,
  })

const bodyOf = (data: NewAssignment) => ({
  trainerId: new ObjectId(data.trainerId),
  studentId: new ObjectId(data.studentId),
  week: data.week,
  weekday: data.weekday,
  routineSnapshot: structuredClone(data.routineSnapshot) as RoutineSnapshot,
  createdAt: data.createdAt,
})

export function createMongoAssignmentRepository(db: Db): AssignmentRepository {
  const collection: Collection<AssignmentDoc> = db.collection<AssignmentDoc>(ASSIGNMENTS_COLLECTION)

  return {
    async replaceForSlot(data) {
      const filter = {
        trainerId: new ObjectId(data.trainerId),
        studentId: new ObjectId(data.studentId),
        week: data.week,
        weekday: data.weekday,
      }
      const prev = await collection.findOne(filter)
      const res = await collection.replaceOne(filter, bodyOf(data), { upsert: true })
      const createdId = res.upsertedId ?? prev?._id
      if (!createdId) {
        throw new Error('replaceForSlot: no se obtuvo el _id de la asignación')
      }
      return {
        created: assignment({ id: createdId.toHexString(), ...data }),
        replaced: prev ? toAssignment(prev) : null,
      }
    },

    async listByStudent(trainerId, studentId, week) {
      if (!ObjectId.isValid(trainerId) || !ObjectId.isValid(studentId)) return []
      const docs = await collection
        .find({
          trainerId: new ObjectId(trainerId),
          studentId: new ObjectId(studentId),
          ...(week !== undefined ? { week } : {}),
        })
        .sort({ week: 1, weekday: 1 })
        .toArray()
      return docs.map(toAssignment)
    },

    async deleteOwned(trainerId, assignmentId) {
      if (!ObjectId.isValid(assignmentId) || !ObjectId.isValid(trainerId)) return false
      const res = await collection.deleteOne({
        _id: new ObjectId(assignmentId),
        trainerId: new ObjectId(trainerId),
      })
      return res.deletedCount === 1
    },
  }
}
