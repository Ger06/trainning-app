import { describe, expect, it } from 'vitest'
import { jsonResponse, problem } from './problem'

describe('problem', () => {
  it('produce { error, message } con el status dado y content-type JSON', async () => {
    const res = problem(422, { error: 'invalid_input', message: 'revisá los datos' })
    expect(res.status).toBe(422)
    expect(res.headers.get('content-type')).toMatch(/application\/json/)
    expect(await res.json()).toEqual({ error: 'invalid_input', message: 'revisá los datos' })
  })

  it('incluye issues cuando vienen', async () => {
    const res = problem(422, {
      error: 'invalid_input',
      message: 'x',
      issues: [{ field: 'username', code: 'too_short' }],
    })
    expect(await res.json()).toEqual({
      error: 'invalid_input',
      message: 'x',
      issues: [{ field: 'username', code: 'too_short' }],
    })
  })

  it('omite issues si es undefined o vacío', async () => {
    expect(await problem(409, { error: 'username_taken', message: 'x' }).json()).toEqual({
      error: 'username_taken',
      message: 'x',
    })
    expect(await problem(409, { error: 'x', message: 'y', issues: [] }).json()).toEqual({
      error: 'x',
      message: 'y',
    })
  })
})

describe('jsonResponse', () => {
  it('serializa el cuerpo y añade cabeceras extra (p. ej. Set-Cookie)', async () => {
    const res = jsonResponse(201, { role: 'alumno' }, { 'set-cookie': 'ent_session=abc' })
    expect(res.status).toBe(201)
    expect(res.headers.get('set-cookie')).toBe('ent_session=abc')
    expect(await res.json()).toEqual({ role: 'alumno' })
  })
})
