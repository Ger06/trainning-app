import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { InvalidTrainingInputError } from './errors'
import { parseExerciseInput } from './parse-exercise'

function expectIssues(input: unknown, fields: string[]): void {
  const r = parseExerciseInput(input)
  expect(r.ok).toBe(false)
  if (r.ok) throw new Error('debía fallar')
  expect(r.error).toBeInstanceOf(InvalidTrainingInputError)
  expect(r.error.issues.map((i) => i.field).sort()).toEqual([...fields].sort())
}

describe('parseExerciseInput (RF-3, RF-4, RF-5)', () => {
  it('acepta nombre válido (recortado + normalizado) y descripción opcional', () => {
    const r = parseExerciseInput({ name: '  Press Banca  ', description: 'agarre medio' })
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('debía valer')
    expect(r.value).toEqual({
      name: 'Press Banca',
      nameNormalized: 'press banca',
      description: 'agarre medio',
    })
  })

  it('acepta sin descripción', () => {
    const r = parseExerciseInput({ name: 'Dominadas' })
    expect(r.ok && r.value).toEqual({ name: 'Dominadas', nameNormalized: 'dominadas' })
  })

  it('nombre de 2 caracteres es válido; de 1 es too_short (RF-4)', () => {
    expect(parseExerciseInput({ name: 'A2' }).ok).toBe(true)
    expectIssues({ name: 'S' }, ['name'])
  })

  it('nombre ausente o solo espacios → required', () => {
    expectIssues({ description: 'x' }, ['name'])
    expectIssues({ name: '   ' }, ['name'])
  })

  it('nombre o descripción por encima del máximo → too_long', () => {
    expectIssues({ name: 'x'.repeat(121) }, ['name'])
    expectIssues({ name: 'Curl', description: 'y'.repeat(2001) }, ['description'])
  })

  it('un campo de prescripción → issue (RF-5)', () => {
    expectIssues({ name: 'Sentadilla', sets: 3 }, ['sets'])
    expectIssues({ name: 'Sentadilla', reps: 10, restBetweenSetsSec: 60 }, [
      'reps',
      'restBetweenSetsSec',
    ])
  })

  it('entrada que no es objeto → issue', () => {
    expectIssues('Sentadilla', ['exercise'])
    expectIssues(null, ['exercise'])
    expectIssues([{ name: 'x' }], ['exercise'])
  })

  it('acumula varias incidencias (RF-3)', () => {
    expectIssues({ name: 'S', sets: 3 }, ['name', 'sets'])
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./parse-exercise.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
