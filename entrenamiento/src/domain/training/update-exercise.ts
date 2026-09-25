import { err, ok, type Result } from '../shared/result'
import {
  ExerciseNameTakenError,
  ExerciseNotFoundError,
  InvalidTrainingInputError,
} from './errors'
import { exercise, type Exercise } from './exercise'
import { parseExerciseInput } from './parse-exercise'
import type { Clock, ExerciseRepository } from './ports'

/**
 * Caso de uso: edición del nombre y la descripción de un ejercicio propio
 * (constitución P3). RF-2 (solo el dueño), RF-7 (nombre y descripción editables).
 */

export interface UpdateExerciseInput {
  trainerId: string
  id: string
  name?: unknown
  description?: unknown
}

export interface UpdateExerciseDeps {
  exercises: ExerciseRepository
  clock: Clock
}

export type UpdateExerciseError =
  | InvalidTrainingInputError
  | ExerciseNotFoundError
  | ExerciseNameTakenError

export async function updateExercise(
  input: UpdateExerciseInput,
  deps: UpdateExerciseDeps,
): Promise<Result<Exercise, UpdateExerciseError>> {
  // RF-3: revalidar la entrada antes de nada.
  const parsed = parseExerciseInput(input)
  if (!parsed.ok) {
    return parsed
  }
  const fields = parsed.value

  // RF-2: si no es del entrenador (o no existe), se comporta como inexistente.
  const current = await deps.exercises.findById(input.trainerId, input.id)
  if (!current) {
    return err(new ExerciseNotFoundError(input.id))
  }

  const updated = exercise({
    id: current.id,
    trainerId: current.trainerId,
    name: fields.name,
    nameNormalized: fields.nameNormalized,
    ...(fields.description !== undefined ? { description: fields.description } : {}),
    createdAt: current.createdAt,
    updatedAt: deps.clock.now(),
  })

  try {
    return ok(await deps.exercises.update(updated))
  } catch (error) {
    // RF-6: renombrar a un nombre ya usado en el catálogo.
    if (error instanceof ExerciseNameTakenError) {
      return err(error)
    }
    throw error
  }
}
