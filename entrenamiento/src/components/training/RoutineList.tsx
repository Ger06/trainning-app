'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

interface Routine {
  id: string
  name: string
  blocks: unknown[]
}

/**
 * T36 · Listado de rutinas del entrenador. Solo renderiza y delega
 * (`GET/DELETE /api/routines`). RF-2 lo aplica el servidor.
 */
export function RoutineList() {
  const [items, setItems] = useState<Routine[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/routines')
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
    const res = await fetch(`/api/routines/${id}`, { method: 'DELETE' })
    if (res.ok) {
      await load()
      return
    }
    const body = await res.json().catch(() => ({}))
    setNotice(typeof body.message === 'string' ? body.message : 'No se pudo borrar.')
  }

  return (
    <div className="panel">
      <div className="cluster">
        <h2 className="panel__title">Rutinas</h2>
        <span className="trainer-nav__spacer" />
        <Link href="/routines/new" className="btn btn--primary">
          Nueva rutina
        </Link>
      </div>

      {notice && (
        <p role="alert" className="mark-wrong">
          {notice}
        </p>
      )}

      {loading ? (
        <p className="list__empty">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="list__empty">Todavía no creaste rutinas.</p>
      ) : (
        <div className="list">
          {items.map((r) => (
            <div key={r.id} className="list__row">
              <div className="list__main">
                <div className="list__name">{r.name}</div>
                <div className="list__meta">{r.blocks.length} bloque(s)</div>
              </div>
              <Link href={`/routines/${r.id}`} className="btn btn--tiny">
                Editar
              </Link>
              <button
                type="button"
                className="btn btn--tiny btn--danger"
                onClick={() => void remove(r.id)}
              >
                Borrar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
