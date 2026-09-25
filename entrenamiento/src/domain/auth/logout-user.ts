import type { SessionStore } from './ports'

/**
 * Caso de uso de cierre de sesión (constitución P3). RF‑15: invalida la sesión
 * del lado servidor. Idempotente: delega en `SessionStore.revoke`, que no falla
 * si la sesión ya no existe.
 */

export interface LogoutDeps {
  sessions: SessionStore
}

export async function logoutUser(sessionId: string, deps: LogoutDeps): Promise<void> {
  await deps.sessions.revoke(sessionId)
}
