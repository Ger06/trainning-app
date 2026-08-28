import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ACCOUNTS_COLLECTION } from '@/infra/db/migrations'
import { POST as register } from '@/app/api/auth/register/route'
import {
  hasMongo,
  postJson,
  setupIntegrationDb,
  type IntegrationContext,
} from './_harness'

const URL = 'http://localhost/api/auth/register'

describe.skipIf(!hasMongo)('T23 · POST /api/auth/register (integración)', () => {
  let ctx: IntegrationContext
  let n = 0
  const fresh = () => ({ username: `User${n}`, password: 'clave-larga-1', role: 'alumno' as const, u: `user${n}` })
  const bump = () => {
    n += 1
  }

  beforeAll(async () => {
    ctx = await setupIntegrationDb()
  })
  afterAll(async () => {
    await ctx.teardown()
  })

  const accounts = () => ctx.db.collection(ACCOUNTS_COLLECTION)

  it('registro válido → 201, Set-Cookie y documento sin texto claro (RF-1,6,8)', async () => {
    bump()
    const { username, password } = fresh()
    const res = await register(postJson(URL, { username, password, role: 'entrenador' }))

    expect(res.status).toBe(201)
    expect(res.headers.get('set-cookie')).toMatch(/^ent_session=/)
    expect(await res.json()).toEqual({ role: 'entrenador', redirectTo: '/' })

    const raw = await accounts().findOne({ usernameNormalized: username.toLowerCase() })
    expect(raw?.passwordHash).toMatch(/^scrypt\$/)
    expect(raw).not.toHaveProperty('password')
    expect(String(raw?.passwordHash)).not.toContain(password)
  })

  it('username duplicado exacto → 409 con el mensaje de la spec (RF-5)', async () => {
    bump()
    const { username, password } = fresh()
    await register(postJson(URL, { username, password, role: 'alumno' }))
    const res = await register(postJson(URL, { username, password, role: 'alumno' }))

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({
      error: 'username_taken',
      message: 'ese nombre de usuario ya está en uso',
    })
    expect(await accounts().countDocuments({ usernameNormalized: username.toLowerCase() })).toBe(1)
  })

  it('registro concurrente del mismo username → una 201 y una 409 (RF-5)', async () => {
    bump()
    const { username, password } = fresh()
    const [a, b] = await Promise.all([
      register(postJson(URL, { username, password, role: 'alumno' })),
      register(postJson(URL, { username, password, role: 'alumno' })),
    ])
    expect([a.status, b.status].sort()).toEqual([201, 409])
    expect(await accounts().countDocuments({ usernameNormalized: username.toLowerCase() })).toBe(1)
  })

  it('rol inválido o ausente → 422 y sin documento (RF-2)', async () => {
    bump()
    const { username, password } = fresh()
    const bad = await register(postJson(URL, { username, password, role: 'admin' }))
    const missing = await register(postJson(URL, { username: `${username}b`, password }))

    expect(bad.status).toBe(422)
    expect(missing.status).toBe(422)
    expect(await accounts().countDocuments({ usernameNormalized: username.toLowerCase() })).toBe(0)
  })

  it('longitudes por debajo del mínimo → 422 con issues (RF-3,4)', async () => {
    const res = await register(postJson(URL, { username: 'a', password: 'corta', role: 'alumno' }))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe('invalid_input')
    expect(body.issues).toEqual(
      expect.arrayContaining([
        { field: 'username', code: 'too_short' },
        { field: 'password', code: 'too_short' },
      ]),
    )
  })

  it('cuerpo no-JSON o campos con tipos equivocados → 422, nada persistido (RF-17)', async () => {
    bump()
    const notJson = await register(
      new Request(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'no-json' }),
    )
    const wrongTypes = await register(postJson(URL, { username: 123, password: {}, role: [] }))

    expect(notJson.status).toBe(422)
    expect(wrongTypes.status).toBe(422)
    expect(await accounts().countDocuments({})).toBeGreaterThanOrEqual(0)
  })
})
