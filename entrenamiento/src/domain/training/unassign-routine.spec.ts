import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { AssignmentNotFoundError } from './errors'
import type { AssignmentRepository } from './ports'
import { unassignRoutine } from './unassign-routine'

function makeDeps(deleted: boolean) {
  const assignments: AssignmentRepository = {
    replaceForSlot: vi.fn(),
    listByStudent: vi.fn(async () => []),
    deleteOwned: vi.fn(async () => deleted),
  }
  return { assignments }
}

describe('unassignRoutine (RF-2, RF-27, RF-28)', () => {
  it('quita una asignación propia (deja el slot vacío)', async () => {
    const deps = makeDeps(true)
    const r = await unassignRoutine({ trainerId: 't_1', assignmentId: 'as_1' }, deps)
    expect(r.ok).toBe(true)
    expect(deps.assignments.deleteOwned).toHaveBeenCalledWith('t_1', 'as_1')
  })

  it('asignación inexistente o de otro entrenador → AssignmentNotFoundError (RF-2)', async () => {
    const deps = makeDeps(false)
    const r = await unassignRoutine({ trainerId: 't_2', assignmentId: 'as_1' }, deps)
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('debía fallar')
    expect(r.error).toBeInstanceOf(AssignmentNotFoundError)
  })

  it('no consulta ninguna ventana temporal: se puede quitar en cualquier momento (RF-28)', async () => {
    // `deps` solo lleva `assignments`; no hay reloj ni chequeo de plazo.
    const deps = makeDeps(true)
    expect(Object.keys(deps)).toEqual(['assignments'])
    expect((await unassignRoutine({ trainerId: 't_1', assignmentId: 'as_9' }, deps)).ok).toBe(true)
  })
})

describe('pureza del módulo', () => {
  it('no importa React ni mongodb ni next', () => {
    const src = readFileSync(new URL('./unassign-routine.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from ['"](react|react-dom|mongodb|next)/)
    expect(src).not.toMatch(/require\(['"](react|react-dom|mongodb|next)/)
  })
})
