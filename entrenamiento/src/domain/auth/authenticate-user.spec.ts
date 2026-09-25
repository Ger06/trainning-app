import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { account, type Account } from './account'
import { InvalidInputError, UserNotFoundError, WrongPasswordError } from './errors'
import type { AccountRepository, PasswordHasher, SessionStore } from './ports'
import { session } from './session'
import { authenticateUser } from './authenticate-user'

const STORED = account({
  id: 'acc_1',
  username: 'Ana',
  usernameNormalized: 'ana',
  role: 'entrenador',
  passwordHash: 'scrypt$hash-de-ana',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
})

interface Overrides {
  found?: Account | null
  verifyResult?: boolean
}

function makeDeps(over: Overrides = {}) {
  const accounts: AccountRepository = {
    findByNormalizedUsername: vi.fn(async () => (over.found === undefined ? STORED : over.found)),
    findById: vi.fn(async () => null),
    insert: vi.fn(async () => {
      throw new Error('insert no debería llamarse en login')
    }),
  }
  const hasher: PasswordHasher = {
    hash: vi.fn(async () => {
      throw new Error('hash no debería llamarse en login')
    }),
    verify: vi.fn(async () => over.verifyResult ?? true),
  }
  const sessions: SessionStore = {
    issue: vi.fn(async (accountId: string) =>
      session({ id: 'sess_new', accountId, expiresAt: new Date('2026-12-31T00:00:00.000Z') }),
    ),
    get: vi.fn(async () => null),
    revoke: vi.fn(async () => {}),
  }
  return { accounts, hasher, sessions }
}

describe('authenticateUser', () => {
  it('credenciales correctas → sesión iniciada con la cuenta (RF-10)', async () => {
    const deps = makeDeps()
    const r = await authenticateUser({ username: 'Ana', password: 'clave-larga-1' }, deps)

    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('debía valer')
    expect(r.value.account.id).toBe('acc_1')
    expect(r.value.session.accountId).toBe('acc_1')
    expect(deps.hasher.verify).toHaveBeenCalledWith('clave-larga-1', 'scrypt$hash-de-ana')
  })

  it('busca por el username normalizado', async () => {
    const deps = makeDeps()
    await authenticateUser({ username: '  ANA ', password: 'clave-larga-1' }, deps)
    expect(deps.accounts.findByNormalizedUsername).toHaveBeenCalledWith('ana')
  })

  it('usuario inexistente → UserNotFoundError, sin llamar verify (RF-11)', async () => {
    const deps = makeDeps({ found: null })
    const r = await authenticateUser({ username: 'nadie', password: 'clave-larga-1' }, deps)

    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(UserNotFoundError)
    expect((r.error as UserNotFoundError).username).toBe('nadie')
    expect(deps.hasher.verify).not.toHaveBeenCalled()
    expect(deps.sessions.issue).not.toHaveBeenCalled()
  })

  it('contraseña incorrecta → WrongPasswordError, sin emitir sesión (RF-12)', async () => {
    const deps = makeDeps({ verifyResult: false })
    const r = await authenticateUser({ username: 'Ana', password: 'equivocada-1' }, deps)

    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(WrongPasswordError)
    expect(deps.sessions.issue).not.toHaveBeenCalled()
  })

  it('input por debajo del mínimo → InvalidInputError, sin tocar el repo (RF-13,17)', async () => {
    const deps = makeDeps()
    const r = await authenticateUser({ username: 'a', password: 'corta' }, deps)

    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(InvalidInputError)
    expect(deps.accounts.findByNormalizedUsername).not.toHaveBeenCalled()
    expect(deps.hasher.verify).not.toHaveBeenCalled()
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./authenticate-user.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
