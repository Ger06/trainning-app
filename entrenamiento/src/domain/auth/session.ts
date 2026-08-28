/**
 * Sesión iniciada (constitución P3: value object puro, sin React, sin red, sin
 * `mongodb`).
 *
 * - `id` viaja firmado en la cookie (T16/T17).
 * - `accountId` es el `Account.id` (string; el repositorio traduce a/desde
 *   `ObjectId`).
 * - `expiresAt` es el instante **absoluto** de caducidad.
 *
 * RF‑14: la vigencia depende sólo de `expiresAt`, no de la actividad. RF‑16:
 * `Session` no tiene noción de "recuérdame"; la duración uniforme se fija donde
 * se calcula `expiresAt` (T17, constante `MAX_AGE`). `createdAt` es un dato de
 * persistencia (T4/T19), no forma parte del value object.
 */
export interface Session {
  readonly id: string
  readonly accountId: string
  readonly expiresAt: Date
}

export function session(data: { id: string; accountId: string; expiresAt: Date }): Session {
  if (data.id.length === 0) {
    throw new Error('session.id no puede estar vacío')
  }
  if (data.accountId.length === 0) {
    throw new Error('session.accountId no puede estar vacío')
  }
  if (Number.isNaN(data.expiresAt.getTime())) {
    throw new Error('session.expiresAt no es una fecha válida')
  }
  return Object.freeze({
    id: data.id,
    accountId: data.accountId,
    expiresAt: data.expiresAt,
  })
}

/**
 * RF‑14: la sesión está vencida cuando `now` alcanza o pasa `expiresAt` (mismo
 * criterio que el índice TTL de Mongo, que borra con `expiresAt <= now`).
 */
export function isExpired(s: Session, now: Date): boolean {
  return now.getTime() >= s.expiresAt.getTime()
}

export function isActive(s: Session, now: Date): boolean {
  return !isExpired(s, now)
}
