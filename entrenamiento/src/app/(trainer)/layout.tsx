import type { ReactNode } from 'react'
import Link from 'next/link'
import { LogoutButton } from '@/components/auth/LogoutButton'

/**
 * Marco de las páginas del entrenador (spec 002). Solo layout y navegación; la
 * verificación de rol la hace `currentTrainer` en cada handler (RF-1) y la
 * puerta de presencia de cookie está en `middleware.ts`.
 */
export default function TrainerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="trainer-shell sheet-grid">
      <nav className="trainer-nav">
        <span className="eyebrow">Entrenamiento · 002</span>
        <Link href="/exercises" className="trainer-nav__link">
          Ejercicios
        </Link>
        <Link href="/routines" className="trainer-nav__link">
          Rutinas
        </Link>
        <Link href="/assign" className="trainer-nav__link">
          Asignar
        </Link>
        <span className="trainer-nav__spacer" />
        <LogoutButton />
      </nav>
      {children}
    </div>
  )
}
