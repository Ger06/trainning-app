/**
 * Entidad Ejercicio del catálogo del entrenador (constitución P3: sin React, sin
 * red, sin `mongodb`). RF-4 (nombre obligatorio ≥ 2 caracteres + descripción
 * opcional); RF-5 (sin prescripción: series/repeticiones/tiempo/descanso/rondas
 * viven en la rutina). El repositorio (T24) traduce `_id` ↔ `id`.
 *
 * Las factorías `newExercise()` / `exercise()` congelan el objeto y validan el
 * mínimo de nombre; nunca dejan pasar un campo de prescripción (el tipo no lo
 * admite y la factoría solo copia los campos conocidos).
 */

export const MIN_NAME_LENGTH = 2

export interface NewExercise {
  readonly trainerId: string
  /** Nombre tal como lo tecleó el entrenador. */
  readonly name: string
  /** Derivado de `name` para la unicidad por catálogo (RF-6). */
  readonly nameNormalized: string
  readonly description?: string
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface Exercise extends NewExercise {
  readonly id: string
}

interface ExerciseData {
  trainerId: string
  name: string
  nameNormalized: string
  description?: string
  createdAt: Date
  updatedAt: Date
}

function assertName(name: string): void {
  if (name.trim().length < MIN_NAME_LENGTH) {
    throw new Error(`el nombre del ejercicio debe tener al menos ${MIN_NAME_LENGTH} caracteres`)
  }
}

/** Datos de un ejercicio nuevo (aún sin `id`), listos para insertar. */
export function newExercise(data: ExerciseData): NewExercise {
  assertName(data.name)
  return Object.freeze({
    trainerId: data.trainerId,
    name: data.name,
    nameNormalized: data.nameNormalized,
    ...(data.description !== undefined ? { description: data.description } : {}),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  })
}

/** Reconstruye un ejercicio ya persistido (con `id`). */
export function exercise(data: ExerciseData & { id: string }): Exercise {
  assertName(data.name)
  return Object.freeze({
    id: data.id,
    trainerId: data.trainerId,
    name: data.name,
    nameNormalized: data.nameNormalized,
    ...(data.description !== undefined ? { description: data.description } : {}),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  })
}
