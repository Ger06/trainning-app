import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'
import { PASSWORD_HASH_PREFIX } from '@/domain/auth/account'
import type { PasswordHasher } from '@/domain/auth/ports'

/**
 * Implementación de `PasswordHasher` con `scrypt` de `node:crypto` (constitución
 * P1: sin dependencias nuevas). RF‑8: almacenamiento irreversible con sal.
 *
 * Formato almacenado: `scrypt$<N>$<r>$<p>$<salt_b64url>$<hash_b64url>`
 * (empieza por `PASSWORD_HASH_PREFIX`, coherente con `assertHashed` de T8 y con
 * el `pattern` del esquema de `accounts` en T3).
 */

const N = 16_384
const R = 8
const P = 1
const KEYLEN = 64
const SALT_BYTES = 16
const OPTS: ScryptOptions = { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }

export const SCRYPT_PARAMS = { N, r: R, p: P, keylen: KEYLEN, saltBytes: SALT_BYTES } as const

function derive(plain: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(plain, salt, keylen, opts, (error, derivedKey) => {
      if (error) reject(error)
      else resolve(derivedKey)
    })
  })
}

interface ParsedHash {
  n: number
  r: number
  p: number
  salt: Buffer
  hash: Buffer
}

function parse(stored: string): ParsedHash | null {
  if (!stored.startsWith(PASSWORD_HASH_PREFIX)) return null
  const parts = stored.slice(PASSWORD_HASH_PREFIX.length).split('$')
  if (parts.length !== 5) return null

  const [nStr, rStr, pStr, saltB64, hashB64] = parts
  const n = Number(nStr)
  const r = Number(rStr)
  const p = Number(pStr)
  if (![n, r, p].every((value) => Number.isInteger(value) && value > 0)) return null

  const salt = Buffer.from(saltB64, 'base64url')
  const hash = Buffer.from(hashB64, 'base64url')
  if (salt.length === 0 || hash.length === 0) return null

  return { n, r, p, salt, hash }
}

export const scryptPasswordHasher: PasswordHasher = {
  async hash(plain) {
    const salt = randomBytes(SALT_BYTES)
    const dk = await derive(plain, salt, KEYLEN, OPTS)
    return [
      PASSWORD_HASH_PREFIX + String(N),
      R,
      P,
      salt.toString('base64url'),
      dk.toString('base64url'),
    ].join('$')
  },

  async verify(plain, stored) {
    const parsed = parse(stored)
    if (!parsed) return false

    const dk = await derive(plain, parsed.salt, parsed.hash.length, {
      N: parsed.n,
      r: parsed.r,
      p: parsed.p,
      maxmem: OPTS.maxmem,
    })
    return dk.length === parsed.hash.length && timingSafeEqual(dk, parsed.hash)
  },
}
