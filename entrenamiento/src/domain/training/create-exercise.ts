import { err, ok, type Result } from '../shared/result'
import { ExerciseNameTakenError, InvalidTrainingInputError } from './errors'
import { newExercise, type Exercise } from './exercise'
import { parseExerciseInput } from './parse-exercise'
import type { Clock, ExerciseRepository } from './ports'

/**
 * Caso de uso: alta de un ejercicio en el catálogo del entrenador (constitución
 * P3: función pura de orquestación; toda dependencia entra por `deps`). RF-4, RF-6.
 */

export interface CreateExerciseInput {
  trainerId: string
  name?: unknown
  description?: unknown
}

export interface CreateExerciseDeps {
  exercises: ExerciseRepository
  clock: Clock
}

export type CreateExerciseError = InvalidTrainingInputError | ExerciseNameTakenError

export async function createExercise(
  input: CreateExerciseInput,
  deps: CreateExerciseDeps,
): Promise<Result<Exercise, CreateExerciseError>> {
  // RF-3: validación autoritativa antes de tocar nada externo.
  const parsed = parseExerciseInput(input)
  if (!parsed.ok) {
    return parsed
  }
  const fields = parsed.value

  const now = deps.clock.now()
  const draft = newExercise({
    trainerId: input.trainerId,
    name: fields.name,
    nameNormalized: fields.nameNormalized,
    ...(fields.description !== undefined ? { description: fields.description } : {}),
    createdAt: now,
    updatedAt: now,
  })

  try {
    // RF-6: la unicidad por catálogo la garantiza el índice único; el repo
    // traduce el choque a ExerciseNameTakenError.
    return ok(await deps.exercises.insert(draft))
  } catch (error) {
    if (error instanceof ExerciseNameTakenError) {
      return err(error)
    }
    throw error
  }
}
