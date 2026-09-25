import { describe, expect, it } from 'vitest'
import { isDuplicateKeyError, planMigrations } from './migrate'
import type { Migration } from './types'

const stub = (name: string): Migration => ({ name, up: async () => {} })

describe('planMigrations', () => {
  it('ordena por nombre con independencia del orden de entrada', () => {
    const { toApply } = planMigrations([stub('0003'), stub('0001'), stub('0002')], new Set())
    expect(toApply.map((m) => m.name)).toEqual(['0001', '0002', '0003'])
  })

  it('separa las ya aplicadas de las pendientes', () => {
    const { toApply, toSkip } = planMigrations(
      [stub('0001'), stub('0002'), stub('0003')],
      new Set(['0001', '0002']),
    )
    expect(toApply.map((m) => m.name)).toEqual(['0003'])
    expect(toSkip).toEqual(['0001', '0002'])
  })

  it('lista vacía → plan vacío', () => {
    expect(planMigrations([], new Set())).toEqual({ toApply: [], toSkip: [] })
  })

  it('todas aplicadas → nada por aplicar', () => {
    const { toApply, toSkip } = planMigrations([stub('0001')], new Set(['0001']))
    expect(toApply).toEqual([])
    expect(toSkip).toEqual(['0001'])
  })
})

describe('isDuplicateKeyError', () => {
  it('reconoce el código 11000 de MongoDB', () => {
    expect(isDuplicateKeyError({ code: 11000 })).toBe(true)
  })

  it('rechaza cualquier otro valor', () => {
    expect(isDuplicateKeyError(new Error('boom'))).toBe(false)
    expect(isDuplicateKeyError({ code: 1 })).toBe(false)
    expect(isDuplicateKeyError(null)).toBe(false)
    expect(isDuplicateKeyError(undefined)).toBe(false)
  })
})
