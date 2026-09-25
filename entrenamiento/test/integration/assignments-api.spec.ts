import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { POST as register } from '@/app/api/auth/register/route'
import {
  GET as sessionProbe,
} from '@/app/api/auth/session/route'
import { POST as createExerciseRoute } from '@/app/api/exercises/route'
import { PATCH as patchExerciseRoute } from '@/app/api/exercises/[id]/route'
import { POST as createRoutineRoute } from '@/app/api/routines/route'
import { PATCH as patchRoutineRoute } from '@/app/api/routines/[id]/route'
import { GET as listAssignmentsRoute, POST as assignRoute } from '@/app/api/assignments/route'
import { DELETE as unassignRoute } from '@/app/api/assignments/[id]/route'
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
const ASSIGN = 'http://localhost/api/assignments'

const idCtx = (id: string) => ({ params: Promise.resolve({ id }) })
let n = 0
const uniq = () => `u${Date.now()}${n++}`
const withCookie = (url: string, body: unknown, cookie: string) => postJson(url, body, { cookie })

async function registerReturning(username: string, role: 'entrenador' | 'alumno') {
  const res = await register(postJson(REGISTER, { username, password: 'contrasena8', role }))
  expect(res.status).toBe(201)
  return { cookie: requestCookie(res.headers.get('set-cookie')), username }
}

