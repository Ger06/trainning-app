import { err, ok, type Result } from '../shared/result'
import {
  InvalidTrainingInputError,
  type TrainingInputCode,
  type TrainingInputIssue,
} from './errors'
import { normalizeExerciseName } from './exercise-name'
import { MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH } from './limits'
import { MIN_NAME_LENGTH } from './exercise'

/**
 * Validación pura del alta/edición de un ejercicio (constitución P3; D7 del plan:
 * a mano, sin librería). El servidor es la autoridad (RF-3); el formulario solo
 * replica estas reglas. Devuelve los campos controlados por la persona ya
 * saneados; el caso de uso añade `trainerId` y las marcas de tiempo.
 */

export interface ParsedExercise {
  readonly name: string
  readonly nameNormalized: string
  readonly description?: string
}

const issue = (field: string, code: TrainingInputCode): TrainingInputIssue => ({ field, code })

/** RF-5: el ejercicio no lleva prescripción; estos campos no deben aparecer. */
const PRESCRIPTION_KEYS = [
  'sets',
  'reps',
  'timeSec',
  'rounds',
  'restBetweenSetsSec',
  'restAfterExerciseSec',
  'restBetweenRoundsSec',
  'restAfterBlockSec',
] as const

export function parseExerciseInput(
  input: unknown,
): Result<ParsedExercise, InvalidTrainingInputError> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return err(new InvalidTrainingInputError([issue('exercise', 'invalid_value')]))
  }
  const record = input as Record<string, unknown>
  const issues: TrainingInputIssue[] = []

  // RF-4: nombre obligatorio, entre MIN_NAME_LENGTH y MAX_NAME_LENGTH (tras trim).
  let name = ''
  const rawName = record.name
  if (typeof rawName !== 'string' || rawName.trim().length === 0) {
    issues.push(issue('name', 'required'))
  } else if (rawName.trim().length < MIN_NAME_LENGTH) {
    issues.push(issue('name', 'too_short'))
  } else if (rawName.trim().length > MAX_NAME_LENGTH) {
    issues.push(issue('name', 'too_long'))
  } else {
    name = rawName.trim()
  }

  // RF-4: descripción opcional (texto libre); si viene, string dentro del máximo.
  let description: string | undefined
  const rawDescription = record.description
  if (rawDescription !== undefined && rawDescription !== null && rawDescription !== '') {
    if (typeof rawDescription !== 'string') {
      issues.push(issue('description', 'invalid_value'))
    } else if (rawDescription.length > MAX_DESCRIPTION_LENGTH) {
      issues.push(issue('description', 'too_long'))
    } else {
      description = rawDescription
    }
  }

  // RF-5: un campo de prescripción en el ejercicio es un error de entrada.
  for (const key of PRESCRIPTION_KEYS) {
    if (key in record) {
      issues.push(issue(key, 'invalid_value'))
    }
  }

  if (issues.length > 0) {
    return err(new InvalidTrainingInputError(issues))
  }

  return ok({
    name,
    nameNormalized: normalizeExerciseName(name),
    ...(description !== undefined ? { description } : {}),
  })
}
