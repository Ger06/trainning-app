import Link from 'next/link'
import { RegisterForm } from '@/components/auth/RegisterForm'

export default function RegisterPage() {
  return (
    <main className="auth-main sheet-grid">
      <RegisterForm />
      <p className="auth-alt">
        ¿Ya tenés cuenta?{' '}
        <Link href="/login" className="auth-alt__link">
          Iniciar sesión
        </Link>
      </p>
    </main>
  )
}
