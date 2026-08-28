import { NextResponse, type NextRequest } from 'next/server'
import { AUTH_MESSAGES } from '@/lib/auth-messages'
import { SESSION_COOKIE_NAME } from '@/infra/session/session-cookie-constants'

/**
 * T26 · Puerta de acceso a las zonas con cuenta. Sólo comprueba **presencia** de
 * la cookie de sesión (plan D9); la verificación fuerte (firma + sesión viva)
 * la hace cada handler/loader. Corre en Edge: nada de `node:crypto` ni driver.
 *
 * `[NECESITA ACLARACIÓN]` (spec.md): los espacios por rol aún no existen. Hoy
 * sólo se protege la sonda de sesión. Al añadir prefijos aquí hay que
 * reflejarlos también en `config.matcher` (Next exige un matcher estático).
 */
export const PROTECTED_PREFIXES: readonly string[] = ['/api/auth/session']

export function isProtected(
  pathname: string,
  prefixes: readonly string[] = PROTECTED_PREFIXES,
): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  if (!isProtected(pathname) || request.cookies.has(SESSION_COOKIE_NAME)) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'no_session', message: AUTH_MESSAGES.noSession },
      { status: 401 },
    )
  }

  const url = request.nextUrl.clone()
  url.pathname = '/login'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/api/auth/session/:path*', '/api/auth/session'],
}
