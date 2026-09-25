import type { Assignment, NewAssignment } from './assignment'
import type { Exercise, NewExercise } from './exercise'
import type { NewRoutine, Routine } from './routine'

/**
 * Puertos del dominio de entrenamiento (constitución P3 y P4). **Solo tipos**:
 * las implementaciones concretas (MongoDB, cuentas de la spec 001) viven en
 * `src/infra` y se ensamblan en el composition root (T30). Este archivo no
 * importa `mongodb` ni `react`.
 */

export interface ExerciseRepository {
  /**
   * Persiste un ejercicio nuevo y devuelve el resultante (con `id`).
   * @throws `ExerciseNameTakenError` si el índice único `{trainerId,
   *   nameNormalized}` lo rechaza — nombre repetido en el catálogo (RF-6).
   */
  insert(data: NewExercise): Promise<Exercise>
  /** El ejercicio del entrenador con ese `id`, o `null` (RF-2). */
  findById(trainerId: string, id: string): Promise<Exercise | null>
  /** El catálogo completo del entrenador (RF-2). */
  listByTrainer(trainerId: string): Promise<readonly Exercise[]>
  /** Reemplaza un ejercicio que el llamador ya verificó como propio (RF-7). */
  update(exercise: Exercise): Promise<Exercise>
  /** Borra el ejercicio del entrenador; el llamador ya comprobó que no está en uso (RF-8). */
  deleteById(trainerId: string, id: string): Promise<void>
}

export interface RoutineRepository {
  /**
   * Persiste una rutina nueva.
   * @throws `RoutineNameTakenError` si el índice único `{trainerId,
   *   nameNormalized}` lo rechaza (RF-16).
   */
  insert(data: NewRoutine): Promise<Routine>
  findById(trainerId: string, id: string): Promise<Routine | null>
  listByTrainer(trainerId: string): Promise<readonly Routine[]>
  update(routine: Routine): Promise<Routine>
  deleteById(trainerId: string, id: string): Promise<void>
  /** ¿Alguna rutina del entrenador referencia ese ejercicio? (RF-8). */
  anyUsesExercise(trainerId: string, exerciseId: string): Promise<boolean>
}

export interface AssignmentRepository {
  /**
   * Coloca la asignación en su slot `(trainerId, studentId, week, weekday)`,
   * reemplazando la que hubiera. Devuelve la asignación creada y la previa
   * (`replaced` es `null` si el slot estaba libre) (RF-24, RF-26).
   */
  replaceForSlot(
    data: NewAssignment,
  ): Promise<{ readonly created: Assignment; readonly replaced: Assignment | null }>
  /** Asignaciones del entrenador para ese alumno (y semana, si se indica) (RF-2, RF-18). */
  listByStudent(
    trainerId: string,
    studentId: string,
    week?: number,
  ): Promise<readonly Assignment[]>
  /** Borra una asignación propia. `false` si no existe o no es del entrenador (RF-2, RF-27). */
  deleteOwned(trainerId: string, assignmentId: string): Promise<boolean>
}

export interface TrainerClientLinkRepository {
  /** Registra el vínculo entrenador–alumno si no existía. Idempotente (RF-22). */
  ensureLink(trainerId: string, studentId: string): Promise<void>
  /** Ids de los alumnos vinculados al entrenador (RF-22). */
  listStudents(trainerId: string): Promise<readonly string[]>
}

export interface AccountLookup {
  /** La cuenta con ese nombre de usuario, o `null` si no existe (RF-21). */
  findByUsername(
    username: string,
  ): Promise<{ readonly id: string; readonly role: 'entrenador' | 'alumno' } | null>
  /**
   * Da de alta un alumno con esas credenciales y devuelve su `id`. **No** emite
   * sesión (RF-21b). Valida los mínimos de la spec 001.
   * @throws `InvalidTrainingInputError` si el usuario o la contraseña no cumplen.
   */
  createAlumno(input: {
    readonly username: string
    readonly password: string
  }): Promise<{ readonly id: string }>
}

export interface Clock {
  now(): Date
}

export interface IdGenerator {
  newId(): string
}
