import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { InvalidTrainingInputError } from './errors'
import { MAX_BLOCKS, MAX_SETS } from './limits'
import { parseRoutineDraft } from './parse-routine'

const rawBe = (over: Record<string, unknown> = {}) => ({
  exerciseId: 'ex_1',
  sets: 3,
  reps: 10,
  ...over,
})
const rawBlock = (over: Record<string, unknown> = {}) => ({
  exercises: [rawBe()],
  rounds: 2,
  restBetweenRoundsSec: 60,
  ...over,
})
const rawRoutine = (over: Record<string, unknown> = {}) => ({
  name: 'Full A',
  blocks: [rawBlock()],
  ...over,
})

function issuesFor(input: unknown): string[] {
  const r = parseRoutineDraft(input)
  if (r.ok) return []
  expect(r.error).toBeInstanceOf(InvalidTrainingInputError)
  return r.error.issues.map((i) => i.field)
}

describe('parseRoutineDraft (RF-3, RF-10..RF-15, RF-13b)', () => {
  it('acepta una rutina válida, normaliza el nombre y aplica descansos por defecto', () => {
    const r = parseRoutineDraft(rawRoutine({ name: '  Full  A ' }))
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('debía valer')
    // `name` se guarda recortado (espaciado interno tal cual); `nameNormalized` colapsa.
    expect(r.value.name).toBe('Full  A')
    expect(r.value.nameNormalized).toBe('full a')
    expect(r.value.blocks[0].exercises[0]).toMatchObject({
      exerciseId: 'ex_1',
      sets: 3,
      reps: 10,
      restBetweenSetsSec: 0,
      restAfterExerciseSec: 0,
    })
  })

  it('conserva el orden de bloques y de ejercicios (RF-11)', () => {
    const input = rawRoutine({
      blocks: [
        rawBlock({ exercises: [rawBe({ exerciseId: 'a' }), rawBe({ exerciseId: 'b' })] }),
        rawBlock({ exercises: [rawBe({ exerciseId: 'c' })] }),
      ],
    })
    const r = parseRoutineDraft(input)
    if (!r.ok) throw new Error('debía valer')
    expect(r.value.blocks.map((b) => b.exercises.map((e) => e.exerciseId))).toEqual([
      ['a', 'b'],
      ['c'],
    ])
  })

  it('rutina sin bloques o bloque sin ejercicios → issue (RF-15)', () => {
    expect(issuesFor(rawRoutine({ blocks: [] }))).toContain('blocks')
    expect(issuesFor(rawRoutine({ blocks: [rawBlock({ exercises: [] })] }))).toContain(
      'blocks.0.exercises',
    )
  })

  it('rondas 0 o series 0 → issue (RF-12, RF-13)', () => {
    expect(issuesFor(rawRoutine({ blocks: [rawBlock({ rounds: 0 })] }))).toContain('blocks.0.rounds')
    expect(
      issuesFor(rawRoutine({ blocks: [rawBlock({ exercises: [rawBe({ sets: 0 })] })] })),
    ).toContain('blocks.0.exercises.0.sets')
  })

  it('ejercicio sin repeticiones ni tiempo → issue (RF-13)', () => {
    const noWork = { exerciseId: 'ex_1', sets: 3 }
    expect(
      issuesFor(rawRoutine({ blocks: [rawBlock({ exercises: [noWork] })] })),
    ).toContain('blocks.0.exercises.0.reps')
  })

  it('acepta repeticiones y tiempo juntos (RF-13)', () => {
    const both = { exerciseId: 'ex_1', sets: 4, reps: 8, timeSec: 30 }
    expect(parseRoutineDraft(rawRoutine({ blocks: [rawBlock({ exercises: [both] })] })).ok).toBe(true)
  })

  it('descanso tras el ejercicio ausente → 0 en la salida (RF-13)', () => {
    const r = parseRoutineDraft(rawRoutine())
    if (!r.ok) throw new Error('debía valer')
    expect(r.value.blocks[0].exercises[0].restAfterExerciseSec).toBe(0)
  })

  it('acepta el mismo exerciseId repetido en el bloque (RF-14)', () => {
    const dup = rawBlock({ exercises: [rawBe(), rawBe()] })
    expect(parseRoutineDraft(rawRoutine({ blocks: [dup] })).ok).toBe(true)
  })

  it('respeta los topes de limits.ts', () => {
    expect(
      issuesFor(rawRoutine({ blocks: [rawBlock({ exercises: [rawBe({ sets: MAX_SETS + 1 })] })] })),
    ).toContain('blocks.0.exercises.0.sets')
    const many = Array.from({ length: MAX_BLOCKS + 1 }, () => rawBlock())
    expect(issuesFor(rawRoutine({ blocks: many }))).toContain('blocks')
  })

  it('nombre inválido y entrada no-objeto → issue (RF-3, RF-10)', () => {
    expect(issuesFor(rawRoutine({ name: 'A' }))).toContain('name')
    expect(issuesFor(rawRoutine({ name: '   ' }))).toContain('name')
    expect(issuesFor('Full A')).toContain('routine')
    expect(issuesFor(null)).toContain('routine')
  })

  it('acumula varias incidencias', () => {
    const fields = issuesFor(rawRoutine({ name: 'A', blocks: [rawBlock({ rounds: 0 })] }))
    expect(fields).toEqual(expect.arrayContaining(['name', 'blocks.0.rounds']))
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./parse-routine.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
