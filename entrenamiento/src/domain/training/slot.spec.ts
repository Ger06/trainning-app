import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { InvalidTrainingInputError } from './errors'
import { MAX_WEEK } from './limits'
import { WEEKDAYS, parseSlot } from './slot'

function fields(input: unknown): string[] {
  const r = parseSlot(input)
  if (r.ok) return []
  expect(r.error).toBeInstanceOf(InvalidTrainingInputError)
  return r.error.issues.map((i) => i.field)
}

describe('parseSlot (RF-19)', () => {
  it('acepta semana entera ≥ 1 y un día del enum', () => {
    const r = parseSlot({ week: 1, weekday: 'lunes' })
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('debía valer')
    expect(r.value).toEqual({ week: 1, weekday: 'lunes' })
    expect(Object.isFrozen(r.value)).toBe(true)
  })

  it('acepta los siete días de la semana', () => {
    for (const d of WEEKDAYS) {
      expect(parseSlot({ week: 3, weekday: d }).ok).toBe(true)
    }
    expect(WEEKDAYS).toHaveLength(7)
  })

  it('rechaza semana 0, negativa, decimal o no numérica', () => {
    for (const w of [0, -1, 1.5, '1', null]) {
      expect(fields({ week: w, weekday: 'lunes' })).toContain('week')
    }
  })

  it('rechaza semana por encima de MAX_WEEK', () => {
    expect(fields({ week: MAX_WEEK + 1, weekday: 'lunes' })).toContain('week')
    expect(parseSlot({ week: MAX_WEEK, weekday: 'lunes' }).ok).toBe(true)
  })

  it('rechaza un día desconocido, con mayúsculas, en otro idioma o ausente', () => {
    expect(fields({ week: 1, weekday: 'Lunes' })).toContain('weekday')
    expect(fields({ week: 1, weekday: 'monday' })).toContain('weekday')
    expect(fields({ week: 1 })).toContain('weekday')
  })

  it('rechaza una entrada que no es objeto', () => {
    expect(fields('lunes')).toContain('slot')
    expect(fields(null)).toContain('slot')
    expect(fields([{ week: 1, weekday: 'lunes' }])).toContain('slot')
  })

  it('acumula las incidencias de semana y día', () => {
    expect(fields({ week: 0, weekday: 'x' })).toEqual(
      expect.arrayContaining(['week', 'weekday']),
    )
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./slot.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
