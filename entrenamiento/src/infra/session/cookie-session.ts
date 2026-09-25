import type { CookieSigner } from '@/infra/security/cookie-signer'
import { MAX_AGE_SECONDS, SESSION_COOKIE_NAME } from './session-cookie-constants'

/**
 * Serialización de la cookie de sesión (plan D4).
 *
 * RF‑14: `Max-Age` largo → la sesión sobrevive al cierre del navegador y no
 * caduca por inactividad. RF‑16: **una única** constante `MAX_AGE_SECONDS`; no
 * hay parámetro de duración ni "recuérdame", el comportamiento es uniforme.
 */

export { MAX_AGE_SECONDS, SESSION_COOKIE_NAME }

const BASE_ATTRS = ['Path=/', 'HttpOnly', 'SameSite=Lax', 'Secure']

export interface SessionCookie {
  /** Cabecera `Set-Cookie` que instala la sesión. */
  serialize(sessionId: string): string
  /** Cabecera `Set-Cookie` que borra la sesión (logout, RF‑15). */
  clear(): string
  /** Lee el id de sesión de una cabecera `Cookie`, o `null` si falta/no valida. */
  read(cookieHeader: string | null | undefined): string | null
  /** Instante absoluto de caducidad a partir de `now` (para `SessionStore.issue`). */
  expiryFrom(now: Date): Date
}

export function createSessionCookie(signer: CookieSigner): SessionCookie {
  return {
    serialize(sessionId) {
      const value = encodeURIComponent(signer.sign(sessionId))
      return [`${SESSION_COOKIE_NAME}=${value}`, `Max-Age=${MAX_AGE_SECONDS}`, ...BASE_ATTRS].join(
        '; ',
      )
    },

    clear() {
      return [`${SESSION_COOKIE_NAME}=`, 'Max-Age=0', ...BASE_ATTRS].join('; ')
    },

    read(cookieHeader) {
      if (!cookieHeader) return null
      for (const part of cookieHeader.split(';')) {
        const eq = part.indexOf('=')
        if (eq === -1) continue
        if (part.slice(0, eq).trim() !== SESSION_COOKIE_NAME) continue
        const raw = part.slice(eq + 1).trim()
        if (raw === '') return null
        return signer.unsign(decodeURIComponent(raw))
      }
      return null
    },

    expiryFrom(now) {
      return new Date(now.getTime() + MAX_AGE_SECONDS * 1000)
    },
  }
}
