import { err, ok, type Result } from '../shared/result'
import { ExerciseInUseError, ExerciseNotFoundError } from './errors'
import type { ExerciseRepository, RoutineRepository } from './ports'

/**
 * Caso de uso: baja de un ejercicio del catálogo (constitución P3). RF-2 (solo
 * el dueño), RF-8 (solo si ninguna rutina lo referencia).
 */

export interface DeleteExerciseInput {
  trainerId: string
  id: string
}

export interface DeleteExerciseDeps {
  exercises: ExerciseRepository
  routines: RoutineRepository
}

export type DeleteExerciseError = ExerciseNotFoundError | ExerciseInUseError

export async function deleteExercise(
  input: DeleteExerciseInput,
  deps: DeleteExerciseDeps,
): Promise<Result<void, DeleteExerciseError>> {
  // RF-2: si no es del entrenador (o no existe), se comporta como inexistente.
  const current = await deps.exercises.findById(input.trainerId, input.id)
  if (!current) {
    return err(new ExerciseNotFoundError(input.id))
  }

  // RF-8: las asignaciones ya emitidas guardan un snapshot y no cuentan (RF-24).
  if (await deps.routines.anyUsesExercise(input.trainerId, input.id)) {
    return err(new ExerciseInUseError(input.id))
  }

  await deps.exercises.deleteById(input.trainerId, input.id)
  return ok(undefined)
}
