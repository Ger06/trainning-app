import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
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
  UnauthenticatedError,
  UsernameBelongsToTrainerError,
  type AnyTrainingError,
} from '@/domain/training/errors'
import { TRAINING_MESSAGES, messageForTrainingError } from './training-messages'

const SRC = fileURLToPath(new URL('..', import.meta.url))

describe('messageForTrainingError (RF-29)', () => {
  it('mapea las once variantes a un texto no vacío', () => {
    const errors: AnyTrainingError[] = [
      new InvalidTrainingInputError([{ field: 'name', code: 'too_short' }]),
      new ExerciseNameTakenError('S'),
      new RoutineNameTakenError('R'),
      new ExerciseInUseError('ex_1'),
      new ExerciseNotFoundError('ex_1'),
      new RoutineNotFoundError('rt_1'),
      new AssignmentNotFoundError('as_1'),
      new StudentNotFoundError('ana2'),
      new UsernameBelongsToTrainerError('coach'),
      new ForbiddenError(),
      new UnauthenticatedError(),
    ]
    for (const e of errors) {
      const msg = messageForTrainingError(e)
      expect(typeof msg).toBe('string')
      expect(msg.length).toBeGreaterThan(0)
    }
  })

  it('los textos concretos de RF-29 salen del módulo', () => {
    expect(messageForTrainingError(new ExerciseNameTakenError('S'))).toBe(
      TRAINING_MESSAGES.exerciseNameTaken,
    )
    expect(messageForTrainingError(new ExerciseInUseError('x'))).toBe(TRAINING_MESSAGES.exerciseInUse)
    expect(messageForTrainingError(new StudentNotFoundError('x'))).toBe(
      TRAINING_MESSAGES.studentNotFound,
    )
    expect(messageForTrainingError(new UsernameBelongsToTrainerError('x'))).toBe(
      TRAINING_MESSAGES.usernameBelongsToTrainer,
    )
    // rutina/bloque vacíos, sin reps ni tiempo, fuera de rango y contraseña
    // inicial corta son todos InvalidTrainingInput → un mensaje + issues.
    expect(messageForTrainingError(new InvalidTrainingInputError([]))).toBe(
      TRAINING_MESSAGES.invalidInput,
    )
  })

  it('la oferta de alta se menciona en el texto de usuario inexistente', () => {
    expect(TRAINING_MESSAGES.studentNotFound.toLowerCase()).toContain('alta')
  })

  it('hay un texto para el aviso de sobrescritura de slot (RF-29)', () => {
    expect(typeof TRAINING_MESSAGES.slotOverwritten).toBe('string')
    expect(TRAINING_MESSAGES.slotOverwritten.length).toBeGreaterThan(0)
  })
})

describe('la copia vive solo en este módulo (T21, RF-29)', () => {
  const EXACT = Object.values(TRAINING_MESSAGES)
  const candidates = [
    'domain/training/errors.ts',
    'domain/training/assign-routine.ts',
    'domain/training/parse-routine.ts',
    'lib/http/training-error-response.ts',
    'app/api/exercises/route.ts',
    'app/api/routines/route.ts',
    'app/api/assignments/route.ts',
  ]

  it('ningún módulo de dominio ni handler existente hardcodea los textos', () => {
    for (const rel of candidates) {
      const p = join(SRC, rel)
      if (!existsSync(p)) continue
      const src = readFileSync(p, 'utf8')
      for (const text of EXACT) {
        expect(src, `${rel} contiene "${text}"`).not.toContain(text)
      }
    }
  })
})
