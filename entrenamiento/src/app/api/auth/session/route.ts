import { sessionCookie, sessionStore } from '@/infra/container'
import { AUTH_MESSAGES } from '@/lib/auth-messages'
import { jsonResponse, problem } from '@/lib/http/problem'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Sonda de sesión. Ruta protegida por `middleware.ts` (comprueba presencia de la
 * cookie). Aquí se hace la verificación fuerte: firma válida + sesión viva en
 * Mongo (RF‑14: una sesión revocada o vencida cuenta como ausente).
 */
export async function GET(request: Request) {
  const cookie = sessionCookie()
  const sessionId = cookie.read(request.headers.get('cookie'))
  const session = sessionId ? await (await sessionStore()).get(sessionId) : null

  if (!session) {
    return problem(401, { error: 'no_session', message: AUTH_MESSAGES.noSession })
  }

  return jsonResponse(200, { authenticated: true, accountId: session.accountId })
}
