'use client'

import { useState, type FormEvent } from 'react'

interface Issue {
  field: string
  code: string
}

interface Props {
  /** Sin valor → alta (POST). Con valor → edición (PATCH) de ese ejercicio. */
  initial?: { id: string; name: string; description?: string }
  onSaved: () => void
  onCancel?: () => void
}

/**
 * T35 · Alta/edición de un ejercicio. Solo renderiza y delega en la API
 * (`POST`/`PATCH /api/exercises`). El servidor es la autoridad (RF-3): los
 * `issues` y el `message` de la respuesta se muestran tal cual.
 */
export function ExerciseForm({ initial, onSaved, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [error, setError] = useState<string | null>(null)
  const [issues, setIssues] = useState<Issue[]>([])
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIssues([])
    setBusy(true)
    try {
      const res = await fetch(
        initial ? `/api/exercises/${initial.id}` : '/api/exercises',
        {
          method: initial ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, description: description || undefined }),
        },
      )
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        if (!initial) {
          setName('')
          setDescription('')
        }
        onSaved()
        return
      }
      setError(typeof body.message === 'string' ? body.message : 'No se pudo guardar.')
      setIssues(Array.isArray(body.issues) ? body.issues : [])
    } catch {
      setError('No se pudo conectar. Probá de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="stack">
      <div className="cluster">
        <div className="field field--grow">
          <label htmlFor="ex-name">Nombre</label>
          <input
            id="ex-name"
            value={name}
            minLength={2}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="field field--grow">
          <label htmlFor="ex-desc">Descripción (opcional)</label>
          <input id="ex-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      {issues.length > 0 && (
        <ul className="mark-wrong" role="alert">
          {issues.map((i) => (
            <li key={`${i.field}:${i.code}`}>
              {i.field}: {i.code}
            </li>
          ))}
        </ul>
      )}
      {error && issues.length === 0 && (
        <p role="alert" className="mark-wrong">
          {error}
        </p>
      )}

      <div className="cluster">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Guardando…' : initial ? 'Guardar cambios' : 'Agregar ejercicio'}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
