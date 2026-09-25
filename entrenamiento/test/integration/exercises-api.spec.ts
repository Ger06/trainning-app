import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { POST as register } from '@/app/api/auth/register/route'
import { GET as listExercisesRoute, POST as createExerciseRoute } from '@/app/api/exercises/route'
import {
  DELETE as deleteExerciseRoute,
  PATCH as patchExerciseRoute,
} from '@/app/api/exercises/[id]/route'
import { POST as createRoutineRoute } from '@/app/api/routines/route'
import {
  hasMongo,
  postJson,
  requestCookie,
  setupIntegrationDb,
  type IntegrationContext,
} from './_harness'

const REGISTER = 'http://localhost/api/auth/register'
const EXERCISES = 'http://localhost/api/exercises'
const ROUTINES = 'http://localhost/api/routines'

const idCtx = (id: string) => ({ params: Promise.resolve({ id }) })
let n = 0
const uniq = () => `u${Date.now()}${n++}`

async function cookieFor(role: 'entrenador' | 'alumno'): Promise<string> {
  const res = await register(postJson(REGISTER, { username: uniq(), password: 'contrasena8', role }))
  expect(res.status).toBe(201)
  return requestCookie(res.headers.get('set-cookie'))
}

const withCookie = (url: string, body: unknown, cookie: string) =>
  postJson(url, body, { cookie })

describe.skipIf(!hasMongo)('T31 · /api/exercises (integración)', () => {
  let ctx: IntegrationContext
  let trainer: string

  beforeAll(async () => {
    ctx = await setupIntegrationDb()
    trainer = await cookieFor('entrenador')
  })
  afterAll(async () => {
    await ctx.teardown()
  })

  it('sin sesión → 401; sesión de alumno → 403 (RF-1)', async () => {
    expect((await createExerciseRoute(postJson(EXERCISES, { name: 'Sentadilla' }))).status).toBe(401)
    const alumno = await cookieFor('alumno')
    expect(
      (await createExerciseRoute(withCookie(EXERCISES, { name: 'Sentadilla' }, alumno))).status,
    ).toBe(403)
  })

  it('POST válido → 201 con el ejercicio; nombre duplicado → 409 (RF-4, RF-6)', async () => {
    const res = await createExerciseRoute(withCookie(EXERCISES, { name: 'Press Banca' }, trainer))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toMatchObject({ name: 'Press Banca', nameNormalized: 'press banca' })

    const dup = await createExerciseRoute(withCookie(EXERCISES, { name: 'press  banca' }, trainer))
    expect(dup.status).toBe(409)
    expect((await dup.json()).error).toBe('exercise_name_taken')
  })

  it('nombre inválido → 422 (RF-4)', async () => {
    const res = await createExerciseRoute(withCookie(EXERCISES, { name: 'x' }, trainer))
    expect(res.status).toBe(422)
    expect((await res.json()).issues?.[0]?.field).toBe('name')
  })

  it('PATCH edita el propio; ejercicio de otro entrenador → 404 (RF-2, RF-7)', async () => {
    const created = await (
      await createExerciseRoute(withCookie(EXERCISES, { name: 'Remo' }, trainer))
    ).json()
    const ok = await patchExerciseRoute(
      withCookie(`${EXERCISES}/${created.id}`, { name: 'Remo con Barra' }, trainer),
      idCtx(created.id),
    )
    expect(ok.status).toBe(200)
    expect((await ok.json()).name).toBe('Remo con Barra')

    const other = await cookieFor('entrenador')
    const notFound = await patchExerciseRoute(
      withCookie(`${EXERCISES}/${created.id}`, { name: 'Ajeno' }, other),
      idCtx(created.id),
    )
    expect(notFound.status).toBe(404)
  })

  it('DELETE de un ejercicio usado por una rutina → 409 (RF-8)', async () => {
    const ex = await (
      await createExerciseRoute(withCookie(EXERCISES, { name: 'Zancada' }, trainer))
    ).json()
    const routineRes = await createRoutineRoute(
      withCookie(
        ROUTINES,
        {
          name: `Rutina ${uniq()}`,
          blocks: [
            { exercises: [{ exerciseId: ex.id, sets: 3, reps: 10 }], rounds: 1, restBetweenRoundsSec: 0 },
          ],
        },
        trainer,
      ),
    )
    expect(routineRes.status).toBe(201)

    const del = await deleteExerciseRoute(
      withCookie(`${EXERCISES}/${ex.id}`, {}, trainer),
      idCtx(ex.id),
    )
    expect(del.status).toBe(409)
    expect((await del.json()).error).toBe('exercise_in_use')
  })

  it('GET lista solo el catálogo propio (RF-2)', async () => {
    const mine = await listExercisesRoute(new Request(EXERCISES, { headers: { cookie: trainer } }))
    const list = await mine.json()
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBeGreaterThan(0)

    const other = await cookieFor('entrenador')
    const empty = await listExercisesRoute(new Request(EXERCISES, { headers: { cookie: other } }))
    expect(await empty.json()).toEqual([])
  })

  it('un id mal formado se comporta como inexistente (RF-2)', async () => {
    const bad = new ObjectId().toHexString()
    const res = await deleteExerciseRoute(withCookie(`${EXERCISES}/${bad}`, {}, trainer), idCtx(bad))
    expect(res.status).toBe(404)
  })
})
