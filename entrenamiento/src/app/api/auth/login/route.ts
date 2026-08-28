import { InvalidInputError } from '@/domain/auth/errors'
import { landingPathForRole } from '@/domain/auth/landing-path'
import { authenticate, sessionCookie } from '@/infra/container'
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

  const result = await authenticate({ username: body.username, password: body.password })
  if (!result.ok) {
    return authErrorResponse(result.error)
  }

  const { account, session } = result.value
  return jsonResponse(
    200,
    { role: account.role, redirectTo: landingPathForRole(account.role) },
    { 'set-cookie': sessionCookie().serialize(session.id) },
  )
}
