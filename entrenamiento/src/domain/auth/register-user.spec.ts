import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { account, type Account, type NewAccount } from './account'
import { InvalidInputError, UsernameTakenError } from './errors'
import type { AccountRepository, Clock, PasswordHasher, SessionStore } from './ports'
import { session } from './session'
import { registerUser } from './register-user'

const FIXED_NOW = new Date('2026-08-27T10:00:00.000Z')

interface Overrides {
  existing?: Account | null
  insertImpl?: (data: NewAccount) => Promise<Account>
}

function makeDeps(over: Overrides = {}) {
  const insertCalls: NewAccount[] = []
  const accounts: AccountRepository = {
    findByNormalizedUsername: vi.fn(async () => over.existing ?? null),
    findById: vi.fn(async () => null),
    insert: vi.fn(async (data: NewAccount) => {
      insertCalls.push(data)
      return over.insertImpl ? over.insertImpl(data) : account({ id: 'acc_new', ...data })
    }),
  }
  const hasher: PasswordHasher = {
    hash: vi.fn(async (plain: string) => `scrypt$${plain}`),
    verify: vi.fn(async () => true),
  }
  const sessions: SessionStore = {
    issue: vi.fn(async (accountId: string) =>
      session({ id: 'sess_new', accountId, expiresAt: new Date(FIXED_NOW.getTime() + 60_000) }),
    ),
    get: vi.fn(async () => null),
    revoke: vi.fn(async () => {}),
  }
  const clock: Clock = { now: () => FIXED_NOW }
  return { accounts, hasher, sessions, clock, insertCalls }
}

const validInput = { username: '  Ana ', password: 'clave-larga-1', role: 'alumno' }

describe('registerUser', () => {
  it('happy path: crea la cuenta, la deja logueada y emite Session (RF-1,5,6)', async () => {
    const deps = makeDeps()
    const r = await registerUser(validInput, deps)

    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('debía valer')
    expect(r.value.account.id).toBe('acc_new')
    expect(r.value.account.username).toBe('Ana')
    expect(r.value.account.usernameNormalized).toBe('ana')
    expect(r.value.account.role).toBe('alumno')
    expect(r.value.account.createdAt).toEqual(FIXED_NOW)
    expect(r.value.session.accountId).toBe('acc_new')
    expect(deps.sessions.issue).toHaveBeenCalledWith('acc_new')
  })

  it('hashea la contraseña y nunca pasa texto claro al repo (RF-8)', async () => {
    const deps = makeDeps()
    await registerUser(validInput, deps)

    expect(deps.hasher.hash).toHaveBeenCalledWith('clave-larga-1')
    const [inserted] = deps.insertCalls
    expect(inserted.passwordHash).toBe('scrypt$clave-larga-1')
    expect(Object.values(inserted)).not.toContain('clave-larga-1')
  })

  it('preserva el rol elegido (RF-7)', async () => {
    const deps = makeDeps()
    await registerUser({ ...validInput, role: 'entrenador' }, deps)
    expect(deps.insertCalls[0]?.role).toBe('entrenador')
  })

  it('entrada inválida → InvalidInputError, sin tocar repo ni hasher (RF-2,13)', async () => {
    const deps = makeDeps()
    const r = await registerUser({ username: 'a', password: 'x', role: undefined }, deps)

    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(InvalidInputError)
    expect(deps.accounts.findByNormalizedUsername).not.toHaveBeenCalled()
    expect(deps.hasher.hash).not.toHaveBeenCalled()
    expect(deps.accounts.insert).not.toHaveBeenCalled()
  })

  it('username ya existente → UsernameTakenError, sin insertar (RF-5)', async () => {
    const deps = makeDeps({
      existing: account({
        id: 'acc_old',
        username: 'Ana',
        usernameNormalized: 'ana',
        role: 'alumno',
        passwordHash: 'scrypt$viejo',
        createdAt: FIXED_NOW,
      }),
    })
    const r = await registerUser(validInput, deps)

    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(UsernameTakenError)
    expect((r.error as UsernameTakenError).username).toBe('Ana')
    expect(deps.accounts.insert).not.toHaveBeenCalled()
  })

  it('carrera: insert lanza UsernameTakenError → err sin emitir sesión (RF-5)', async () => {
    const deps = makeDeps({
      insertImpl: async () => {
        throw new UsernameTakenError('Ana')
      },
    })
    const r = await registerUser(validInput, deps)

    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(UsernameTakenError)
    expect(deps.sessions.issue).not.toHaveBeenCalled()
  })

  it('propaga un error inesperado del repo', async () => {
    const deps = makeDeps({
      insertImpl: async () => {
        throw new Error('mongo caído')
      },
    })
    await expect(registerUser(validInput, deps)).rejects.toThrow('mongo caído')
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./register-user.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
