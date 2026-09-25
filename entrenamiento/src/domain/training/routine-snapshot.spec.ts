import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Exercise } from './exercise'
import type { Routine } from './routine'
import { snapshotRoutine } from './routine-snapshot'

const D = new Date('2026-08-01T00:00:00.000Z')

// Objetos planos y MUTABLES (no pasan por las factorías): se castean a los tipos
// del dominio solo al llamar, para poder mutarlos después y comprobar que el
// snapshot copió por valor.
function mutableExercise(over: Record<string, unknown> = {}) {
  return {
    id: 'ex_1',
    trainerId: 't_1',
    name: 'Sentadilla',
    description: 'barra alta' as string | undefined,
    nameNormalized: 'sentadilla',
    createdAt: D,
    updatedAt: D,
    ...over,
  }
}

function mutableRoutine(over: Record<string, unknown> = {}) {
  return {
    id: 'rt_1',
    trainerId: 't_1',
    name: 'Full A',
    note: 'piernas' as string | undefined,
    nameNormalized: 'full a',
    blocks: [
      {
        exercises: [
          { exerciseId: 'ex_1', sets: 3, reps: 10, restBetweenSetsSec: 90, restAfterExerciseSec: 30 },
        ],
        rounds: 2,
        restBetweenRoundsSec: 60,
      },
    ],
    createdAt: D,
    updatedAt: D,
    ...over,
  }
}

const snap = (
  rt: ReturnType<typeof mutableRoutine>,
  exs: ReturnType<typeof mutableExercise>[],
) => snapshotRoutine(rt as unknown as Routine, exs as unknown as Exercise[])

describe('snapshotRoutine (RF-24)', () => {
  it('incrusta nombre y descripción de cada ejercicio y copia la prescripción', () => {
    expect(snap(mutableRoutine(), [mutableExercise()])).toEqual({
      routineId: 'rt_1',
      name: 'Full A',
      note: 'piernas',
      blocks: [
        {
          exercises: [
            {
              exerciseId: 'ex_1',
              name: 'Sentadilla',
              description: 'barra alta',
              sets: 3,
              reps: 10,
              restBetweenSetsSec: 90,
              restAfterExerciseSec: 30,
            },
          ],
          rounds: 2,
          restBetweenRoundsSec: 60,
        },
      ],
    })
  })

  it('congela profundamente todos los niveles', () => {
    const s = snap(mutableRoutine(), [mutableExercise()])
    expect(Object.isFrozen(s)).toBe(true)
    expect(Object.isFrozen(s.blocks)).toBe(true)
    expect(Object.isFrozen(s.blocks[0])).toBe(true)
    expect(Object.isFrozen(s.blocks[0].exercises)).toBe(true)
    expect(Object.isFrozen(s.blocks[0].exercises[0])).toBe(true)
  })

  it('mutar la rutina o el ejercicio origen no altera el snapshot (RF-24)', () => {
    const rt = mutableRoutine()
    const ex = mutableExercise()
    const s = snap(rt, [ex])

    rt.name = 'CAMBIADO'
    rt.blocks[0].rounds = 99
    rt.blocks[0].exercises[0].sets = 999
    ex.name = 'OTRO NOMBRE'
    ex.description = 'otra'

    expect(s.name).toBe('Full A')
    expect(s.blocks[0].rounds).toBe(2)
    expect(s.blocks[0].exercises[0].sets).toBe(3)
    expect(s.blocks[0].exercises[0].name).toBe('Sentadilla')
    expect(s.blocks[0].exercises[0].description).toBe('barra alta')
  })

  it('omite note y description cuando no vienen', () => {
    const s = snap(mutableRoutine({ note: undefined }), [mutableExercise({ description: undefined })])
    expect(s).not.toHaveProperty('note')
    expect(s.blocks[0].exercises[0]).not.toHaveProperty('description')
  })

  it('lanza si falta un ejercicio referenciado', () => {
    expect(() => snap(mutableRoutine(), [])).toThrow(/ex_1/)
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./routine-snapshot.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
