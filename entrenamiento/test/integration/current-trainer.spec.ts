import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { POST as register } from '@/app/api/auth/register/route'
import { currentTrainer } from '@/infra/container'
import { ForbiddenError, UnauthenticatedError } from '@/domain/training/errors'
import { hasMongo, postJson, requestCookie, setupIntegrationDb, type IntegrationContext } from './_harness'

const REGISTER = 'http://localhost/api/auth/register'
const GUARDED = 'http://localhost/api/exercises'

async function registerAnd(username: string, role: 'entrenador' | 'alumno'): Promise<string> {
  const res = await register(postJson(REGISTER, { username, password: 'contrasena8', role }))
  expect(res.status).toBe(201)
  return requestCookie(res.headers.get('set-cookie'))
}

describe.skipIf(!hasMongo)('T29 · currentTrainer (integración)', () => {
  let ctx: IntegrationContext

  beforeAll(async () => {
    ctx = await setupIntegrationDb()
  })
  afterAll(async () => {
    await ctx.teardown()
  })

  it('cookie de sesión de un entrenador → { trainerId } (RF-1)', async () => {
    const cookie = await registerAnd('coach-int', 'entrenador')
    const r = await currentTrainer(new Request(GUARDED, { headers: { cookie } }))
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('debía valer')
    expect(r.value.trainerId).toMatch(/^[0-9a-f]{24}$/)
  })

  it('cookie de sesión de un alumno → ForbiddenError (RF-1)', async () => {
    const cookie = await registerAnd('alum-int', 'alumno')
    const r = await currentTrainer(new Request(GUARDED, { headers: { cookie } }))
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(ForbiddenError)
  })

  it('sin cookie → UnauthenticatedError (RF-1)', async () => {
    const r = await currentTrainer(new Request(GUARDED))
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(UnauthenticatedError)
  })
})
