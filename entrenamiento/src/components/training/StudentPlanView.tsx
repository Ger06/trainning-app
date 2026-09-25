'use client'

import { useState, type FormEvent } from 'react'

interface Assignment {
  id: string
  week: number
  weekday: string
  routineSnapshot: { name: string }
}

/**
 * T37 · Vista del mesociclo de un alumno (RF-18). Solo renderiza y delega en
 * `GET /api/assignments?studentId=`. El `studentId` sale del resultado de una
 * asignación (`created[].studentId`).
 */
export function StudentPlanView() {
  const [studentId, setStudentId] = useState('')
  const [rows, setRows] = useState<Assignment[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setRows(null)
    try {
      const res = await fetch(`/api/assignments?studentId=${encodeURIComponent(studentId.trim())}`)
      const body = await res.json().catch(() => [])
      if (res.ok) {
        setRows(body as Assignment[])
        return
      }
      setError(typeof body.message === 'string' ? body.message : 'No se pudo cargar.')
    } catch {
      setError('No se pudo conectar.')
    }
  }

  const byWeek = new Map<number, Assignment[]>()
  for (const a of rows ?? []) {
    byWeek.set(a.week, [...(byWeek.get(a.week) ?? []), a])
  }

  return (
    <form onSubmit={onSubmit} noValidate className="stack">
      <div className="cluster">
        <div className="field field--grow">
          <label htmlFor="pv-student">ID del alumno</label>
          <input id="pv-student" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
        </div>
        <button type="submit" className="btn">
          Ver plan
        </button>
      </div>

      {error && (
        <p role="alert" className="mark-wrong">
          {error}
        </p>
      )}

      {rows !== null &&
        (rows.length === 0 ? (
          <p className="list__empty">Este alumno no tiene rutinas asignadas.</p>
        ) : (
          [...byWeek.keys()]
            .sort((a, b) => a - b)
            .map((wk) => (
              <table key={wk} className="plan-table">
                <thead>
                  <tr>
                    <th>Semana {wk}</th>
                    <th>Día</th>
                    <th>Rutina</th>
                  </tr>
                </thead>
                <tbody>
                  {(byWeek.get(wk) ?? []).map((a) => (
                    <tr key={a.id}>
                      <td />
                      <td>{a.weekday}</td>
                      <td>{a.routineSnapshot.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))
        ))}
    </form>
  )
}
