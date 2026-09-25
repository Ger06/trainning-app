import { err, ok, type Result } from '../shared/result'
import {
  ExerciseNotFoundError,
  InvalidTrainingInputError,
  RoutineNameTakenError,
  RoutineNotFoundError,
} from './errors'
import { parseRoutineDraft } from './parse-routine'
import type { Clock, ExerciseRepository, RoutineRepository } from './ports'
import { referencedExerciseIds } from './create-routine'
import { routine, type Routine } from './routine'

/**
 * Caso de uso: edición de una rutina propia (constitución P3). RF-2 (solo el
 * dueño), RF-17 (bloques, orden y prescripción editables). **No** recibe un
 * puerto de asignaciones: editar una rutina no altera las asignaciones ya
 * emitidas (guardan un snapshot, RF-24).
 */

export interface UpdateRoutineInput {
  trainerId: string
  id: string
  name?: unknown
  note?: unknown
  blocks?: unknown
}

export interface UpdateRoutineDeps {
  routines: RoutineRepository
  exercises: ExerciseRepository
  clock: Clock
}

export type UpdateRoutineError =
  | InvalidTrainingInputError
  | RoutineNotFoundError
  | ExerciseNotFoundError
  | RoutineNameTakenError

export async function updateRoutine(
  input: UpdateRoutineInput,
  deps: UpdateRoutineDeps,
): Promise<Result<Routine, UpdateRoutineError>> {
  // RF-3: revalidar la entrada antes de nada.
  const parsed = parseRoutineDraft(input)
  if (!parsed.ok) {
    return parsed
  }
  const draft = parsed.value

  // RF-2: si no es del entrenador (o no existe), se comporta como inexistente.
  const current = await deps.routines.findById(input.trainerId, input.id)
  if (!current) {
    return err(new RoutineNotFoundError(input.id))
  }

  // RF-12: cada ejercicio referenciado debe existir en el catálogo del entrenador.
  for (const exerciseId of referencedExerciseIds(draft.blocks)) {
    const found = await deps.exercises.findById(input.trainerId, exerciseId)
    if (!found) {
      return err(new ExerciseNotFoundError(exerciseId))
    }
  }

  const updated = routine({
    id: current.id,
    trainerId: current.trainerId,
    name: draft.name,
    nameNormalized: draft.nameNormalized,
    ...(draft.note !== undefined ? { note: draft.note } : {}),
    blocks: draft.blocks,
    createdAt: current.createdAt,
    updatedAt: deps.clock.now(),
  })

  try {
    return ok(await deps.routines.update(updated))
  } catch (error) {
    if (error instanceof RoutineNameTakenError) {
      return err(error)
    }
    throw error
  }
}
