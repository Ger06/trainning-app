'use client'

import { useEffect, useState } from 'react'
import { RoutineBuilder } from './RoutineBuilder'

type RoutineInitial = NonNullable<Parameters<typeof RoutineBuilder>[0]['initial']>

/**
 * T36 · Carga la rutina a editar (`GET /api/routines`, filtrando por id, ya que
 * el listado es el único endpoint de lectura) y monta el `RoutineBuilder` en
 * modo edición. Solo renderiza y delega.
 */
export function EditRoutine({ id }: { id: string }) {
  const [state, setState] = useState<'loading' | 'missing' | RoutineInitial>('loading')

  useEffect(() => {
    void fetch('/api/routines')
      .then((r) => (r.ok ? r.json() : []))
      .then((list: RoutineInitial[]) => {
        const found = list.find((r) => r.id === id)
        setState(found ?? 'missing')
      })
      .catch(() => setState('missing'))
  }, [id])

  if (state === 'loading') return <p className="list__empty">Cargando…</p>
  if (state === 'missing') return <p className="list__empty">Esa rutina no existe.</p>
  return <RoutineBuilder initial={state} />
}
