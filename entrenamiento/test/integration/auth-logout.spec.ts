import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { POST as login } from '@/app/api/auth/login/route'
import { POST as logout } from '@/app/api/auth/logout/route'
import { POST as register } from '@/app/api/auth/register/route'
import { GET as sessionProbe } from '@/app/api/auth/session/route'
import { SESSIONS_COLLECTION } from '@/infra/db/migrations'
import {
  hasMongo,
  postJson,
  requestCookie,
  setupIntegrationDb,
  type IntegrationContext,
} from './_harness'

const REGISTER = 'http://localhost/api/auth/register'
const LOGIN = 'http://localhost/api/auth/login'
const LOGOUT = 'http://localhost/api/auth/logout'
const PROBE = 'http://localhost/api/auth/session'

const USER = { username: 'Ana', password: 'clave-larga-1' }

async function loginCookie(): Promise<string> {
  const res = await login(postJson(LOGIN, USER))
  return requestCookie(res.headers.get('set-cookie'))
}

describe.skipIf(!hasMongo)('T25 · POST /api/auth/logout (integración)', () => {
  let ctx: IntegrationContext

  beforeAll(async () => {
    ctx = await setupIntegrationDb()
    await register(postJson(REGISTER, { ...USER, role: 'alumno' }))
  })
  afterAll(async () => {
    await ctx.teardown()
  })

  it('con cookie → 200, borra la sesión de Mongo y limpia la cookie (RF-15)', async () => {
    const cookie = await loginCookie()
    const before = await ctx.db.collection(SESSIONS_COLLECTION).countDocuments({})
    expect(before).toBeGreaterThanOrEqual(1)

    const res = await logout(postJson(LOGOUT, {}, { cookie }))
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toMatch(/ent_session=;.*Max-Age=0/)

    // la sonda con la cookie vieja ya no reconoce sesión
    const probe = await sessionProbe(new Request(PROBE, { headers: { cookie } }))
    expect(probe.status).toBe(401)
  })

  it('sin cookie → 200 igualmente, con la cookie de borrado (idempotente)', async () => {
    const res = await logout(postJson(LOGOUT, {}))
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toMatch(/Max-Age=0/)
  })

  it('dos logins producen cookies con el mismo Max-Age (RF-16)', async () => {
    const a = await login(postJson(LOGIN, USER))
    const b = await login(postJson(LOGIN, USER))
    const maxAge = (h: string | null) => h?.match(/Max-Age=(\d+)/)?.[1]
    expect(maxAge(a.headers.get('set-cookie'))).toBe(maxAge(b.headers.get('set-cookie')))
    expect(maxAge(a.headers.get('set-cookie'))).toBeDefined()
  })
})
