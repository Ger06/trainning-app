import type { Db } from 'mongodb'
import { newAccount } from '@/domain/auth/account'
import { normalizeUsername, parseCredentials } from '@/domain/auth/credentials'
import { InvalidTrainingInputError, type TrainingInputIssue } from '@/domain/training/errors'
import type { AccountLookup } from '@/domain/training/ports'
import { createMongoAccountRepository } from '@/infra/repositories/mongo-account-repository'
import { scryptPasswordHasher } from '@/infra/security/scrypt-password-hasher'

/**
 * Implementación del puerto `AccountLookup` del contexto de entrenamiento
 * (plan D8). Reutiliza el repo de cuentas y el hasher de la spec 001.
 *
 * `createAlumno` da de alta la cuenta con rol `alumno` y **NO emite sesión**
 * (RF-21b) — a diferencia de `registerUser`, que hace auto-login. Valida los
 * mínimos de la spec 001 (usuario ≥ 2, contraseña ≥ 8).
 */

const toIssues = (issues: readonly { field: string; code: string }[]): TrainingInputIssue[] =>
  issues.map((i) => ({ field: `passwordInicial:${i.field}`, code: i.code as TrainingInputIssue['code'] }))

export function createAlumnoProvisioning(db: Db): AccountLookup {
  const accounts = createMongoAccountRepository(db)

  return {
    async findByUsername(username) {
      const found = await accounts.findByNormalizedUsername(normalizeUsername(username))
      return found ? { id: found.id, role: found.role } : null
    },

    async createAlumno({ username, password }) {
      const parsed = parseCredentials({ username, password, role: 'alumno' })
      if (!parsed.ok) {
        throw new InvalidTrainingInputError(toIssues(parsed.error.issues))
      }
      const creds = parsed.value
      const passwordHash = await scryptPasswordHasher.hash(creds.password)
      const account = await accounts.insert(
        newAccount({
          username: creds.username,
          usernameNormalized: creds.usernameNormalized,
          role: 'alumno',
          passwordHash,
          createdAt: new Date(),
        }),
      )
      return { id: account.id }
    },
  }
}
