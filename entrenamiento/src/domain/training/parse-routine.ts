import { err, ok, type Result } from '../shared/result'
import {
  InvalidTrainingInputError,
  type TrainingInputCode,
  type TrainingInputIssue,
} from './errors'
import {
  MAX_BLOCKS,
  MAX_DESCRIPTION_LENGTH,
  MAX_EXERCISE_NOTE_LENGTH,
  MAX_EXERCISES_PER_BLOCK,
  MAX_NAME_LENGTH,
  MAX_REPS,
  MAX_ROUNDS,
  MAX_SECONDS,
  MAX_SETS,
} from './limits'
import { MIN_NAME_LENGTH, type Block, type BlockExercise } from './routine'
import { normalizeRoutineName } from './routine-name'

/**
 * Validación pura del alta/edición de una rutina (constitución P3; D7 del plan:
 * a mano, sin librería). El servidor es la autoridad (RF-3); acumula TODAS las
 * incidencias con la ruta del campo (`blocks.0.exercises.1.reps`). Devuelve los
 * campos que controla la persona ya saneados; el caso de uso añade `trainerId`,
 * las marcas de tiempo y comprueba que los `exerciseId` son del catálogo.
 */

export interface ParsedRoutine {
  readonly name: string
  readonly nameNormalized: string
  readonly note?: string
  readonly blocks: readonly Block[]
}

const issue = (field: string, code: TrainingInputCode): TrainingInputIssue => ({ field, code })

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

interface IntSpec {
  min: number
  max: number
  required: boolean
}

/** Lee un entero opcional/obligatorio dentro de rango; empuja incidencia si falla. */
function readInt(
  raw: unknown,
  field: string,
  spec: IntSpec,
  issues: TrainingInputIssue[],
): number | undefined {
  if (raw === undefined || raw === null) {
    if (spec.required) issues.push(issue(field, 'required'))
    return undefined
  }
  if (typeof raw !== 'number' || !Number.isInteger(raw)) {
    issues.push(issue(field, 'invalid_value'))
    return undefined
  }
  if (raw < spec.min || raw > spec.max) {
    issues.push(issue(field, 'out_of_range'))
    return undefined
  }
  return raw
}

function parseExerciseNode(
  raw: unknown,
  path: string,
  issues: TrainingInputIssue[],
): BlockExercise | undefined {
  if (!isRecord(raw)) {
    issues.push(issue(path, 'invalid_value'))
    return undefined
  }

  if (typeof raw.exerciseId !== 'string' || raw.exerciseId.trim().length === 0) {
    issues.push(issue(`${path}.exerciseId`, 'required'))
  }

  const sets = readInt(raw.sets, `${path}.sets`, { min: 1, max: MAX_SETS, required: true }, issues)

  const repsProvided = raw.reps !== undefined && raw.reps !== null
  const timeProvided = raw.timeSec !== undefined && raw.timeSec !== null
  const reps = readInt(raw.reps, `${path}.reps`, { min: 1, max: MAX_REPS, required: false }, issues)
  const timeSec = readInt(
    raw.timeSec,
    `${path}.timeSec`,
    { min: 1, max: MAX_SECONDS, required: false },
    issues,
  )
  // RF-13: al menos uno de repeticiones / tiempo.
  if (!repsProvided && !timeProvided) {
    issues.push(issue(`${path}.reps`, 'required'))
  }

  const restBetweenSetsSec =
    readInt(
      raw.restBetweenSetsSec,
      `${path}.restBetweenSetsSec`,
      { min: 0, max: MAX_SECONDS, required: false },
      issues,
    ) ?? 0
  const restAfterExerciseSec =
    readInt(
      raw.restAfterExerciseSec,
      `${path}.restAfterExerciseSec`,
      { min: 0, max: MAX_SECONDS, required: false },
      issues,
    ) ?? 0

  let note: string | undefined
  if (raw.note !== undefined && raw.note !== null && raw.note !== '') {
    if (typeof raw.note !== 'string') {
      issues.push(issue(`${path}.note`, 'invalid_value'))
    } else if (raw.note.length > MAX_EXERCISE_NOTE_LENGTH) {
      issues.push(issue(`${path}.note`, 'too_long'))
    } else {
      note = raw.note
    }
  }

  if (issues.length > 0 || sets === undefined) return undefined

  return {
    exerciseId: (raw.exerciseId as string).trim(),
    sets,
    ...(reps !== undefined ? { reps } : {}),
    ...(timeSec !== undefined ? { timeSec } : {}),
    restBetweenSetsSec,
    restAfterExerciseSec,
    ...(note !== undefined ? { note } : {}),
  }
}

