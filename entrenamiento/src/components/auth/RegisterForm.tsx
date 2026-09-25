'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ROLES } from '@/domain/auth/credentials'

const ROLE_META: Record<string, { label: string; note: string }> = {
  entrenador: { label: 'Entrenador', note: 'Armás y asignás rutinas.' },
  alumno: { label: 'Alumno', note: 'Consultás tu cronograma.' },
}

/**
 * T27 · Formulario de registro. Sólo renderiza y delega en `/api/auth/register`
 * (RF‑1, RF‑2). En `201` redirige al `redirectTo` del cuerpo (RF‑6); en 409/422
 * muestra el `message` del servidor, que es la autoridad (RF‑17).
 */
export function RegisterForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('') // sin preselección
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password, role: role || undefined }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        router.push(typeof body.redirectTo === 'string' ? body.redirectTo : '/')
        router.refresh()
        return
      }
      setError(typeof body.message === 'string' ? body.message : 'No se pudo crear la cuenta.')
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
        <span className="eyebrow sheet__tag">Alta · 001</span>
      </header>
      <h1 className="sheet__title">Crear cuenta</h1>

      <div className="row">
        <label htmlFor="username" className="row__label">
          Usuario
        </label>
        <input
          id="username"
          name="username"
          className="row__field"
          value={username}
          minLength={2}
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
          minLength={8}
          autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <fieldset className="cells">
        <legend className="row__label">Ingresás como</legend>
        {ROLES.map((r) => {
          const active = role === r
          return (
            <label key={r} className={active ? 'cell cell--on' : 'cell'}>
              <input
                type="radio"
                name="role"
                value={r}
                className="cell__input"
                checked={active}
                onChange={() => setRole(r)}
              />
              <span className="cell__mark" aria-hidden="true">
                {active ? '✓' : ''}
              </span>
              <span className="cell__body">
                <span className="cell__name">{ROLE_META[r].label}</span>
                <span className="cell__note">{ROLE_META[r].note}</span>
              </span>
            </label>
          )
        })}
      </fieldset>

      {error && (
        <p role="alert" className="mark-wrong">
          {error}
        </p>
      )}

      <button type="submit" className="submit" disabled={submitting}>
        {submitting ? 'Creando…' : 'Crear cuenta'}
      </button>
    </form>
  )
}