describe.skipIf(!hasMongo)('T33 · /api/assignments (integración)', () => {
  let ctx: IntegrationContext
  let trainer: string
  let otherTrainer: { username: string; cookie: string }
  let routineId: string
  let exId: string
  let ana: string
  let luis: string

  beforeAll(async () => {
    ctx = await setupIntegrationDb()
    trainer = (await registerReturning(uniq(), 'entrenador')).cookie
    otherTrainer = await registerReturning(uniq(), 'entrenador')
    ana = (await registerReturning('ana' + uniq(), 'alumno')).username
    luis = (await registerReturning('luis' + uniq(), 'alumno')).username

    exId = (
      await (await createExerciseRoute(withCookie(EXERCISES, { name: 'Sentadilla' }, trainer))).json()
    ).id
    routineId = (
      await (
        await createRoutineRoute(
          withCookie(
            ROUTINES,
            {
              name: `Full ${uniq()}`,
              blocks: [
                { exercises: [{ exerciseId: exId, sets: 3, reps: 10 }], rounds: 2, restBetweenRoundsSec: 60 },
              ],
            },
            trainer,
          ),
        )
      ).json()
    ).id
  })
  afterAll(async () => {
    await ctx.teardown()
  })

  const assign = (body: Record<string, unknown>, cookie = trainer) =>
    assignRoute(withCookie(ASSIGN, { routineId, ...body }, cookie))

  it('sin sesión → 401; alumno → 403 (RF-1)', async () => {
    expect((await assignRoute(postJson(ASSIGN, { routineId }))).status).toBe(401)
    const al = (await registerReturning(uniq(), 'alumno')).cookie
    expect((await assign({ recipients: [{ username: ana }], slots: [{ week: 1, weekday: 'lunes' }] }, al)).status).toBe(403)
  })

  it('2 alumnos × 2 slots → 4 asignaciones (RF-18)', async () => {
    const res = await assign({
      recipients: [{ username: ana }, { username: luis }],
      slots: [
        { week: 1, weekday: 'lunes' },
        { week: 1, weekday: 'jueves' },
      ],
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.created).toHaveLength(4)
    expect(body.needsConfirmation).toEqual([])
    expect(body.rejected).toEqual([])
  })

  it('alumno inexistente sin confirmar → needsConfirmation, nada creado (RF-21)', async () => {
    const res = await assign({
      recipients: [{ username: 'fantasma' + uniq() }],
      slots: [{ week: 2, weekday: 'lunes' }],
    })
    const body = await res.json()
    expect(body.needsConfirmation).toHaveLength(1)
    expect(body.created).toEqual([])
  })

  it('alta confirmada crea la cuenta sin Set-Cookie y asigna (RF-21b, RF-22)', async () => {
    const nuevo = 'marta' + uniq()
    const res = await assign({
      recipients: [{ username: nuevo, confirmarAlta: true, passwordInicial: 'contrasena8' }],
      slots: [{ week: 3, weekday: 'martes' }],
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toBeNull()
    expect((await res.json()).created).toHaveLength(1)

    // la cuenta nueva puede iniciar sesión (existe con rol alumno)
    const login = await register(postJson(REGISTER, { username: nuevo, password: 'x', role: 'alumno' }))
    expect(login.status).toBe(409) // "username_taken" → la cuenta ya existe
  })

  it('username de un entrenador → rejected (RF-23)', async () => {
    const res = await assign({
      recipients: [{ username: otherTrainer.username }],
      slots: [{ week: 4, weekday: 'lunes' }],
    })
    const body = await res.json()
    expect(body.rejected).toContainEqual({
      username: otherTrainer.username,
      reason: 'username_belongs_to_trainer',
    })
    expect(body.created).toEqual([])
  })

  it('segundo POST al mismo slot → overwritten y un solo documento (RF-26)', async () => {
    const slot = { recipients: [{ username: ana }], slots: [{ week: 6, weekday: 'viernes' }] }
    const first = await (await assign(slot)).json()
    expect(first.overwritten).toEqual([])
    const second = await (await assign(slot)).json()
    expect(second.overwritten).toHaveLength(1)

    const anaId = second.created[0].studentId
    const list = await (
      await listAssignmentsRoute(
        new Request(`${ASSIGN}?studentId=${anaId}&week=6`, { headers: { cookie: trainer } }),
      )
    ).json()
    expect(list).toHaveLength(1)
  })

  it('reasignar tras editar la rutina → snapshot nuevo; el viejo intacto (RF-24, RF-25)', async () => {
    const slot = { recipients: [{ username: luis }], slots: [{ week: 7, weekday: 'lunes' }] }
    const first = await (await assign(slot)).json()
    expect(first.created[0].routineSnapshot.blocks[0].exercises[0].name).toBe('Sentadilla')

    await patchExerciseRoute(
      withCookie(`${EXERCISES}/${exId}`, { name: 'Sentadilla Frontal' }, trainer),
      idCtx(exId),
    )
    const second = await (await assign(slot)).json()
    expect(second.created[0].routineSnapshot.blocks[0].exercises[0].name).toBe('Sentadilla Frontal')
    expect(second.overwritten[0].routineSnapshot.blocks[0].exercises[0].name).toBe('Sentadilla')
  })

  it('editar la rutina no cambia una asignación ya emitida (RF-9)', async () => {
    const slot = { recipients: [{ username: ana }], slots: [{ week: 8, weekday: 'lunes' }] }
    const before = await (await assign(slot)).json()
    const anaId = before.created[0].studentId

    await patchRoutineRoute(
      withCookie(
        `${ROUTINES}/${routineId}`,
        {
          name: `Full ${uniq()}`,
          blocks: [
            { exercises: [{ exerciseId: exId, sets: 99, reps: 1 }], rounds: 1, restBetweenRoundsSec: 0 },
          ],
        },
        trainer,
      ),
      idCtx(routineId),
    )
    const list = await (
      await listAssignmentsRoute(
        new Request(`${ASSIGN}?studentId=${anaId}&week=8`, { headers: { cookie: trainer } }),
      )
    ).json()
    expect(list[0].routineSnapshot.blocks[0].exercises[0].sets).toBe(3)
  })

  it('DELETE /api/assignments/[id] deja el slot vacío (RF-27)', async () => {
    const made = await (
      await assign({ recipients: [{ username: ana }], slots: [{ week: 9, weekday: 'lunes' }] })
    ).json()
    const id = made.created[0].id
    const anaId = made.created[0].studentId

    const del = await unassignRoute(withCookie(`${ASSIGN}/${id}`, {}, trainer), idCtx(id))
    expect(del.status).toBe(200)

    const list = await (
      await listAssignmentsRoute(
        new Request(`${ASSIGN}?studentId=${anaId}&week=9`, { headers: { cookie: trainer } }),
      )
    ).json()
    expect(list).toEqual([])

    // segunda baja → 404
    expect(
      (await unassignRoute(withCookie(`${ASSIGN}/${id}`, {}, trainer), idCtx(id))).status,
    ).toBe(404)
  })

  it('la sonda de sesión del entrenador sigue viva tras todo (sanity)', async () => {
    const res = await sessionProbe(new Request('http://localhost/api/auth/session', { headers: { cookie: trainer } }))
    expect(res.status).toBe(200)
  })
})
