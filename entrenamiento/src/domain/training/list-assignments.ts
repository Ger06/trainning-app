import type { Assignment } from './assignment'
import type { AssignmentRepository } from './ports'

/**
 * Caso de uso: listar las asignaciones del entrenador para un alumno —la vista
 * de su mesociclo— (constitución P3). RF-2 (solo las del `trainerId`), RF-18.
 */

export interface ListAssignmentsInput {
  trainerId: string
  studentId: string
  week?: number
}

export interface ListAssignmentsDeps {
  assignments: AssignmentRepository
}

export function listAssignments(
  input: ListAssignmentsInput,
  deps: ListAssignmentsDeps,
): Promise<readonly Assignment[]> {
  return deps.assignments.listByStudent(input.trainerId, input.studentId, input.week)
}
