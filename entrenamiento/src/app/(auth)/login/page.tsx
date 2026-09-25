import Link from 'next/link'
import { LoginForm } from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <main className="auth-main sheet-grid">
      <LoginForm />
      <p className="auth-alt">
        ¿No tenés cuenta?{' '}
        <Link href="/register" className="auth-alt__link">
          Crear cuenta
        </Link>
      </p>
    </main>
  )
}
