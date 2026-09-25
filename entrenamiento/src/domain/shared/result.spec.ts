import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { err, ok, type Result } from './result'
import { err as authErr, ok as authOk } from '../auth/result'

describe('Result · ok / err (T1, D12)', () => {
  it('ok envuelve el valor con el discriminante en true', () => {
    const r = ok(42)
    expect(r).toEqual({ ok: true, value: 42 })
  })

  it('err envuelve el error con el discriminante en false', () => {
    const boom = new Error('boom')
    const r = err(boom)
    expect(r).toEqual({ ok: false, error: boom })
  })

  it('el discriminante ok permite estrechar el tipo', () => {
    const good: Result<number, string> = ok(7)
    const bad: Result<number, string> = err('nope')

    expect(good.ok ? good.value : 'unreachable').toBe(7)
    expect(bad.ok ? 'unreachable' : bad.error).toBe('nope')
  })

  it('conserva referencias tal cual (no clona)', () => {
    const payload = { a: 1 }
    const r = ok(payload)
    expect(r.ok && r.value).toBe(payload)
  })
})

describe('re-export desde auth (T1, D12)', () => {
  it('auth/result re-exporta el mismo ok', () => {
    expect(authOk).toBe(ok)
  })

  it('auth/result re-exporta el mismo err', () => {
    expect(authErr).toBe(err)
  })

  it('el comportamiento por la ruta de auth es idéntico', () => {
    expect(authOk('x')).toEqual({ ok: true, value: 'x' })
    expect(authErr('x')).toEqual({ ok: false, error: 'x' })
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./result.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
