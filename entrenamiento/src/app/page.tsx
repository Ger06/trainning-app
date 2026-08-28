import Link from 'next/link'
import { cookies } from 'next/headers'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { SESSION_COOKIE_NAME } from '@/infra/session/session-cookie-constants'

export default async function HomePage() {
  const hasSession = (await cookies()).has(SESSION_COOKIE_NAME)

  return (
    <main className="auth-main sheet-grid">
      <div className="sheet">
        <header className="sheet__head">
          <span className="eyebrow">Entrenamiento</span>
          <span className="eyebrow sheet__tag">v0 · 001</span>
        </header>
        <h1 className="sheet__title">Entrenamiento</h1>

        {hasSession ? (
          <div className="home__actions">
            <p className="home__line">Tu sesión está abierta.</p>
            <LogoutButton />
          </div>
        ) : (
          <div className="home__actions">
            <Link href="/login" className="submit">
              Iniciar sesión
            </Link>
            <Link href="/register" className="ghost">
              Crear cuenta
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
