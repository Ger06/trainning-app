'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

/**
 * T28 · Formulario de login. Sólo renderiza y delega en `/api/auth/login`
 * (RF‑9). En `200` redirige al `redirectTo` del cuerpo (RF‑10); en `401` muestra
 * el `message` del servidor: "no existe una cuenta con ese usuario" (RF‑11) o
 * "contraseña incorrecta" (RF‑12).
 */
export function LoginForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        router.push(typeof body.redirectTo === 'string' ? body.redirectTo : '/')
        router.refresh()
        return
      }
      setError(typeof body.message === 'string' ? body.message : 'No se pudo iniciar sesión.')
    } catch {
      setError('No se pudo conectar. Probá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="sheet">
      <header className="sheet__head">
        <span className="eyebrow">Entrenamiento</span>
        <span className="eyebrow sheet__tag">Acceso · 001</span>
      </header>
      <h1 className="sheet__title">Iniciar sesión</h1>

      <div className="row">
        <label htmlFor="username" className="row__label">
          Usuario
        </label>
        <input
          id="username"
          name="username"
          className="row__field"
          value={username}
          autoComplete="username"
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>

      <div className="row">
        <label htmlFor="password" className="row__label">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          className="row__field"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error && (
        <p role="alert" className="mark-wrong">
          {error}
        </p>
      )}

      <button type="submit" className="submit" disabled={submitting}>
        {submitting ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
