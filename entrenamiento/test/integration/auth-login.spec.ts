import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { POST as login } from '@/app/api/auth/login/route'
import { POST as register } from '@/app/api/auth/register/route'
import {
  hasMongo,
  postJson,
  setupIntegrationDb,
  type IntegrationContext,
} from './_harness'

const LOGIN = 'http://localhost/api/auth/login'
const REGISTER = 'http://localhost/api/auth/register'

const USER = { username: 'Ana', password: 'clave-larga-1' }

describe.skipIf(!hasMongo)('T24 · POST /api/auth/login (integración)', () => {
  let ctx: IntegrationContext

  beforeAll(async () => {
    ctx = await setupIntegrationDb()
    await register(postJson(REGISTER, { ...USER, role: 'alumno' }))
  })
  afterAll(async () => {
    await ctx.teardown()
  })

  it('credenciales correctas → 200 y Set-Cookie (RF-9,10)', async () => {
    const res = await login(postJson(LOGIN, USER))
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toMatch(/^ent_session=/)
    expect(await res.json()).toEqual({ role: 'alumno', redirectTo: '/' })
  })

  it('usuario inexistente → 401 con mensaje específico (RF-11)', async () => {
    const res = await login(postJson(LOGIN, { username: 'nadie', password: 'clave-larga-1' }))
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({
      error: 'user_not_found',
      message: 'no existe una cuenta con ese usuario',
    })
  })

  it('contraseña incorrecta → 401 con mensaje específico (RF-12)', async () => {
    const res = await login(postJson(LOGIN, { username: 'Ana', password: 'equivocada-1' }))
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({
      error: 'wrong_password',
      message: 'contraseña incorrecta',
    })
  })

  it('login por debajo del mínimo → 422, sin distinguir si la cuenta existe (RF-13)', async () => {
    const res = await login(postJson(LOGIN, { username: 'a', password: 'corta' }))
    expect(res.status).toBe(422)
    expect((await res.json()).error).toBe('invalid_input')
  })

  it('el login busca por username normalizado (mayúsculas/espacios)', async () => {
    const res = await login(postJson(LOGIN, { username: '  ANA  ', password: 'clave-larga-1' }))
    expect(res.status).toBe(200)
  })
})
