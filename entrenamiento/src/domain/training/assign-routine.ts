import { err, ok, type Result } from '../shared/result'
import { newAssignment, type Assignment } from './assignment'
import { referencedExerciseIds } from './create-routine'
import {
  ExerciseNotFoundError,
  InvalidTrainingInputError,
  RoutineNotFoundError,
  isTrainingError,
  type TrainingInputIssue,
} from './errors'
import type { Exercise } from './exercise'
import type {
  AccountLookup,
  AssignmentRepository,
  Clock,
  ExerciseRepository,
  RoutineRepository,
  TrainerClientLinkRepository,
} from './ports'
import type { Routine } from './routine'
import { snapshotRoutine } from './routine-snapshot'
import { parseSlot, type Slot } from './slot'

/**
 * Caso de uso: asignar una rutina a uno o varios alumnos y a uno o varios slots
 * `(semana, día)` (constitución P3). RF-18, RF-20, RF-21, RF-21b, RF-21c, RF-22,
 * RF-23, RF-24, RF-25, RF-26.
 *
 * Errores globales (abortan todo): rutina inexistente/ajena, slots o
 * destinatarios mal formados, rutina sin contenido, ejercicio referenciado que
 * ya no existe. Los problemas por destinatario **no** abortan el lote: van a
 * `needsConfirmation` o `rejected` (RF-21c).
 */

export interface RecipientInput {
  readonly username: string
  readonly confirmarAlta?: boolean
  readonly passwordInicial?: string
}

export interface AssignRoutineInput {
  trainerId: string
  routineId: string
  /** Array de `RecipientInput`; se valida la forma (RF-3). */
  recipients: unknown
  /** Array de `{ week, weekday }`; cada slot se valida con `parseSlot` (RF-19). */
  slots: unknown
}

export interface AssignRoutineDeps {
  routines: RoutineRepository
  exercises: ExerciseRepository
  assignments: AssignmentRepository
  links: TrainerClientLinkRepository
  accounts: AccountLookup
  clock: Clock
}

export interface RejectedRecipient {
  readonly username: string
  readonly reason: 'username_belongs_to_trainer' | 'invalid_credentials'
}

export interface AssignRoutineResult {
  readonly created: readonly Assignment[]
  readonly overwritten: readonly Assignment[]
  readonly needsConfirmation: readonly string[]
  readonly rejected: readonly RejectedRecipient[]
}

export type AssignRoutineError =
  | RoutineNotFoundError
  | InvalidTrainingInputError
  | ExerciseNotFoundError

/** RF-20: la rutina persistida debe tener contenido válido (≥ 1 bloque con ≥ 1 ejercicio). */
function hasValidContent(routine: Routine): boolean {
  return routine.blocks.length > 0 && routine.blocks.every((b) => b.exercises.length > 0)
}

function parseSlots(raw: unknown): Result<Slot[], InvalidTrainingInputError> {
  if (!Array.isArray(raw) || raw.length === 0) {
    return err(new InvalidTrainingInputError([{ field: 'slots', code: 'empty' }]))
  }
  const slots: Slot[] = []
  const issues: TrainingInputIssue[] = []
  raw.forEach((node, i) => {
    const parsed = parseSlot(node)
    if (parsed.ok) slots.push(parsed.value)
    else {
      for (const issue of parsed.error.issues) {
        issues.push({ field: `slots.${i}.${issue.field}`, code: issue.code })
      }
    }
  })
  return issues.length > 0 ? err(new InvalidTrainingInputError(issues)) : ok(slots)
}

async function loadReferencedExercises(
  routine: Routine,
  trainerId: string,
  repo: ExerciseRepository,
): Promise<Result<Exercise[], ExerciseNotFoundError>> {
  const out: Exercise[] = []
  for (const id of referencedExerciseIds(routine.blocks)) {
    const found = await repo.findById(trainerId, id)
    if (!found) return err(new ExerciseNotFoundError(id))
    out.push(found)
  }
  return ok(out)
}

export async function assignRoutine(
  input: AssignRoutineInput,
  deps: AssignRoutineDeps,
): Promise<Result<AssignRoutineResult, AssignRoutineError>> {
  // RF-3: destinatarios y slots bien formados antes de tocar nada.
  if (
    !Array.isArray(input.recipients) ||
    input.recipients.length === 0 ||
    input.recipients.some(
      (r: unknown) =>
        typeof r !== 'object' ||
        r === null ||
        typeof (r as { username?: unknown }).username !== 'string' ||
        (r as { username: string }).username.trim().length === 0,
    )
  ) {
    return err(new InvalidTrainingInputError([{ field: 'recipients', code: 'required' }]))
  }
  const recipients = input.recipients as readonly RecipientInput[]
  const slots = parseSlots(input.slots)
  if (!slots.ok) return slots

  // RF-2: la rutina debe existir y ser del entrenador.
  const routine = await deps.routines.findById(input.trainerId, input.routineId)
  if (!routine) return err(new RoutineNotFoundError(input.routineId))

  // RF-20: solo se asigna una rutina con contenido válido.
  if (!hasValidContent(routine)) {
    return err(new InvalidTrainingInputError([{ field: 'routine', code: 'empty' }]))
  }

  const exercises = await loadReferencedExercises(routine, input.trainerId, deps.exercises)
  if (!exercises.ok) return exercises

  const created: Assignment[] = []
  const overwritten: Assignment[] = []
  const needsConfirmation: string[] = []
  const rejected: RejectedRecipient[] = []

  for (const recipient of recipients) {
    const username = recipient.username.trim()
    const account = await deps.accounts.findByUsername(username)

    let studentId: string | undefined

    if (account && account.role === 'alumno') {
      studentId = account.id
    } else if (account && account.role === 'entrenador') {
      // RF-23: un nombre de usuario de entrenador se rechaza sin crear nada.
      rejected.push({ username, reason: 'username_belongs_to_trainer' })
    } else if (!recipient.confirmarAlta) {
      // RF-21: no existe la cuenta y no se ha confirmado el alta.
      needsConfirmation.push(username)
    } else {
      // RF-21b: alta confirmada; el entrenador fija usuario + contraseña (mínimos
      // de la spec 001). El puerto NO emite sesión.
      try {
        const alumno = await deps.accounts.createAlumno({
          username,
          password: recipient.passwordInicial ?? '',
        })
        studentId = alumno.id
      } catch (error) {
        if (isTrainingError(error) && error.kind === 'InvalidTrainingInput') {
          rejected.push({ username, reason: 'invalid_credentials' })
        } else {
          throw error
        }
      }
    }

    // RF-21c: si este destinatario no se resolvió, el lote sigue.
    if (studentId === undefined) continue

    // RF-22: registra el vínculo entrenador–alumno (idempotente).
    await deps.links.ensureLink(input.trainerId, studentId)

    for (const slot of slots.value) {
      // RF-24: snapshot con el estado actual de rutina y ejercicios.
      const snapshot = snapshotRoutine(routine, exercises.value)
      const { created: made, replaced } = await deps.assignments.replaceForSlot(
        newAssignment({
          trainerId: input.trainerId,
          studentId,
          week: slot.week,
          weekday: slot.weekday,
          routineSnapshot: snapshot,
          createdAt: deps.clock.now(),
        }),
      )
      created.push(made)
      // RF-26: el slot ya ocupado se sobrescribe, informando de la previa.
      if (replaced) overwritten.push(replaced)
    }
  }

  return ok({ created, overwritten, needsConfirmation, rejected })
}
