/**
 * Errores del dominio de entrenamiento (constitución P3: módulo puro, sin React,
 * sin red y sin driver de BD). Son clases con una etiqueta `kind`, así sirven
 * tanto para `throw` / `instanceof` como para un `switch` exhaustivo sobre el
 * discriminante.
 *
 * Los textos de `Error.message` son internos (logs y depuración). La copia que
 * ve la persona vive en el módulo de mensajes (T21) — idioma `[NECESITA
 * ACLARACIÓN]` en spec.md.
 */

export type TrainingErrorKind =
  | 'InvalidTrainingInput'
  | 'ExerciseNameTaken'
  | 'RoutineNameTaken'
  | 'ExerciseInUse'
  | 'ExerciseNotFound'
  | 'RoutineNotFound'
  | 'AssignmentNotFound'
  | 'StudentNotFound'
  | 'UsernameBelongsToTrainer'
  | 'Forbidden'
  | 'Unauthenticated'

export type TrainingInputCode =
  | 'required'
  | 'too_short'
  | 'too_long'
  | 'out_of_range'
  | 'invalid_value'
  | 'empty'

export interface TrainingInputIssue {
  /** Ruta del campo: `name`, `blocks.0.rounds`, `blocks.1.exercises.2.reps`, … */
  readonly field: string
  readonly code: TrainingInputCode
}

export abstract class TrainingError extends Error {
  abstract readonly kind: TrainingErrorKind

  protected constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

/** RF-3, RF-4, RF-10..RF-15, RF-19: uno o más campos no cumplen las reglas. */
export class InvalidTrainingInputError extends TrainingError {
  readonly kind = 'InvalidTrainingInput' as const

  constructor(readonly issues: readonly TrainingInputIssue[]) {
    super(`invalid input (${issues.map((i) => `${i.field}:${i.code}`).join(', ')})`)
  }
}

/** RF-6: el catálogo del entrenador ya tiene un ejercicio con ese nombre. */
export class ExerciseNameTakenError extends TrainingError {
  readonly kind = 'ExerciseNameTaken' as const

  constructor(readonly exerciseName: string) {
    super('exercise name already in catalog')
  }
}

/** RF-16: el entrenador ya tiene una rutina con ese nombre. */
export class RoutineNameTakenError extends TrainingError {
  readonly kind = 'RoutineNameTaken' as const

  constructor(readonly routineName: string) {
    super('routine name already in use')
  }
}

/** RF-8: no se puede borrar el ejercicio porque alguna rutina lo referencia. */
export class ExerciseInUseError extends TrainingError {
  readonly kind = 'ExerciseInUse' as const

  constructor(readonly exerciseId: string) {
    super('exercise referenced by at least one routine')
  }
}

/** RF-2 / RF-12: el ejercicio no está en el catálogo del entrenador. */
export class ExerciseNotFoundError extends TrainingError {
  readonly kind = 'ExerciseNotFound' as const

  constructor(readonly exerciseId: string) {
    super('exercise not found in trainer catalog')
  }
}

/** RF-2, RF-17, RF-20: la rutina no existe o no es del entrenador. */
export class RoutineNotFoundError extends TrainingError {
  readonly kind = 'RoutineNotFound' as const

  constructor(readonly routineId: string) {
    super('routine not found')
  }
}

/** RF-2, RF-27: la asignación no existe o no es del entrenador. */
export class AssignmentNotFoundError extends TrainingError {
  readonly kind = 'AssignmentNotFound' as const

  constructor(readonly assignmentId: string) {
    super('assignment not found')
  }
}

/** RF-21: no hay ninguna cuenta con ese nombre de usuario; procede ofrecer alta. */
export class StudentNotFoundError extends TrainingError {
  readonly kind = 'StudentNotFound' as const

  constructor(readonly username: string) {
    super('no account with that username')
  }
}

/** RF-23: ese nombre de usuario pertenece a una cuenta de entrenador. */
export class UsernameBelongsToTrainerError extends TrainingError {
  readonly kind = 'UsernameBelongsToTrainer' as const

  constructor(readonly username: string) {
    super('username belongs to a trainer account')
  }
}

/** RF-1: la cuenta autenticada no tiene rol `entrenador`. */
export class ForbiddenError extends TrainingError {
  readonly kind = 'Forbidden' as const

  constructor() {
    super('trainer role required')
  }
}

/** RF-1: no hay sesión válida. */
export class UnauthenticatedError extends TrainingError {
  readonly kind = 'Unauthenticated' as const

  constructor() {
    super('authentication required')
  }
}

export type AnyTrainingError =
  | InvalidTrainingInputError
  | ExerciseNameTakenError
  | RoutineNameTakenError
  | ExerciseInUseError
  | ExerciseNotFoundError
  | RoutineNotFoundError
  | AssignmentNotFoundError
  | StudentNotFoundError
  | UsernameBelongsToTrainerError
  | ForbiddenError
  | UnauthenticatedError

export function isTrainingError(value: unknown): value is AnyTrainingError {
  return value instanceof TrainingError
}

/** Fuerza la exhaustividad de un `switch` sobre `AnyTrainingError`. */
export function assertNever(value: never): never {
  throw new Error(`unhandled TrainingError variant: ${String(value)}`)
}
