import { err, ok, type Result } from '../shared/result'
import { RoutineNotFoundError } from './errors'
import type { RoutineRepository } from './ports'

/**
 * Caso de uso: baja de una rutina propia (constitución P3). RF-2 (solo el
 * dueño), RF-17 (eliminar una rutina **no** altera las asignaciones ya emitidas
 * — por eso `deps` no lleva un puerto de asignaciones).
 */

export interface DeleteRoutineInput {
  trainerId: string
  id: string
}

export interface DeleteRoutineDeps {
  routines: RoutineRepository
}

export type DeleteRoutineError = RoutineNotFoundError

export async function deleteRoutine(
  input: DeleteRoutineInput,
  deps: DeleteRoutineDeps,
): Promise<Result<void, DeleteRoutineError>> {
  const current = await deps.routines.findById(input.trainerId, input.id)
  if (!current) {
    return err(new RoutineNotFoundError(input.id))
  }

  await deps.routines.deleteById(input.trainerId, input.id)
  return ok(undefined)
}
