import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isActive, isExpired, session, type Session } from './session'

const make = (over: Partial<{ id: string; accountId: string; expiresAt: Date }> = {}): Session =>
  session({
    id: 'sess_1',
    accountId: 'acc_1',
    expiresAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  })

describe('session (construcción)', () => {
  it('crea el value object con los tres campos y nada más', () => {
    const s = make()
    expect(s).toEqual({
      id: 'sess_1',
      accountId: 'acc_1',
      expiresAt: new Date('2026-01-01T00:00:00.000Z'),
    })
    expect(Object.keys(s).sort()).toEqual(['accountId', 'expiresAt', 'id'])
  })

  it('devuelve un objeto congelado e inmutable (RF-14/RF-16)', () => {
    const s = make()
    expect(Object.isFrozen(s)).toBe(true)
    expect(() => {
      // @ts-expect-error expiresAt es readonly
      s.expiresAt = new Date()
    }).toThrow(TypeError)
  })

  it('rechaza id o accountId vacíos', () => {
    expect(() => make({ id: '' })).toThrow()
    expect(() => make({ accountId: '' })).toThrow()
  })

  it('rechaza una fecha de caducidad inválida', () => {
    expect(() => make({ expiresAt: new Date('nope') })).toThrow()
  })
})

describe('isExpired / isActive (RF-14)', () => {
  const s = make({ expiresAt: new Date('2026-06-01T12:00:00.000Z') })

  it('no está vencida antes de expiresAt', () => {
    expect(isExpired(s, new Date('2026-06-01T11:59:59.999Z'))).toBe(false)
    expect(isActive(s, new Date('2026-06-01T11:59:59.999Z'))).toBe(true)
  })

  it('está vencida justo en expiresAt', () => {
    expect(isExpired(s, new Date('2026-06-01T12:00:00.000Z'))).toBe(true)
  })

  it('está vencida después de expiresAt', () => {
    expect(isExpired(s, new Date('2026-06-02T00:00:00.000Z'))).toBe(true)
    expect(isActive(s, new Date('2026-06-02T00:00:00.000Z'))).toBe(false)
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./session.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
