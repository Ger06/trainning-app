import type { Role } from './credentials'

/**
 * Entidad de cuenta del dominio (constitución P3: sin React, sin red, sin
 * `mongodb`). El repositorio (T18) traduce entre esta forma y el documento de
 * Mongo, incluido `_id` ↔ `id`.
 *
 * RF‑7: `role` se fija al crear la cuenta y no hay forma de cambiarlo — ni
 * setter ni `withRole`; además el objeto se devuelve congelado.
 * RF‑8: sólo existe `passwordHash` (prefijo `scrypt$`), nunca `password`.
 */

export const PASSWORD_HASH_PREFIX = 'scrypt$'

export interface NewAccount {
  readonly username: string
  readonly usernameNormalized: string
  readonly role: Role
  readonly passwordHash: string
  readonly createdAt: Date
}

export interface Account extends NewAccount {
  readonly id: string
}

function assertHashed(passwordHash: string): void {
  if (!passwordHash.startsWith(PASSWORD_HASH_PREFIX)) {
    throw new Error(
      `passwordHash debe ser un hash con prefijo "${PASSWORD_HASH_PREFIX}", nunca texto claro`,
    )
  }
}

/** Datos de una cuenta nueva (aún sin `id`), listos para insertar. */
export function newAccount(data: {
  username: string
  usernameNormalized: string
  role: Role
  passwordHash: string
  createdAt: Date
}): NewAccount {
  assertHashed(data.passwordHash)
  return Object.freeze({
    username: data.username,
    usernameNormalized: data.usernameNormalized,
    role: data.role,
    passwordHash: data.passwordHash,
    createdAt: data.createdAt,
  })
}

/** Reconstruye una cuenta ya persistida (con `id`). */
export function account(data: {
  id: string
  username: string
  usernameNormalized: string
  role: Role
  passwordHash: string
  createdAt: Date
}): Account {
  assertHashed(data.passwordHash)
  return Object.freeze({
    id: data.id,
    username: data.username,
    usernameNormalized: data.usernameNormalized,
    role: data.role,
    passwordHash: data.passwordHash,
    createdAt: data.createdAt,
  })
}
