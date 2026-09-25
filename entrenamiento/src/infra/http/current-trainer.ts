import type { AccountRepository, SessionStore } from '@/domain/auth/ports'
import { err, ok, type Result } from '@/domain/shared/result'
import { ForbiddenError, UnauthenticatedError } from '@/domain/training/errors'

/**
 * Guard de servidor para las acciones del entrenador (plan D4). Resuelve
 * sesión → cuenta → rol y devuelve `{ trainerId }`. Verificación de dos niveles
 * (plan D9): el middleware comprueba **presencia** de cookie en Edge; aquí se
 * hace la comprobación fuerte contra la sesión viva y el rol.
 *
 * RF-1 (rol `entrenador`), RF-2 / RF-3 (el `trainerId` que devuelve acota todas
 * las consultas del caso de uso).
 */

export type CurrentTrainerError = UnauthenticatedError | ForbiddenError

export interface CurrentTrainerDeps {
  /** Lee el id de sesión de la cabecera `Cookie` (firma incluida). */
  readSessionId: (cookieHeader: string | null) => string | null
  sessions: SessionStore
  accounts: AccountRepository
}

export async function resolveCurrentTrainer(
  request: Request,
  deps: CurrentTrainerDeps,
): Promise<Result<{ trainerId: string }, CurrentTrainerError>> {
  const sessionId = deps.readSessionId(request.headers.get('cookie'))
  if (!sessionId) return err(new UnauthenticatedError())

  // `get` ya descarta sesiones revocadas o vencidas (RF-14 de la spec 001).
  const session = await deps.sessions.get(sessionId)
  if (!session) return err(new UnauthenticatedError())

  const account = await deps.accounts.findById(session.accountId)
  if (!account) return err(new UnauthenticatedError())
  if (account.role !== 'entrenador') return err(new ForbiddenError())

  return ok({ trainerId: account.id })
}
