import { describe, expect, it } from 'vitest'
import { MAX_WEEK } from '@/domain/training/limits'
import { WEEKDAYS } from '@/domain/training/slot'
import { migrations } from './index'
import { planMigrations } from './migrate'
import {
  ASSIGNMENTS_COLLECTION,
  EXERCISES_COLLECTION,
  ROUTINES_COLLECTION,
  TRAINER_CLIENT_LINKS_COLLECTION,
  assignmentsJsonSchema,
  exercisesJsonSchema,
  migration0003,
  routinesJsonSchema,
  trainerClientLinksJsonSchema,
} from './0003-training-collections'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const props = (s: any) => s.properties as Record<string, any>

describe('migración 0003 · colecciones de entrenamiento', () => {
  it('lleva el nombre versionado y se ordena tras 0002', () => {
    expect(migration0003.name).toBe('0003-training-collections')
    const done = new Set(['0001-accounts-schema-and-unique-index', '0002-sessions-schema-and-ttl-index'])
    const { toApply } = planMigrations(migrations, done)
    expect(toApply.map((m) => m.name)).toEqual(['0003-training-collections'])
    expect(migrations.map((m) => m.name)).toEqual([
      '0001-accounts-schema-and-unique-index',
      '0002-sessions-schema-and-ttl-index',
      '0003-training-collections',
    ])
  })

  it('los nombres de colección son los esperados', () => {
    expect([
      EXERCISES_COLLECTION,
      ROUTINES_COLLECTION,
      ASSIGNMENTS_COLLECTION,
      TRAINER_CLIENT_LINKS_COLLECTION,
    ]).toEqual(['exercises', 'routines', 'assignments', 'trainer_client_links'])
  })

  it('exercises: additionalProperties:false, required completo, sin prescripción (RF-5)', () => {
    expect(exercisesJsonSchema.additionalProperties).toBe(false)
    expect(exercisesJsonSchema.required).toEqual(
      expect.arrayContaining(['_id', 'trainerId', 'name', 'nameNormalized', 'createdAt', 'updatedAt']),
    )
    expect(Object.keys(props(exercisesJsonSchema))).not.toEqual(
      expect.arrayContaining(['sets', 'reps', 'rounds']),
    )
    expect(props(exercisesJsonSchema).name.minLength).toBe(2)
  })

  it('routines: árbol blocks totalmente descrito con minItems y minimum (RF-12, RF-13, RF-15)', () => {
    const blocks = props(routinesJsonSchema).blocks
    expect(blocks.bsonType).toBe('array')
    expect(blocks.minItems).toBe(1)
    const block = blocks.items
    expect(block.additionalProperties).toBe(false)
    expect(block.required).toEqual(expect.arrayContaining(['exercises', 'rounds', 'restBetweenRoundsSec']))
    expect(block.properties.rounds.minimum).toBe(1)
    expect(block.properties.rounds.multipleOf).toBe(1)

    const exs = block.properties.exercises
    expect(exs.minItems).toBe(1)
    const ex = exs.items
    expect(ex.additionalProperties).toBe(false)
    expect(ex.required).toEqual(
      expect.arrayContaining(['exerciseId', 'sets', 'restBetweenSetsSec', 'restAfterExerciseSec']),
    )
    expect(ex.properties.sets.minimum).toBe(1)
    expect(ex.properties.restBetweenSetsSec.minimum).toBe(0)
    // los cuatro descansos existen como campos distintos (RF-13b)
    expect(ex.properties.restAfterExerciseSec).toBeDefined()
    expect(block.properties.restBetweenRoundsSec).toBeDefined()
    expect(block.properties.restAfterBlockSec).toBeDefined()
  })

  it('assignments: weekday acotado al enum, week entera 1..MAX_WEEK, snapshot cerrado (RF-19, RF-24, RF-26)', () => {
    expect(assignmentsJsonSchema.additionalProperties).toBe(false)
    expect(props(assignmentsJsonSchema).weekday.enum).toEqual([...WEEKDAYS])
    expect(props(assignmentsJsonSchema).week).toMatchObject({ minimum: 1, maximum: MAX_WEEK, multipleOf: 1 })
    const snap = props(assignmentsJsonSchema).routineSnapshot
    expect(snap.additionalProperties).toBe(false)
    expect(snap.required).toEqual(expect.arrayContaining(['routineId', 'name', 'blocks']))
    expect(snap.properties.blocks.items.properties.exercises.items.required).toEqual(
      expect.arrayContaining(['exerciseId', 'name', 'sets']),
    )
  })

  it('trainer_client_links: documento mínimo y cerrado (RF-22)', () => {
    expect(trainerClientLinksJsonSchema.additionalProperties).toBe(false)
    expect(trainerClientLinksJsonSchema.required).toEqual(
      expect.arrayContaining(['_id', 'trainerId', 'studentId', 'createdAt']),
    )
  })
})
