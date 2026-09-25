import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Firma HMAC‑SHA256 del valor que viaja en la cookie de sesión (plan D4). Con
 * `node:crypto`, sin dependencias nuevas (constitución P1). El id de sesión es
 * opaco; la firma sólo garantiza que no ha sido manipulado por el cliente.
 */

const MIN_SECRET_LENGTH = 16

export interface CookieSigner {
  sign(value: string): string
  /** Devuelve el valor original si la firma es válida, o `null` si no. */
  unsign(signed: string): string | null
}

export function createCookieSigner(secret: string): CookieSigner {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`el secreto de firma debe tener al menos ${MIN_SECRET_LENGTH} caracteres`)
  }

  const signature = (value: string): string =>
    createHmac('sha256', secret).update(value).digest('base64url')

  return {
    sign(value) {
      return `${value}.${signature(value)}`
    },

    unsign(signed) {
      const dot = signed.lastIndexOf('.')
      if (dot <= 0) return null

      const value = signed.slice(0, dot)
      const provided = Buffer.from(signed.slice(dot + 1))
      const expected = Buffer.from(signature(value))

      if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
        return null
      }
      return value
    },
  }
}
