import { describe, expect, it } from 'vitest'
import { createCookieSigner } from './cookie-signer'

const SECRET = 'un-secreto-de-pruebas-largo'
const OTHER = 'otro-secreto-distinto-largo'

describe('createCookieSigner', () => {
  it('unsign recupera el valor firmado', () => {
    const signer = createCookieSigner(SECRET)
    const id = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
    expect(signer.unsign(signer.sign(id))).toBe(id)
  })

  it('rechaza un valor manipulado', () => {
    const signer = createCookieSigner(SECRET)
    const signed = signer.sign('sess-1')
    const tampered = signed.replace('sess-1', 'sess-2')
    expect(signer.unsign(tampered)).toBeNull()
  })

  it('rechaza una firma manipulada', () => {
    const signer = createCookieSigner(SECRET)
    const signed = signer.sign('sess-1')
    expect(signer.unsign(`${signed}x`)).toBeNull()
  })

  it('rechaza un valor sin firma', () => {
    const signer = createCookieSigner(SECRET)
    expect(signer.unsign('sess-1')).toBeNull()
    expect(signer.unsign('.abc')).toBeNull()
    expect(signer.unsign('')).toBeNull()
  })

  it('rechaza una firma hecha con otro secreto', () => {
    const a = createCookieSigner(SECRET)
    const b = createCookieSigner(OTHER)
    expect(b.unsign(a.sign('sess-1'))).toBeNull()
  })

  it('exige un secreto de longitud mínima', () => {
    expect(() => createCookieSigner('corto')).toThrow()
  })
})
