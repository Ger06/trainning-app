import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  AssignmentNotFoundError,
  ExerciseInUseError,
  ExerciseNameTakenError,
  ExerciseNotFoundError,
  ForbiddenError,
  InvalidTrainingInputError,
  RoutineNameTakenError,
  RoutineNotFoundError,
  StudentNotFoundError,
  TrainingError,
  UnauthenticatedError,
  UsernameBelongsToTrainerError,
  assertNever,
  isTrainingError,
  type AnyTrainingError,
} from './errors'

// Consumidor exhaustivo: si se añade una variante sin su `case`, este archivo
// deja de compilar (constitución P5, "Hecho cuando" de T3).
function describeError(err: AnyTrainingError): string {
  switch (err.kind) {
    case 'InvalidTrainingInput':
      return `campos:${err.issues.map((i) => `${i.field}/${i.code}`).join(',')}`
    case 'ExerciseNameTaken':
      return `ej-tomado:${err.exerciseName}`
    case 'RoutineNameTaken':
      return `rut-tomada:${err.routineName}`
    case 'ExerciseInUse':
      return `en-uso:${err.exerciseId}`
    case 'ExerciseNotFound':
      return `sin-ej:${err.exerciseId}`
    case 'RoutineNotFound':
      return `sin-rut:${err.routineId}`
    case 'AssignmentNotFound':
      return `sin-asig:${err.assignmentId}`
    case 'StudentNotFound':
      return `sin-alumno:${err.username}`
    case 'UsernameBelongsToTrainer':
      return `es-entrenador:${err.username}`
    case 'Forbidden':
      return 'prohibido'
    case 'Unauthenticated':
      return 'sin-sesion'
    default:
      return assertNever(err)
  }
}

describe('TrainingError', () => {
  it('InvalidTrainingInputError lleva kind, name y las incidencias', () => {
    const err = new InvalidTrainingInputError([
      { field: 'name', code: 'too_short' },
      { field: 'blocks.0.rounds', code: 'out_of_range' },
    ])
    expect(err.kind).toBe('InvalidTrainingInput')
    expect(err.name).toBe('InvalidTrainingInputError')
    expect(err).toBeInstanceOf(TrainingError)
    expect(err).toBeInstanceOf(Error)
    expect(err.issues).toEqual([
      { field: 'name', code: 'too_short' },
      { field: 'blocks.0.rounds', code: 'out_of_range' },
    ])
  })

  it('los errores de nombre duplicado no pisan Error.name', () => {
    const ex = new ExerciseNameTakenError('Sentadilla')
    expect(ex.kind).toBe('ExerciseNameTaken')
    expect(ex.name).toBe('ExerciseNameTakenError')
    expect(ex.exerciseName).toBe('Sentadilla')

    const rt = new RoutineNameTakenError('Full Body A')
    expect(rt.name).toBe('RoutineNameTakenError')
    expect(rt.routineName).toBe('Full Body A')
  })

  it('los errores de referencia llevan su id', () => {
    expect(new ExerciseInUseError('ex_1').exerciseId).toBe('ex_1')
    expect(new ExerciseNotFoundError('ex_2').exerciseId).toBe('ex_2')
    expect(new RoutineNotFoundError('rt_1').routineId).toBe('rt_1')
    expect(new AssignmentNotFoundError('as_1').assignmentId).toBe('as_1')
  })

  it('los errores de destinatario llevan el username', () => {
    expect(new StudentNotFoundError('ana2').username).toBe('ana2')
    expect(new UsernameBelongsToTrainerError('coach').username).toBe('coach')
  })

  it('Forbidden y Unauthenticated no exponen datos', () => {
    expect(new ForbiddenError().kind).toBe('Forbidden')
    expect(new ForbiddenError()).not.toHaveProperty('username')
    expect(new UnauthenticatedError().kind).toBe('Unauthenticated')
  })

  it('isTrainingError distingue errores del dominio de otros valores', () => {
    expect(isTrainingError(new ForbiddenError())).toBe(true)
    expect(isTrainingError(new InvalidTrainingInputError([]))).toBe(true)
    expect(isTrainingError(new Error('otro'))).toBe(false)
    expect(isTrainingError({ kind: 'Forbidden' })).toBe(false)
    expect(isTrainingError(null)).toBe(false)
  })

  it('un switch exhaustivo cubre las once variantes', () => {
    expect(
      describeError(new InvalidTrainingInputError([{ field: 'name', code: 'required' }])),
    ).toBe('campos:name/required')
    expect(describeError(new ExerciseNameTakenError('S'))).toBe('ej-tomado:S')
    expect(describeError(new RoutineNameTakenError('R'))).toBe('rut-tomada:R')
    expect(describeError(new ExerciseInUseError('ex_1'))).toBe('en-uso:ex_1')
    expect(describeError(new ExerciseNotFoundError('ex_1'))).toBe('sin-ej:ex_1')
    expect(describeError(new RoutineNotFoundError('rt_1'))).toBe('sin-rut:rt_1')
    expect(describeError(new AssignmentNotFoundError('as_1'))).toBe('sin-asig:as_1')
    expect(describeError(new StudentNotFoundError('ana2'))).toBe('sin-alumno:ana2')
    expect(describeError(new UsernameBelongsToTrainerError('coach'))).toBe('es-entrenador:coach')
    expect(describeError(new ForbiddenError())).toBe('prohibido')
    expect(describeError(new UnauthenticatedError())).toBe('sin-sesion')
  })

  it('assertNever lanza si llega a ejecutarse', () => {
    expect(() => assertNever('inesperado' as never)).toThrow(/unhandled TrainingError/)
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./errors.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
