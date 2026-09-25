import { describe, expect, it, vi } from 'vitest'
import { account, type Account } from '@/domain/auth/account'
import type { AccountRepository, SessionStore } from '@/domain/auth/ports'
import { session } from '@/domain/auth/session'
import { ForbiddenError, UnauthenticatedError } from '@/domain/training/errors'
import { resolveCurrentTrainer } from './current-trainer'

const FUTURE = new Date(Date.now() + 3_600_000)

const trainer = account({
  id: 'acc_trainer',
  username: 'Coach',
  usernameNormalized: 'coach',
  role: 'entrenador',
  passwordHash: 'scrypt$demo',
  createdAt: new Date(0),
})
const student = account({ ...trainer, id: 'acc_student', role: 'alumno' })

interface Over {
  sessionId?: string | null
  sessionAccountId?: string | null
  account?: Account | null
}

function makeDeps(over: Over = {}) {
  const sessions: SessionStore = {
    issue: vi.fn(),
    get: vi.fn(async () =>
      over.sessionAccountId === null
        ? null
        : session({
            id: 's1',
            accountId: over.sessionAccountId ?? 'acc_trainer',
            expiresAt: FUTURE,
          }),
    ),
    revoke: vi.fn(),
  }
  const accounts: AccountRepository = {
    findByNormalizedUsername: vi.fn(async () => null),
    findById: vi.fn(async (id: string) => {
      if ('account' in over) return over.account ?? null
      if (id === 'acc_trainer') return trainer
      if (id === 'acc_student') return student
      return null
    }),
    insert: vi.fn(),
  }
  return {
    readSessionId: vi.fn(() => (over.sessionId === undefined ? 's1' : over.sessionId)),
    sessions,
    accounts,
  }
}

const req = () => new Request('http://localhost/api/exercises', { headers: { cookie: 'ent_session=x' } })

describe('resolveCurrentTrainer (RF-1, RF-2, RF-3)', () => {
  it('sesión válida de un entrenador → { trainerId }', async () => {
    const r = await resolveCurrentTrainer(req(), makeDeps())
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('debía valer')
    expect(r.value).toEqual({ trainerId: 'acc_trainer' })
  })

  it('sin cookie de sesión → UnauthenticatedError', async () => {
    const r = await resolveCurrentTrainer(req(), makeDeps({ sessionId: null }))
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(UnauthenticatedError)
  })

  it('sesión revocada o vencida (get → null) → UnauthenticatedError', async () => {
    const r = await resolveCurrentTrainer(req(), makeDeps({ sessionAccountId: null }))
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(UnauthenticatedError)
  })

  it('la cuenta de la sesión ya no existe → UnauthenticatedError', async () => {
    const r = await resolveCurrentTrainer(req(), makeDeps({ account: null }))
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(UnauthenticatedError)
  })

  it('sesión válida de un alumno → ForbiddenError (RF-1)', async () => {
    const r = await resolveCurrentTrainer(req(), makeDeps({ sessionAccountId: 'acc_student' }))
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(ForbiddenError)
  })
})
