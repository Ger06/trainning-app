import type { Exercise } from './exercise'
import type { ExerciseRepository } from './ports'

/**
 * Caso de uso: listar el catálogo de ejercicios del entrenador (constitución
 * P3). RF-2: solo los del `trainerId` indicado.
 */

export interface ListExercisesDeps {
  exercises: ExerciseRepository
}

export function listExercises(
  trainerId: string,
  deps: ListExercisesDeps,
): Promise<readonly Exercise[]> {
  return deps.exercises.listByTrainer(trainerId)
}
