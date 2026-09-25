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
  UnauthenticatedError,
  UsernameBelongsToTrainerError,
  type AnyTrainingError,
} from '@/domain/training/errors'
import { trainingErrorResponse } from './training-error-response'

async function parse(e: AnyTrainingError) {
  const res = trainingErrorResponse(e)
  return { status: res.status, contentType: res.headers.get('content-type'), body: await res.json() }
}

describe('trainingErrorResponse (RF-29)', () => {
  it('un caso por status', async () => {
    expect(
      (await parse(new InvalidTrainingInputError([{ field: 'name', code: 'too_short' }]))).status,
    ).toBe(422)
    expect((await parse(new ExerciseNameTakenError('S'))).status).toBe(409)
    expect((await parse(new RoutineNameTakenError('R'))).status).toBe(409)
    expect((await parse(new ExerciseInUseError('ex_1'))).status).toBe(409)
    expect((await parse(new UsernameBelongsToTrainerError('coach'))).status).toBe(409)
    expect((await parse(new StudentNotFoundError('ana2'))).status).toBe(409)
    expect((await parse(new ExerciseNotFoundError('ex_1'))).status).toBe(404)
    expect((await parse(new RoutineNotFoundError('rt_1'))).status).toBe(404)
    expect((await parse(new AssignmentNotFoundError('as_1'))).status).toBe(404)
    expect((await parse(new ForbiddenError())).status).toBe(403)
    expect((await parse(new UnauthenticatedError())).status).toBe(401)
  })

  it('el cuerpo tiene la forma { error, message } con código estable y JSON', async () => {
    const { body, contentType } = await parse(new ExerciseNameTakenError('Sentadilla'))
    expect(contentType).toMatch(/application\/json/)
    expect(body).toEqual({ error: 'exercise_name_taken', message: expect.any(String) })
  })

  it('incluye las issues solo para InvalidTrainingInput', async () => {
    const invalid = await parse(
      new InvalidTrainingInputError([{ field: 'blocks.0.rounds', code: 'out_of_range' }]),
    )
    expect(invalid.body.issues).toEqual([{ field: 'blocks.0.rounds', code: 'out_of_range' }])

    const other = await parse(new ForbiddenError())
    expect(other.body).not.toHaveProperty('issues')
  })

  it('el message no está hardcodeado aquí: viene de messageForTrainingError', () => {
    const src = readFileSync(new URL('./training-error-response.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/messageForTrainingError/)
  })
})
