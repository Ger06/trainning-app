import type { Db } from 'mongodb'
import {
  MAX_BLOCKS,
  MAX_DESCRIPTION_LENGTH,
  MAX_EXERCISE_NOTE_LENGTH,
  MAX_EXERCISES_PER_BLOCK,
  MAX_NAME_LENGTH,
  MAX_REPS,
  MAX_ROUNDS,
  MAX_SECONDS,
  MAX_SETS,
  MAX_WEEK,
} from '@/domain/training/limits'
import { WEEKDAYS } from '@/domain/training/slot'
import type { Migration } from './types'

/**
 * Esquemas y colecciones del contexto de entrenamiento (constitución P6).
 *
 * - `exercises` / `routines`: unicidad de nombre **por entrenador** (RF-6, RF-16)
 *   con índice `{ trainerId, nameNormalized }` único.
 * - `routines.blocks`: árbol totalmente descrito — `minItems`/`maxItems`,
 *   `additionalProperties:false`, `minimum`/`maximum` y `multipleOf:1` en los
 *   enteros (RF-12, RF-13, RF-13b). `bsonType:'number'` porque el driver guarda
 *   los enteros de JS como `double`.
 * - `assignments`: un slot, una rutina (RF-24, RF-26) con índice único
 *   `{ trainerId, studentId, week, weekday }`; `weekday` acotado al enum (RF-19);
 *   `routineSnapshot` embebido y cerrado (RF-24).
 * - `trainer_client_links`: vínculo idempotente (RF-22) con índice único
 *   `{ trainerId, studentId }`.
 *
 * Ids de referencia dentro de un documento (`exerciseId`, `routineId` del
 * snapshot) se guardan como `string`; solo `_id`, `trainerId` y `studentId` son
 * `objectId`.
 */

export const EXERCISES_COLLECTION = 'exercises'
export const EXERCISES_NAME_INDEX = 'uniq_trainer_exerciseName'
export const ROUTINES_COLLECTION = 'routines'
export const ROUTINES_NAME_INDEX = 'uniq_trainer_routineName'
export const ASSIGNMENTS_COLLECTION = 'assignments'
export const ASSIGNMENTS_SLOT_INDEX = 'uniq_trainer_student_slot'
export const TRAINER_CLIENT_LINKS_COLLECTION = 'trainer_client_links'
export const TRAINER_CLIENT_LINKS_INDEX = 'uniq_trainer_student'

const int = (min: number, max: number) => ({
  bsonType: 'number' as const,
  minimum: min,
  maximum: max,
  multipleOf: 1,
})

export const exercisesJsonSchema = {
  bsonType: 'object',
  additionalProperties: false,
  required: ['_id', 'trainerId', 'name', 'nameNormalized', 'createdAt', 'updatedAt'],
  properties: {
    _id: { bsonType: 'objectId' },
    trainerId: { bsonType: 'objectId' },
    name: { bsonType: 'string', minLength: 2, maxLength: MAX_NAME_LENGTH },
    nameNormalized: { bsonType: 'string', minLength: 2, maxLength: MAX_NAME_LENGTH },
    description: { bsonType: 'string', maxLength: MAX_DESCRIPTION_LENGTH },
    createdAt: { bsonType: 'date' },
    updatedAt: { bsonType: 'date' },
  },
}

const blockExerciseSchema = {
  bsonType: 'object',
  additionalProperties: false,
  required: ['exerciseId', 'sets', 'restBetweenSetsSec', 'restAfterExerciseSec'],
  properties: {
    exerciseId: { bsonType: 'string', minLength: 1 },
    sets: int(1, MAX_SETS),
    reps: int(1, MAX_REPS),
    timeSec: int(1, MAX_SECONDS),
    restBetweenSetsSec: int(0, MAX_SECONDS),
    restAfterExerciseSec: int(0, MAX_SECONDS),
    note: { bsonType: 'string', maxLength: MAX_EXERCISE_NOTE_LENGTH },
  },
}

const blockSchema = {
  bsonType: 'object',
  additionalProperties: false,
  required: ['exercises', 'rounds', 'restBetweenRoundsSec'],
  properties: {
    exercises: {
      bsonType: 'array',
      minItems: 1,
      maxItems: MAX_EXERCISES_PER_BLOCK,
      items: blockExerciseSchema,
    },
    rounds: int(1, MAX_ROUNDS),
    restBetweenRoundsSec: int(0, MAX_SECONDS),
    restAfterBlockSec: int(0, MAX_SECONDS),
  },
}

