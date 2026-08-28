import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { POST as login } from '@/app/api/auth/login/route'
import { POST as logout } from '@/app/api/auth/logout/route'
import { POST as register } from '@/app/api/auth/register/route'
import { GET as sessionProbe } from '@/app/api/auth/session/route'
import { middleware } from '@/middleware'
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

describe.skipIf(!hasMongo)('T26 · middleware + GET /api/auth/session (integración)', () => {
  let ctx: IntegrationContext
  let validCookie: string

  beforeAll(async () => {
    ctx = await setupIntegrationDb()
    await register(postJson(REGISTER, { ...USER, role: 'alumno' }))
    validCookie = requestCookie((await login(postJson(LOGIN, USER))).headers.get('set-cookie'))
  })
  afterAll(async () => {
    await ctx.teardown()
  })

  describe('middleware · puerta por presencia de cookie', () => {
    it('ruta protegida sin cookie → 401 en /api', async () => {
      const res = middleware(new NextRequest(PROBE))
      expect(res.status).toBe(401)
    })

    it('ruta protegida con cookie presente → deja pasar', async () => {
      const res = middleware(new NextRequest(PROBE, { headers: { cookie: validCookie } }))
      expect(res.headers.get('x-middleware-next')).toBe('1')
    })

    it('ruta no protegida → deja pasar sin cookie', async () => {
      const res = middleware(new NextRequest('http://localhost/api/auth/login'))
      expect(res.headers.get('x-middleware-next')).toBe('1')
    })
  })

  describe('GET /api/auth/session · verificación fuerte', () => {
    it('sin cookie → 401', async () => {
      const res = await sessionProbe(new Request(PROBE))
      expect(res.status).toBe(401)
    })

    it('con cookie válida → 200 authenticated (RF-14: sobrevive al "reinicio")', async () => {
      const first = await sessionProbe(new Request(PROBE, { headers: { cookie: validCookie } }))
      expect(first.status).toBe(200)
      expect((await first.json()).authenticated).toBe(true)

      // mismo string de cookie, request nuevo = navegador reabierto
      const again = await sessionProbe(new Request(PROBE, { headers: { cookie: validCookie } }))
      expect(again.status).toBe(200)
    })

    it('cookie manipulada → 401', async () => {
      const res = await sessionProbe(
        new Request(PROBE, { headers: { cookie: `${validCookie}x` } }),
      )
      expect(res.status).toBe(401)
    })

    it('tras logout, la cookie vieja deja de valer (RF-15)', async () => {
      const cookie = requestCookie((await login(postJson(LOGIN, USER))).headers.get('set-cookie'))
      expect((await sessionProbe(new Request(PROBE, { headers: { cookie } }))).status).toBe(200)

      await logout(postJson(LOGOUT, {}, { cookie }))

      expect((await sessionProbe(new Request(PROBE, { headers: { cookie } }))).status).toBe(401)
    })
  })
})
