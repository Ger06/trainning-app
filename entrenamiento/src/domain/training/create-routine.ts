import { err, ok, type Result } from '../shared/result'
import { ExerciseNotFoundError, InvalidTrainingInputError, RoutineNameTakenError } from './errors'
import { parseRoutineDraft } from './parse-routine'
import type { Clock, ExerciseRepository, RoutineRepository } from './ports'
import { newRoutine, type Routine } from './routine'

/**
 * Caso de uso: alta de una rutina del entrenador (constitución P3: función pura
 * de orquestación). RF-2, RF-12 (los `exerciseId` son del catálogo), RF-15
 * (contenido no vacío, vía `parseRoutineDraft`), RF-16 (nombre único).
 */

export interface CreateRoutineInput {
  trainerId: string
  name?: unknown
  note?: unknown
  blocks?: unknown
}

export interface CreateRoutineDeps {
  routines: RoutineRepository
  exercises: ExerciseRepository
  clock: Clock
}

export type CreateRoutineError =
  | InvalidTrainingInputError
  | ExerciseNotFoundError
  | RoutineNameTakenError

/** Ids de ejercicio referenciados por una rutina, en orden de aparición y sin repetir. */
export function referencedExerciseIds(blocks: Routine['blocks']): readonly string[] {
  const seen = new Set<string>()
  for (const b of blocks) {
    for (const e of b.exercises) seen.add(e.exerciseId)
  }
  return [...seen]
}

export async function createRoutine(
  input: CreateRoutineInput,
  deps: CreateRoutineDeps,
): Promise<Result<Routine, CreateRoutineError>> {
  // RF-3: validación autoritativa antes de tocar nada externo.
  const parsed = parseRoutineDraft(input)
  if (!parsed.ok) {
    return parsed
  }
  const draft = parsed.value

  // RF-12: cada ejercicio referenciado debe existir en el catálogo del entrenador.
  for (const exerciseId of referencedExerciseIds(draft.blocks)) {
    const found = await deps.exercises.findById(input.trainerId, exerciseId)
    if (!found) {
      return err(new ExerciseNotFoundError(exerciseId))
    }
  }

  const now = deps.clock.now()
  const routineDraft = newRoutine({
    trainerId: input.trainerId,
    name: draft.name,
    nameNormalized: draft.nameNormalized,
    ...(draft.note !== undefined ? { note: draft.note } : {}),
    blocks: draft.blocks,
    createdAt: now,
    updatedAt: now,
  })

  try {
    // RF-16: la unicidad por entrenador la garantiza el índice único.
    return ok(await deps.routines.insert(routineDraft))
  } catch (error) {
    if (error instanceof RoutineNameTakenError) {
      return err(error)
    }
    throw error
  }
}
