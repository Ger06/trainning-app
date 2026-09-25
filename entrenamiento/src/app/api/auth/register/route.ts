import { InvalidInputError } from '@/domain/auth/errors'
import { landingPathForRole } from '@/domain/auth/landing-path'
import { register, sessionCookie } from '@/infra/container'
import { authErrorResponse } from '@/lib/http/auth-error-response'
import { jsonResponse } from '@/lib/http/problem'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

export async function POST(request: Request) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return authErrorResponse(new InvalidInputError([]))
  }
  const body = asRecord(raw)

  // Sólo se leen estos tres campos; cualquier extra se ignora. Los tipos van
  // "tal cual" a la validación del dominio (RF‑17): un tipo equivocado → 422.
  const result = await register({
    username: body.username,
    password: body.password,
    role: body.role,
  })
  if (!result.ok) {
    return authErrorResponse(result.error)
  }

  const { account, session } = result.value
  return jsonResponse(
    201,
    { role: account.role, redirectTo: landingPathForRole(account.role) },
    { 'set-cookie': sessionCookie().serialize(session.id) },
  )
}
