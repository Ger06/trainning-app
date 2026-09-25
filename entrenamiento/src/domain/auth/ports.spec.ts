import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { account } from './account'
import { session, type Session } from './session'
import type {
  AccountRepository,
  Clock,
  IdGenerator,
  PasswordHasher,
  SessionStore,
} from './ports'

// Los puertos no tienen lógica: el "test" es que se puedan implementar de forma
// coherente con los value objects del dominio (compila) y que el módulo no
// aporte nada en runtime.

describe('ports · contrato de tipos', () => {
  it('AccountRepository se implementa con un doble en memoria', async () => {
    const repo: AccountRepository = {
      async findByNormalizedUsername() {
        return null
      },
      async findById() {
        return null
      },
      async insert(data) {
        return account({ id: 'acc_1', ...data })
      },
    }

    expect(await repo.findByNormalizedUsername('ana')).toBeNull()
    expect(await repo.findById('acc_1')).toBeNull()
    const acc = await repo.insert({
      username: 'Ana',
      usernameNormalized: 'ana',
      role: 'alumno',
      passwordHash: 'scrypt$demo',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    })
    expect(acc.id).toBe('acc_1')
    expect(acc.role).toBe('alumno')
  })

  it('PasswordHasher se implementa', async () => {
    const hasher: PasswordHasher = {
      async hash(plain) {
        return `scrypt$${plain}`
      },
      async verify(plain, stored) {
        return stored === `scrypt$${plain}`
      },
    }

    expect(await hasher.hash('secret12')).toBe('scrypt$secret12')
    expect(await hasher.verify('secret12', 'scrypt$secret12')).toBe(true)
    expect(await hasher.verify('otra', 'scrypt$secret12')).toBe(false)
  })

  it('SessionStore se implementa, con revoke idempotente', async () => {
    const rows = new Map<string, Session>()
    const store: SessionStore = {
      async issue(accountId) {
        const s = session({
          id: `s_${rows.size}`,
          accountId,
          expiresAt: new Date(Date.now() + 60_000),
        })
        rows.set(s.id, s)
        return s
      },
      async get(id) {
        return rows.get(id) ?? null
      },
      async revoke(id) {
        rows.delete(id)
      },
    }

    const s = await store.issue('acc_1')
    expect((await store.get(s.id))?.accountId).toBe('acc_1')
    await store.revoke(s.id)
    await store.revoke(s.id)
    expect(await store.get(s.id)).toBeNull()
  })

  it('Clock e IdGenerator se implementan', () => {
    const clock: Clock = { now: () => new Date(0) }
    const ids: IdGenerator = { newId: () => 'id-1' }
    expect(clock.now().getTime()).toBe(0)
    expect(ids.newId()).toBe('id-1')
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./ports.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })

  it('sólo declara tipos: no exporta nada en runtime', async () => {
    const mod = await import('./ports')
    expect(Object.keys(mod)).toHaveLength(0)
  })
})