export const routinesJsonSchema = {
  bsonType: 'object',
  additionalProperties: false,
  required: ['_id', 'trainerId', 'name', 'nameNormalized', 'blocks', 'createdAt', 'updatedAt'],
  properties: {
    _id: { bsonType: 'objectId' },
    trainerId: { bsonType: 'objectId' },
    name: { bsonType: 'string', minLength: 2, maxLength: MAX_NAME_LENGTH },
    nameNormalized: { bsonType: 'string', minLength: 2, maxLength: MAX_NAME_LENGTH },
    note: { bsonType: 'string', maxLength: MAX_DESCRIPTION_LENGTH },
    blocks: { bsonType: 'array', minItems: 1, maxItems: MAX_BLOCKS, items: blockSchema },
    createdAt: { bsonType: 'date' },
    updatedAt: { bsonType: 'date' },
  },
}

const snapshotExerciseSchema = {
  bsonType: 'object',
  additionalProperties: false,
  required: ['exerciseId', 'name', 'sets', 'restBetweenSetsSec', 'restAfterExerciseSec'],
  properties: {
    exerciseId: { bsonType: 'string', minLength: 1 },
    name: { bsonType: 'string', minLength: 1 },
    description: { bsonType: 'string' },
    sets: int(1, MAX_SETS),
    reps: int(1, MAX_REPS),
    timeSec: int(1, MAX_SECONDS),
    restBetweenSetsSec: int(0, MAX_SECONDS),
    restAfterExerciseSec: int(0, MAX_SECONDS),
    note: { bsonType: 'string' },
  },
}

const snapshotBlockSchema = {
  bsonType: 'object',
  additionalProperties: false,
  required: ['exercises', 'rounds', 'restBetweenRoundsSec'],
  properties: {
    exercises: { bsonType: 'array', minItems: 1, items: snapshotExerciseSchema },
    rounds: int(1, MAX_ROUNDS),
    restBetweenRoundsSec: int(0, MAX_SECONDS),
    restAfterBlockSec: int(0, MAX_SECONDS),
  },
}

export const assignmentsJsonSchema = {
  bsonType: 'object',
  additionalProperties: false,
  required: ['_id', 'trainerId', 'studentId', 'week', 'weekday', 'routineSnapshot', 'createdAt'],
  properties: {
    _id: { bsonType: 'objectId' },
    trainerId: { bsonType: 'objectId' },
    studentId: { bsonType: 'objectId' },
    week: int(1, MAX_WEEK),
    weekday: { enum: [...WEEKDAYS] },
    routineSnapshot: {
      bsonType: 'object',
      additionalProperties: false,
      required: ['routineId', 'name', 'blocks'],
      properties: {
        routineId: { bsonType: 'string', minLength: 1 },
        name: { bsonType: 'string', minLength: 1 },
        note: { bsonType: 'string' },
        blocks: { bsonType: 'array', minItems: 1, items: snapshotBlockSchema },
      },
    },
    createdAt: { bsonType: 'date' },
  },
}

export const trainerClientLinksJsonSchema = {
  bsonType: 'object',
  additionalProperties: false,
  required: ['_id', 'trainerId', 'studentId', 'createdAt'],
  properties: {
    _id: { bsonType: 'objectId' },
    trainerId: { bsonType: 'objectId' },
    studentId: { bsonType: 'objectId' },
    createdAt: { bsonType: 'date' },
  },
}

async function applyValidator(
  db: Db,
  name: string,
  schema: Record<string, unknown>,
): Promise<void> {
  const exists = await db.listCollections({ name }).hasNext()
  const options = {
    validator: { $jsonSchema: schema },
    validationLevel: 'strict',
    validationAction: 'error',
  }
  if (exists) {
    await db.command({ collMod: name, ...options })
  } else {
    await db.createCollection(name, options)
  }
}

export const migration0003: Migration = {
  name: '0003-training-collections',
  async up(db: Db) {
    await applyValidator(db, EXERCISES_COLLECTION, exercisesJsonSchema)
    await applyValidator(db, ROUTINES_COLLECTION, routinesJsonSchema)
    await applyValidator(db, ASSIGNMENTS_COLLECTION, assignmentsJsonSchema)
    await applyValidator(db, TRAINER_CLIENT_LINKS_COLLECTION, trainerClientLinksJsonSchema)

    await db
      .collection(EXERCISES_COLLECTION)
      .createIndex({ trainerId: 1, nameNormalized: 1 }, { unique: true, name: EXERCISES_NAME_INDEX })
    await db
      .collection(ROUTINES_COLLECTION)
      .createIndex({ trainerId: 1, nameNormalized: 1 }, { unique: true, name: ROUTINES_NAME_INDEX })
    await db
      .collection(ASSIGNMENTS_COLLECTION)
      .createIndex(
        { trainerId: 1, studentId: 1, week: 1, weekday: 1 },
        { unique: true, name: ASSIGNMENTS_SLOT_INDEX },
      )
    await db
      .collection(TRAINER_CLIENT_LINKS_COLLECTION)
      .createIndex(
        { trainerId: 1, studentId: 1 },
        { unique: true, name: TRAINER_CLIENT_LINKS_INDEX },
      )
  },
}
