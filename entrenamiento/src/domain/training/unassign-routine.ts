import { err, ok, type Result } from '../shared/result'
import { AssignmentNotFoundError } from './errors'
import type { AssignmentRepository } from './ports'

/**
 * Caso de uso: quitar una asignación, dejando el slot vacío (constitución P3).
 * RF-2 (solo el dueño), RF-27 (quitar), RF-28 (sin ventana de bloqueo: `deps`
 * no lleva reloj ni chequeo de plazo).
 */

export interface UnassignRoutineInput {
  trainerId: string
  assignmentId: string
}

export interface UnassignRoutineDeps {
  assignments: AssignmentRepository
}

export type UnassignRoutineError = AssignmentNotFoundError

export async function unassignRoutine(
  input: UnassignRoutineInput,
  deps: UnassignRoutineDeps,
): Promise<Result<void, UnassignRoutineError>> {
  const removed = await deps.assignments.deleteOwned(input.trainerId, input.assignmentId)
  if (!removed) {
    return err(new AssignmentNotFoundError(input.assignmentId))
  }
  return ok(undefined)
}
