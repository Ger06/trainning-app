/**
 * Asignación de una rutina a un alumno en un slot `(semana, día)` y el snapshot
 * congelado de la rutina en el momento de asignar (constitución P3). RF-24 (copia
 * inmutable de rutina + datos de cada ejercicio), RF-26 (un slot, una rutina).
 *
 * `snapshotRoutine()` vive en `routine-snapshot.ts`; el repositorio en T26.
 */

import type { Weekday } from './slot'

export interface SnapshotExercise {
  readonly exerciseId: string
  /** Nombre y descripción del ejercicio tal como estaban al asignar. */
  readonly name: string
  readonly description?: string
  readonly sets: number
  readonly reps?: number
  readonly timeSec?: number
  readonly restBetweenSetsSec: number
  readonly restAfterExerciseSec: number
  readonly note?: string
}

export interface SnapshotBlock {
  readonly exercises: readonly SnapshotExercise[]
  readonly rounds: number
  readonly restBetweenRoundsSec: number
  readonly restAfterBlockSec?: number
}

export interface RoutineSnapshot {
  readonly routineId: string
  readonly name: string
  readonly note?: string
  readonly blocks: readonly SnapshotBlock[]
}

export interface NewAssignment {
  readonly trainerId: string
  readonly studentId: string
  readonly week: number
  readonly weekday: Weekday
  readonly routineSnapshot: RoutineSnapshot
  readonly createdAt: Date
}

export interface Assignment extends NewAssignment {
  readonly id: string
}

/** Datos de una asignación nueva (aún sin `id`). El snapshot ya viene congelado. */
export function newAssignment(data: NewAssignment): NewAssignment {
  return Object.freeze({ ...data })
}

/** Reconstruye una asignación ya persistida (con `id`). */
export function assignment(data: NewAssignment & { id: string }): Assignment {
  return Object.freeze({ ...data })
}
