/**
 * Entidad Rutina (una sesión de entrenamiento) y su estructura de bloques
 * (constitución P3). RF-10..RF-14 y RF-13b: la rutina es una lista ordenada de
 * bloques; cada bloque agrupa ejercicios en orden, se repite `rounds` veces y
 * fija por ejercicio series, repeticiones y/o tiempo, y los cuatro descansos
 * (entre series, tras el ejercicio, entre rondas y entre bloques).
 *
 * La rutina referencia ejercicios **por id** (vínculo vivo hasta asignar, RF-9).
 * Las factorías `newRoutine()` / `routine()` congelan todos los niveles y
 * validan la forma mínima (≥ 1 bloque, ≥ 1 ejercicio, rondas/series ≥ 1, algún
 * modo de trabajo); la validación con incidencias por campo vive en
 * `parse-routine` (T13).
 */

export const MIN_NAME_LENGTH = 2

export interface BlockExercise {
  readonly exerciseId: string
  readonly sets: number
  readonly reps?: number
  readonly timeSec?: number
  readonly restBetweenSetsSec: number
  /** Transición hasta el siguiente ejercicio de la ronda; 0 si es el último (RF-13). */
  readonly restAfterExerciseSec: number
  readonly note?: string
}

export interface Block {
  readonly exercises: readonly BlockExercise[]
  readonly rounds: number
  readonly restBetweenRoundsSec: number
  readonly restAfterBlockSec?: number
}

export interface NewRoutine {
  readonly trainerId: string
  readonly name: string
  /** Derivado de `name` para la unicidad por entrenador (RF-16). */
  readonly nameNormalized: string
  readonly note?: string
  readonly blocks: readonly Block[]
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface Routine extends NewRoutine {
  readonly id: string
}

interface RoutineData {
  trainerId: string
  name: string
  nameNormalized: string
  note?: string
  blocks: readonly Block[]
  createdAt: Date
  updatedAt: Date
}

function freezeBlockExercise(e: BlockExercise): BlockExercise {
  return Object.freeze({
    exerciseId: e.exerciseId,
    sets: e.sets,
    ...(e.reps !== undefined ? { reps: e.reps } : {}),
    ...(e.timeSec !== undefined ? { timeSec: e.timeSec } : {}),
    restBetweenSetsSec: e.restBetweenSetsSec,
    restAfterExerciseSec: e.restAfterExerciseSec,
    ...(e.note !== undefined ? { note: e.note } : {}),
  })
}

function freezeBlock(b: Block): Block {
  return Object.freeze({
    exercises: Object.freeze(b.exercises.map(freezeBlockExercise)),
    rounds: b.rounds,
    restBetweenRoundsSec: b.restBetweenRoundsSec,
    ...(b.restAfterBlockSec !== undefined ? { restAfterBlockSec: b.restAfterBlockSec } : {}),
  })
}

function assertShape(name: string, blocks: readonly Block[]): void {
  if (name.trim().length < MIN_NAME_LENGTH) {
    throw new Error(`el nombre de la rutina debe tener al menos ${MIN_NAME_LENGTH} caracteres`)
  }
  if (blocks.length < 1) {
    throw new Error('la rutina necesita al menos un bloque')
  }
  for (const b of blocks) {
    if (b.exercises.length < 1) {
      throw new Error('cada bloque necesita al menos un ejercicio')
    }
    if (!Number.isInteger(b.rounds) || b.rounds < 1) {
      throw new Error('las rondas del bloque deben ser un entero ≥ 1')
    }
    for (const e of b.exercises) {
      if (!Number.isInteger(e.sets) || e.sets < 1) {
        throw new Error('las series del ejercicio deben ser un entero ≥ 1')
      }
      if (e.reps === undefined && e.timeSec === undefined) {
        throw new Error('el ejercicio necesita repeticiones y/o tiempo de ejecución')
      }
    }
  }
}

function buildBlocks(blocks: readonly Block[]): readonly Block[] {
  const frozen = Object.freeze(blocks.map(freezeBlock))
  return frozen
}

/** Datos de una rutina nueva (aún sin `id`), listos para insertar. */
export function newRoutine(data: RoutineData): NewRoutine {
  const blocks = buildBlocks(data.blocks)
  assertShape(data.name, blocks)
  return Object.freeze({
    trainerId: data.trainerId,
    name: data.name,
    nameNormalized: data.nameNormalized,
    ...(data.note !== undefined ? { note: data.note } : {}),
    blocks,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  })
}

/** Reconstruye una rutina ya persistida (con `id`). */
export function routine(data: RoutineData & { id: string }): Routine {
  const blocks = buildBlocks(data.blocks)
  assertShape(data.name, blocks)
  return Object.freeze({
    id: data.id,
    trainerId: data.trainerId,
    name: data.name,
    nameNormalized: data.nameNormalized,
    ...(data.note !== undefined ? { note: data.note } : {}),
    blocks,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  })
}
