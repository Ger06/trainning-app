import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import type { SessionStore } from './ports'
import { logoutUser } from './logout-user'

function makeStore() {
  const rows = new Set<string>(['sess_1'])
  const sessions: SessionStore = {
    issue: vi.fn(async () => {
      throw new Error('issue no debería llamarse en logout')
    }),
    get: vi.fn(async () => null),
    revoke: vi.fn(async (id: string) => {
      rows.delete(id)
    }),
  }
  return { sessions, rows }
}

describe('logoutUser', () => {
  it('llama a sessions.revoke con el id dado (RF-15)', async () => {
    const { sessions } = makeStore()
    await logoutUser('sess_1', { sessions })
    expect(sessions.revoke).toHaveBeenCalledWith('sess_1')
  })

  it('deja la sesión eliminada', async () => {
    const { sessions, rows } = makeStore()
    await logoutUser('sess_1', { sessions })
    expect(rows.has('sess_1')).toBe(false)
  })

  it('es idempotente: revocar dos veces resuelve sin lanzar', async () => {
    const { sessions } = makeStore()
    await logoutUser('sess_1', { sessions })
    await expect(logoutUser('sess_1', { sessions })).resolves.toBeUndefined()
    expect(sessions.revoke).toHaveBeenCalledTimes(2)
  })

  it('revocar un id inexistente tampoco lanza', async () => {
    const { sessions } = makeStore()
    await expect(logoutUser('sess_desconocida', { sessions })).resolves.toBeUndefined()
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./logout-user.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
