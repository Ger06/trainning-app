import { logout, sessionCookie } from '@/infra/container'
import { jsonResponse } from '@/lib/http/problem'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const cookie = sessionCookie()
  const sessionId = cookie.read(request.headers.get('cookie'))

  // RF‑15: invalida la sesión del lado servidor (idempotente si no hay ninguna).
  if (sessionId) {
    await logout(sessionId)
  }

  return jsonResponse(200, { ok: true }, { 'set-cookie': cookie.clear() })
}
