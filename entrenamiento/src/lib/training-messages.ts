import { assertNever, type AnyTrainingError } from '@/domain/training/errors'

/**
 * T21 · Único módulo con la copia que ve la persona para el dominio de
 * entrenamiento. Los route handlers no llevan literales de estos textos (RF-29).
 *
 * `[NECESITA ACLARACIÓN]` (spec.md): idioma de los mensajes (el repo tiene
 * es/en). Provisional: español (plan 002, D13). Si se decide i18n, se enchufa el
 * catálogo aquí sin tocar los casos de uso.
 */
export const TRAINING_MESSAGES = {
  invalidInput: 'revisá los datos ingresados',
  exerciseNameTaken: 'ya tenés un ejercicio con ese nombre',
  routineNameTaken: 'ya tenés una rutina con ese nombre',
  exerciseInUse: 'no se puede borrar: alguna rutina usa este ejercicio',
  exerciseNotFound: 'ese ejercicio no existe en tu catálogo',
  routineNotFound: 'esa rutina no existe',
  assignmentNotFound: 'esa asignación no existe',
  studentNotFound: 'no existe una cuenta con ese usuario; podés darla de alta',
  usernameBelongsToTrainer: 'ese nombre de usuario es de un entrenador',
  forbidden: 'necesitás una cuenta de entrenador para esto',
  unauthenticated: 'no hay una sesión activa',
  /** Aviso (no error) que el handler devuelve al sobrescribir un slot (RF-26, RF-29). */
  slotOverwritten: 'ese día ya tenía una rutina asignada; se reemplazó',
} as const

export function messageForTrainingError(error: AnyTrainingError): string {
  switch (error.kind) {
    case 'InvalidTrainingInput':
      // Rutina/bloque sin contenido, ejercicio sin repeticiones ni tiempo,
      // valores fuera de rango y contraseña inicial corta: un mensaje + `issues`.
      return TRAINING_MESSAGES.invalidInput
    case 'ExerciseNameTaken':
      return TRAINING_MESSAGES.exerciseNameTaken
    case 'RoutineNameTaken':
      return TRAINING_MESSAGES.routineNameTaken
    case 'ExerciseInUse':
      return TRAINING_MESSAGES.exerciseInUse
    case 'ExerciseNotFound':
      return TRAINING_MESSAGES.exerciseNotFound
    case 'RoutineNotFound':
      return TRAINING_MESSAGES.routineNotFound
    case 'AssignmentNotFound':
      return TRAINING_MESSAGES.assignmentNotFound
    case 'StudentNotFound':
      return TRAINING_MESSAGES.studentNotFound
    case 'UsernameBelongsToTrainer':
      return TRAINING_MESSAGES.usernameBelongsToTrainer
    case 'Forbidden':
      return TRAINING_MESSAGES.forbidden
    case 'Unauthenticated':
      return TRAINING_MESSAGES.unauthenticated
    default:
      return assertNever(error)
  }
}
