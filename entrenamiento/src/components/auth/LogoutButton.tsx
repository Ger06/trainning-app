'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * T29 · Botón de cierre de sesión (RF‑15). `POST /api/auth/logout` y lleva al
 * login. Quien lo monta decide cuándo mostrarlo (hay sesión activa).
 */
export function LogoutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function onClick() {
    setBusy(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // el logout limpia la cookie igualmente; seguimos al login
    } finally {
      router.push('/login')
      router.refresh()
    }
  }

  return (
    <button type="button" className="ghost" onClick={onClick} disabled={busy}>
      {busy ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  )
}
