import type { RoutineRepository } from './ports'
import type { Routine } from './routine'

/**
 * Caso de uso: listar las rutinas del entrenador (constitución P3). RF-2: solo
 * las del `trainerId` indicado.
 */

export interface ListRoutinesDeps {
  routines: RoutineRepository
}

export function listRoutines(
  trainerId: string,
  deps: ListRoutinesDeps,
): Promise<readonly Routine[]> {
  return deps.routines.listByTrainer(trainerId)
}
