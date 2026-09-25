import { describe, expect, it } from 'vitest'
import { createCookieSigner } from '@/infra/security/cookie-signer'
import { MAX_AGE_SECONDS, SESSION_COOKIE_NAME, createSessionCookie } from './cookie-session'

const cookie = createSessionCookie(createCookieSigner('un-secreto-de-pruebas-largo'))

/** Convierte una cabecera Set-Cookie en la cabecera Cookie que envía el navegador. */
const asRequestCookie = (setCookie: string): string => setCookie.split(';')[0]

describe('createSessionCookie · serialize', () => {
  const header = cookie.serialize('7c9e6679-7425-40de-944b-e07fc1f90ae7')

  it('incluye los atributos de seguridad y el Max-Age de la constante', () => {
    expect(header).toContain(`${SESSION_COOKIE_NAME}=`)
    expect(header).toContain('HttpOnly')
    expect(header).toContain('SameSite=Lax')
    expect(header).toContain('Secure')
    expect(header).toContain('Path=/')
    expect(header).toContain(`Max-Age=${MAX_AGE_SECONDS}`)
  })

  it('usa siempre el mismo Max-Age (RF-16: sin "recuérdame")', () => {
    const a = asRequestCookie(cookie.serialize('a'.repeat(8)))
    const b = cookie.serialize('b'.repeat(8))
    const maxAge = (s: string) => s.match(/Max-Age=(\d+)/)?.[1]
    expect(maxAge(cookie.serialize('x'))).toBe(String(MAX_AGE_SECONDS))
    expect(maxAge(b)).toBe(String(MAX_AGE_SECONDS))
    expect(a).toContain(SESSION_COOKIE_NAME)
  })

  it('Max-Age es largo: la sesión sobrevive al cierre del navegador (RF-14)', () => {
    expect(MAX_AGE_SECONDS).toBeGreaterThanOrEqual(30 * 24 * 60 * 60)
  })
})

describe('createSessionCookie · round-trip', () => {
  it('read recupera el id de una cookie recién serializada', () => {
    const id = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
    const reqCookie = asRequestCookie(cookie.serialize(id))
    expect(cookie.read(reqCookie)).toBe(id)
  })

  it('read encuentra la cookie entre otras', () => {
    const id = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
    const mine = asRequestCookie(cookie.serialize(id))
    expect(cookie.read(`theme=dark; ${mine}; lang=es`)).toBe(id)
  })

  it('read rechaza un valor manipulado', () => {
    const signer = createCookieSigner('un-secreto-de-pruebas-largo')
    const tampered = `${SESSION_COOKIE_NAME}=${encodeURIComponent(signer.sign('sess-1')).replace('sess-1', 'sess-2')}`
    expect(cookie.read(tampered)).toBeNull()
  })

  it('read devuelve null si falta la cookie o va vacía', () => {
    expect(cookie.read(null)).toBeNull()
    expect(cookie.read('')).toBeNull()
    expect(cookie.read('theme=dark')).toBeNull()
    expect(cookie.read(`${SESSION_COOKIE_NAME}=`)).toBeNull()
  })
})

describe('createSessionCookie · clear y expiryFrom', () => {
  it('clear vence la cookie (Max-Age=0)', () => {
    const header = cookie.clear()
    expect(header).toContain(`${SESSION_COOKIE_NAME}=`)
    expect(header).toContain('Max-Age=0')
    expect(header).toContain('HttpOnly')
  })

  it('expiryFrom suma exactamente MAX_AGE_SECONDS', () => {
    const now = new Date('2026-08-27T10:00:00.000Z')
    expect(cookie.expiryFrom(now).getTime()).toBe(now.getTime() + MAX_AGE_SECONDS * 1000)
  })
})