function parseBlockNode(
  raw: unknown,
  path: string,
  issues: TrainingInputIssue[],
): Block | undefined {
  if (!isRecord(raw)) {
    issues.push(issue(path, 'invalid_value'))
    return undefined
  }

  const rounds = readInt(raw.rounds, `${path}.rounds`, {
    min: 1,
    max: MAX_ROUNDS,
    required: true,
  }, issues)

  const restBetweenRoundsSec =
    readInt(
      raw.restBetweenRoundsSec,
      `${path}.restBetweenRoundsSec`,
      { min: 0, max: MAX_SECONDS, required: false },
      issues,
    ) ?? 0

  const restAfterBlockSec = readInt(
    raw.restAfterBlockSec,
    `${path}.restAfterBlockSec`,
    { min: 0, max: MAX_SECONDS, required: false },
    issues,
  )

  const rawExercises = raw.exercises
  const exercises: BlockExercise[] = []
  if (!Array.isArray(rawExercises)) {
    issues.push(issue(`${path}.exercises`, 'invalid_value'))
  } else if (rawExercises.length < 1) {
    issues.push(issue(`${path}.exercises`, 'empty'))
  } else if (rawExercises.length > MAX_EXERCISES_PER_BLOCK) {
    issues.push(issue(`${path}.exercises`, 'too_long'))
  } else {
    rawExercises.forEach((node, j) => {
      const parsed = parseExerciseNode(node, `${path}.exercises.${j}`, issues)
      if (parsed) exercises.push(parsed)
    })
  }

  if (issues.length > 0 || rounds === undefined) return undefined

  return {
    exercises,
    rounds,
    restBetweenRoundsSec,
    ...(restAfterBlockSec !== undefined ? { restAfterBlockSec } : {}),
  }
}

export function parseRoutineDraft(
  input: unknown,
): Result<ParsedRoutine, InvalidTrainingInputError> {
  if (!isRecord(input)) {
    return err(new InvalidTrainingInputError([issue('routine', 'invalid_value')]))
  }
  const issues: TrainingInputIssue[] = []

  // RF-10: nombre obligatorio, entre MIN_NAME_LENGTH y MAX_NAME_LENGTH (tras trim).
  let name = ''
  const rawName = input.name
  if (typeof rawName !== 'string' || rawName.trim().length === 0) {
    issues.push(issue('name', 'required'))
  } else if (rawName.trim().length < MIN_NAME_LENGTH) {
    issues.push(issue('name', 'too_short'))
  } else if (rawName.trim().length > MAX_NAME_LENGTH) {
    issues.push(issue('name', 'too_long'))
  } else {
    name = rawName.trim()
  }

  // RF-10: nota opcional (texto libre).
  let note: string | undefined
  const rawNote = input.note
  if (rawNote !== undefined && rawNote !== null && rawNote !== '') {
    if (typeof rawNote !== 'string') {
      issues.push(issue('note', 'invalid_value'))
    } else if (rawNote.length > MAX_DESCRIPTION_LENGTH) {
      issues.push(issue('note', 'too_long'))
    } else {
      note = rawNote
    }
  }

  // RF-11, RF-15: lista ordenada de 1..MAX_BLOCKS bloques.
  const blocks: Block[] = []
  const rawBlocks = input.blocks
  if (!Array.isArray(rawBlocks)) {
    issues.push(issue('blocks', 'invalid_value'))
  } else if (rawBlocks.length < 1) {
    issues.push(issue('blocks', 'empty'))
  } else if (rawBlocks.length > MAX_BLOCKS) {
    issues.push(issue('blocks', 'too_long'))
  } else {
    rawBlocks.forEach((node, i) => {
      const parsed = parseBlockNode(node, `blocks.${i}`, issues)
      if (parsed) blocks.push(parsed)
    })
  }

  if (issues.length > 0) {
    return err(new InvalidTrainingInputError(issues))
  }

  return ok({
    name,
    nameNormalized: normalizeRoutineName(name),
    ...(note !== undefined ? { note } : {}),
    blocks,
  })
}
