import { err, ok, type Result } from '../shared/result'
import {
  InvalidTrainingInputError,
  type TrainingInputCode,
  type TrainingInputIssue,
} from './errors'
import { MAX_WEEK } from './limits'

/**
 * Día de la semana y slot `(semana, día)` del mesociclo (RF-19). Valores ascii;
 * la capa de interfaz añade acentos y mayúsculas al mostrarlos.
 *
 * Módulo puro (constitución P3): `parseSlot` valida a mano (D7 del plan).
 */

export type Weekday =
  | 'lunes'
  | 'martes'
  | 'miercoles'
  | 'jueves'
  | 'viernes'
  | 'sabado'
  | 'domingo'

export const WEEKDAYS: readonly Weekday[] = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
]

export interface Slot {
  readonly week: number
  readonly weekday: Weekday
}

const issue = (field: string, code: TrainingInputCode): TrainingInputIssue => ({ field, code })

const isWeekday = (v: unknown): v is Weekday =>
  typeof v === 'string' && (WEEKDAYS as readonly string[]).includes(v)

export function parseSlot(input: unknown): Result<Slot, InvalidTrainingInputError> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return err(new InvalidTrainingInputError([issue('slot', 'invalid_value')]))
  }
  const record = input as Record<string, unknown>
  const issues: TrainingInputIssue[] = []

  // RF-19: semana entera entre 1 y MAX_WEEK.
  const rawWeek = record.week
  let week = 0
  if (rawWeek === undefined || rawWeek === null) {
    issues.push(issue('week', 'required'))
  } else if (typeof rawWeek !== 'number' || !Number.isInteger(rawWeek)) {
    issues.push(issue('week', 'invalid_value'))
  } else if (rawWeek < 1 || rawWeek > MAX_WEEK) {
    issues.push(issue('week', 'out_of_range'))
  } else {
    week = rawWeek
  }

  // RF-19: día exactamente uno del enum.
  const rawWeekday = record.weekday
  if (rawWeekday === undefined || rawWeekday === null || rawWeekday === '') {
    issues.push(issue('weekday', 'required'))
  } else if (!isWeekday(rawWeekday)) {
    issues.push(issue('weekday', 'invalid_value'))
  }

  if (issues.length > 0) {
    return err(new InvalidTrainingInputError(issues))
  }

  return ok(Object.freeze({ week, weekday: rawWeekday as Weekday }))
}
