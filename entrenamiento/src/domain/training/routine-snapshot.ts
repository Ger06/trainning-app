import type { RoutineSnapshot, SnapshotBlock, SnapshotExercise } from './assignment'
import type { Exercise } from './exercise'
import type { Block, BlockExercise, Routine } from './routine'

/**
 * `snapshotRoutine` toma una instantánea **profundamente congelada** de una
 * rutina y de los datos de cada ejercicio referenciado (nombre y descripción),
 * tal como están en ese momento (RF-24, plan D3). La asignación guarda esta copia
 * y ninguna edición posterior de la rutina o del ejercicio la altera.
 *
 * Módulo puro (constitución P3): copia por valor, sin red ni persistencia.
 */

function snapshotExercise(
  be: BlockExercise,
  byId: Map<string, Exercise>,
): SnapshotExercise {
  const ex = byId.get(be.exerciseId)
  if (!ex) {
    throw new Error(`snapshotRoutine: falta el ejercicio ${be.exerciseId} del catálogo`)
  }
  return Object.freeze({
    exerciseId: be.exerciseId,
    name: ex.name,
    ...(ex.description !== undefined ? { description: ex.description } : {}),
    sets: be.sets,
    ...(be.reps !== undefined ? { reps: be.reps } : {}),
    ...(be.timeSec !== undefined ? { timeSec: be.timeSec } : {}),
    restBetweenSetsSec: be.restBetweenSetsSec,
    restAfterExerciseSec: be.restAfterExerciseSec,
    ...(be.note !== undefined ? { note: be.note } : {}),
  })
}

function snapshotBlock(b: Block, byId: Map<string, Exercise>): SnapshotBlock {
  return Object.freeze({
    exercises: Object.freeze(b.exercises.map((be) => snapshotExercise(be, byId))),
    rounds: b.rounds,
    restBetweenRoundsSec: b.restBetweenRoundsSec,
    ...(b.restAfterBlockSec !== undefined ? { restAfterBlockSec: b.restAfterBlockSec } : {}),
  })
}

export function snapshotRoutine(
  routine: Routine,
  exercises: readonly Exercise[],
): RoutineSnapshot {
  const byId = new Map(exercises.map((e) => [e.id, e]))
  return Object.freeze({
    routineId: routine.id,
    name: routine.name,
    ...(routine.note !== undefined ? { note: routine.note } : {}),
    blocks: Object.freeze(routine.blocks.map((b) => snapshotBlock(b, byId))),
  })
}
