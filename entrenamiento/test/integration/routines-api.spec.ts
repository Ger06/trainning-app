import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { POST as register } from '@/app/api/auth/register/route'
import { POST as createExerciseRoute } from '@/app/api/exercises/route'
import { GET as listRoutinesRoute, POST as createRoutineRoute } from '@/app/api/routines/route'
import {
  DELETE as deleteRoutineRoute,
  PATCH as patchRoutineRoute,
} from '@/app/api/routines/[id]/route'
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
const withCookie = (url: string, body: unknown, cookie: string) => postJson(url, body, { cookie })

async function cookieFor(role: 'entrenador' | 'alumno'): Promise<string> {
  const res = await register(postJson(REGISTER, { username: uniq(), password: 'contrasena8', role }))
  return requestCookie(res.headers.get('set-cookie'))
}

describe.skipIf(!hasMongo)('T32 · /api/routines (integración)', () => {
  let ctx: IntegrationContext
  let trainer: string
  let exId: string

  beforeAll(async () => {
    ctx = await setupIntegrationDb()
    trainer = await cookieFor('entrenador')
    exId = (
      await (await createExerciseRoute(withCookie(EXERCISES, { name: 'Sentadilla' }, trainer))).json()
    ).id
  })
  afterAll(async () => {
    await ctx.teardown()
  })

  const validBody = (over: Record<string, unknown> = {}) => ({
    name: `Full ${uniq()}`,
    blocks: [
      {
        exercises: [{ exerciseId: exId, sets: 3, reps: 10, restBetweenSetsSec: 90 }],
        rounds: 2,
        restBetweenRoundsSec: 60,
        restAfterBlockSec: 120,
      },
    ],
    ...over,
  })

  it('sin sesión → 401; alumno → 403 (RF-1)', async () => {
    expect((await createRoutineRoute(postJson(ROUTINES, validBody()))).status).toBe(401)
    const alumno = await cookieFor('alumno')
    expect((await createRoutineRoute(withCookie(ROUTINES, validBody(), alumno))).status).toBe(403)
  })

  it('POST con bloques válidos → 201 y conserva el árbol (RF-10..RF-14)', async () => {
    const res = await createRoutineRoute(withCookie(ROUTINES, validBody(), trainer))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.blocks[0].exercises[0]).toMatchObject({ exerciseId: exId, sets: 3, reps: 10 })
    expect(body.blocks[0].rounds).toBe(2)
  })

  it('rutina/bloque vacíos, rondas 0 y sin reps ni tiempo → 422 (RF-12, RF-13, RF-15)', async () => {
    for (const bad of [
      validBody({ blocks: [] }),
      validBody({ blocks: [{ exercises: [], rounds: 1, restBetweenRoundsSec: 0 }] }),
      validBody({
        blocks: [{ exercises: [{ exerciseId: exId, sets: 3, reps: 10 }], rounds: 0, restBetweenRoundsSec: 0 }],
      }),
      validBody({
        blocks: [{ exercises: [{ exerciseId: exId, sets: 3 }], rounds: 1, restBetweenRoundsSec: 0 }],
      }),
    ]) {
      expect((await createRoutineRoute(withCookie(ROUTINES, bad, trainer))).status).toBe(422)
    }
  })

  it('exerciseId fuera del catálogo → 404; nombre duplicado → 409 (RF-12, RF-16)', async () => {
    const bad = validBody({
      blocks: [
        { exercises: [{ exerciseId: 'no-existe', sets: 3, reps: 10 }], rounds: 1, restBetweenRoundsSec: 0 },
      ],
    })
    expect((await createRoutineRoute(withCookie(ROUTINES, bad, trainer))).status).toBe(404)

    const name = `Dup ${uniq()}`
    await createRoutineRoute(withCookie(ROUTINES, validBody({ name }), trainer))
    const dup = await createRoutineRoute(withCookie(ROUTINES, validBody({ name }), trainer))
    expect(dup.status).toBe(409)
  })

  it('PATCH sustituye la rutina propia; ajena → 404 (RF-2, RF-17)', async () => {
    const created = await (await createRoutineRoute(withCookie(ROUTINES, validBody(), trainer))).json()
    const patched = await patchRoutineRoute(
      withCookie(
        `${ROUTINES}/${created.id}`,
        validBody({ name: created.name, blocks: [{ exercises: [{ exerciseId: exId, sets: 5, timeSec: 30 }], rounds: 4, restBetweenRoundsSec: 30 }] }),
        trainer,
      ),
      idCtx(created.id),
    )
    expect(patched.status).toBe(200)
    expect((await patched.json()).blocks[0].rounds).toBe(4)

    const other = await cookieFor('entrenador')
    const ajena = await deleteRoutineRoute(
      withCookie(`${ROUTINES}/${created.id}`, {}, other),
      idCtx(created.id),
    )
    expect(ajena.status).toBe(404)
  })

  it('GET lista solo las rutinas propias (RF-2)', async () => {
    const list = await (
      await listRoutinesRoute(new Request(ROUTINES, { headers: { cookie: trainer } }))
    ).json()
    expect(Array.isArray(list) && list.length).toBeGreaterThan(0)
    const other = await cookieFor('entrenador')
    expect(
      await (await listRoutinesRoute(new Request(ROUTINES, { headers: { cookie: other } }))).json(),
    ).toEqual([])
  })
})
