import type { AnyTrainingError } from '@/domain/training/errors'
import { messageForTrainingError } from '@/lib/training-messages'
import { problem } from './problem'

/**
 * T22 · Traduce un error del dominio de entrenamiento a status + cuerpo
 * `problem` (RF-29). El código (`error`) es estable para clientes; el `message`
 * viene de `@/lib/training-messages`.
 */
const MAP: Record<AnyTrainingError['kind'], { status: number; code: string }> = {
  InvalidTrainingInput: { status: 422, code: 'invalid_input' },
  ExerciseNameTaken: { status: 409, code: 'exercise_name_taken' },
  RoutineNameTaken: { status: 409, code: 'routine_name_taken' },
  ExerciseInUse: { status: 409, code: 'exercise_in_use' },
  UsernameBelongsToTrainer: { status: 409, code: 'username_belongs_to_trainer' },
  StudentNotFound: { status: 409, code: 'student_not_found' },
  ExerciseNotFound: { status: 404, code: 'exercise_not_found' },
  RoutineNotFound: { status: 404, code: 'routine_not_found' },
  AssignmentNotFound: { status: 404, code: 'assignment_not_found' },
  Forbidden: { status: 403, code: 'forbidden' },
  Unauthenticated: { status: 401, code: 'unauthenticated' },
}

export function trainingErrorResponse(error: AnyTrainingError): Response {
  const { status, code } = MAP[error.kind]
  return problem(status, {
    error: code,
    message: messageForTrainingError(error),
    issues: error.kind === 'InvalidTrainingInput' ? error.issues : undefined,
  })
}
