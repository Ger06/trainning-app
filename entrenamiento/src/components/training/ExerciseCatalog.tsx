'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExerciseForm } from './ExerciseForm'

interface Exercise {
  id: string
  name: string
  description?: string
}

/**
 * T35 · Catálogo de ejercicios del entrenador. Solo renderiza y delega
 * (`GET/DELETE /api/exercises`). RF-1/RF-2 los aplica el servidor; aquí se
 * muestran los mensajes tal cual (p. ej. "en uso" al borrar, RF-8).
 */
export function ExerciseCatalog() {
  const [items, setItems] = useState<Exercise[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/exercises')
      setItems(res.ok ? await res.json() : [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function remove(id: string) {
    setNotice(null)
    const res = await fetch(`/api/exercises/${id}`, { method: 'DELETE' })
    if (res.ok) {
      await load()
      return
    }
    const body = await res.json().catch(() => ({}))
    setNotice(typeof body.message === 'string' ? body.message : 'No se pudo borrar.')
  }

  return (
    <div className="stack">
      <div className="panel">
        <h2 className="panel__title">Nuevo ejercicio</h2>
        <ExerciseForm onSaved={load} />
      </div>

      <div className="panel">
        <h2 className="panel__title">Catálogo</h2>
        {notice && (
          <p role="alert" className="mark-wrong">
            {notice}
          </p>
        )}
        {loading ? (
          <p className="list__empty">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="list__empty">Todavía no cargaste ejercicios.</p>
        ) : (
          <div className="list">
            {items.map((ex) =>
              editing === ex.id ? (
                <div key={ex.id} className="list__row">
                  <div className="list__main">
                    <ExerciseForm
                      initial={ex}
                      onSaved={() => {
                        setEditing(null)
                        void load()
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  </div>
                </div>
              ) : (
                <div key={ex.id} className="list__row">
                  <div className="list__main">
                    <div className="list__name">{ex.name}</div>
                    {ex.description && <div className="list__meta">{ex.description}</div>}
                  </div>
                  <button type="button" className="btn btn--tiny" onClick={() => setEditing(ex.id)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn btn--tiny btn--danger"
                    onClick={() => void remove(ex.id)}
                  >
                    Borrar
                  </button>
                </div>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  )
}
