import {
  authenticateUser,
  type AuthenticateError,
  type AuthenticateInput,
  type AuthenticateSuccess,
} from '@/domain/auth/authenticate-user'
import { logoutUser } from '@/domain/auth/logout-user'
import type { SessionStore } from '@/domain/auth/ports'
import {
  registerUser,
  type RegisterError,
  type RegisterInput,
  type RegisterSuccess,
} from '@/domain/auth/register-user'
import type { Result } from '@/domain/auth/result'
import { getDb } from '@/infra/db/mongo-client'
import { createMongoAccountRepository } from '@/infra/repositories/mongo-account-repository'
import { createMongoSessionRepository } from '@/infra/repositories/mongo-session-repository'
import { createCookieSigner } from '@/infra/security/cookie-signer'
import { scryptPasswordHasher } from '@/infra/security/scrypt-password-hasher'
import { createSessionCookie, type SessionCookie } from '@/infra/session/cookie-session'
import { systemClock, uuidIdGenerator } from '@/infra/system'

/**
 * Composition root (constitución P4): el ÚNICO sitio que ensambla los casos de
 * uso del dominio con adaptadores concretos. Los route handlers (T23–T26) sólo
 * importan de aquí; nunca `mongodb` ni un repositorio directamente.
 */

async function authDeps() {
  const db = await getDb()
  return {
    accounts: createMongoAccountRepository(db),
    hasher: scryptPasswordHasher,
    sessions: createMongoSessionRepository(db, { ids: uuidIdGenerator, clock: systemClock }),
    clock: systemClock,
  }
}

export async function register(
  input: RegisterInput,
): Promise<Result<RegisterSuccess, RegisterError>> {
  return registerUser(input, await authDeps())
}

export async function authenticate(
  input: AuthenticateInput,
): Promise<Result<AuthenticateSuccess, AuthenticateError>> {
  const { accounts, hasher, sessions } = await authDeps()
  return authenticateUser(input, { accounts, hasher, sessions })
}

export async function logout(sessionId: string): Promise<void> {
  const { sessions } = await authDeps()
  return logoutUser(sessionId, { sessions })
}

export async function sessionStore(): Promise<SessionStore> {
  return (await authDeps()).sessions
}

let cookie: SessionCookie | undefined

export function sessionCookie(): SessionCookie {
  if (!cookie) {
    const secret = process.env.SESSION_SECRET
    if (!secret) {
      throw new Error('SESSION_SECRET no está definida')
    }
    cookie = createSessionCookie(createCookieSigner(secret))
  }
  return cookie
}
