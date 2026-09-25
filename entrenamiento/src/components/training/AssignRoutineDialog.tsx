'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { TRAINING_MESSAGES } from '@/lib/training-messages'

interface RoutineOption {
  id: string
  name: string
}

interface RecipientRow {
  username: string
  confirmarAlta: boolean
  passwordInicial: string
}

const WEEKDAYS = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
] as const

interface AssignResult {
  created: { id: string; studentId: string; week: number; weekday: string }[]
  overwritten: unknown[]
  needsConfirmation: string[]
  rejected: { username: string; reason: string }[]
}

/**
 * T37 · Asignar una rutina a varios alumnos y varios pares (semana, día).
 * Solo recoge la entrada y delega en `POST /api/assignments` (RF-18, RF-19).
 * Un alumno desconocido dispara la confirmación de alta (RF-21, RF-21b). Antes
 * de enviar se avisa de que la asignación reemplaza lo que hubiera en esos días
 * (RF-26).
 */
export function AssignRoutineDialog() {
  const [routines, setRoutines] = useState<RoutineOption[]>([])
  const [routineId, setRoutineId] = useState('')
  const [recipients, setRecipients] = useState<RecipientRow[]>([
    { username: '', confirmarAlta: false, passwordInicial: '' },
  ])
  const [week, setWeek] = useState('1')
  const [days, setDays] = useState<Set<string>>(new Set())
  const [confirmed, setConfirmed] = useState(false)
  const [result, setResult] = useState<AssignResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetch('/api/routines')
      .then((r) => (r.ok ? r.json() : []))
      .then(setRoutines)
      .catch(() => setRoutines([]))
  }, [])

  const patchRecipient = (i: number, patch: Partial<RecipientRow>) =>
    setRecipients((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const toggleDay = (d: string) =>
    setDays((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!confirmed) {
      setConfirmed(true)
      return
    }
    setError(null)
    setResult(null)
    setBusy(true)
    const payload = {
      routineId,
      recipients: recipients
        .filter((r) => r.username.trim() !== '')
        .map((r) => ({
          username: r.username.trim(),
          confirmarAlta: r.confirmarAlta || undefined,
          passwordInicial: r.confirmarAlta ? r.passwordInicial : undefined,
        })),
      slots: [...days].map((weekday) => ({ week: Number(week), weekday })),
    }
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        setResult(body as AssignResult)
        setConfirmed(false)
        return
      }
      setError(typeof body.message === 'string' ? body.message : 'No se pudo asignar.')
    } catch {
      setError('No se pudo conectar. Probá de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="stack">
      <div className="field field--grow">
        <label htmlFor="as-routine">Rutina</label>
        <select id="as-routine" value={routineId} onChange={(e) => setRoutineId(e.target.value)} required>
          <option value="">— elegí —</option>
          {routines.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <div className="stack">
        <span className="field-label">Alumnos</span>
        {recipients.map((r, i) => (
          <div key={i} className="ex-row">
            <div className="cluster">
              <div className="field field--grow">
                <label>Nombre de usuario</label>
                <input value={r.username} onChange={(e) => patchRecipient(i, { username: e.target.value })} />
              </div>
              <label className="field-label" style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={r.confirmarAlta}
                  onChange={(e) => patchRecipient(i, { confirmarAlta: e.target.checked })}
                />
                dar de alta si no existe
              </label>
              {r.confirmarAlta && (
                <div className="field field--grow">
                  <label>Contraseña inicial</label>
                  <input
                    type="password"
                    value={r.passwordInicial}
                    minLength={8}
                    onChange={(e) => patchRecipient(i, { passwordInicial: e.target.value })}
                  />
                </div>
              )}
              <button
                type="button"
                className="btn btn--tiny btn--danger"
                onClick={() => setRecipients((rs) => rs.filter((_, j) => j !== i))}
                disabled={recipients.length === 1}
              >
                Quitar
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn btn--tiny"
          onClick={() => setRecipients((rs) => [...rs, { username: '', confirmarAlta: false, passwordInicial: '' }])}
        >
          + Alumno
        </button>
      </div>

      <div className="cluster">
        <div className="field field--num">
          <label htmlFor="as-week">Semana</label>
          <input id="as-week" value={week} inputMode="numeric" onChange={(e) => setWeek(e.target.value)} />
        </div>
        <div className="field field--grow">
          <span className="field-label">Días</span>
          <div className="cluster">
            {WEEKDAYS.map((d) => (
              <label key={d} className="field-label" style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                <input type="checkbox" checked={days.has(d)} onChange={() => toggleDay(d)} />
                {d}
              </label>
            ))}
          </div>
        </div>
      </div>

      {confirmed && !busy && <p className="notice">{TRAINING_MESSAGES.slotOverwritten}. Volvé a pulsar para confirmar.</p>}
      {error && (
        <p role="alert" className="mark-wrong">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn--primary" disabled={busy}>
        {busy ? 'Asignando…' : confirmed ? 'Confirmar asignación' : 'Asignar'}
      </button>

      {result && (
        <div className="notice">
          <div>Asignaciones creadas: {result.created.length}</div>
          {result.overwritten.length > 0 && <div>Slots reemplazados: {result.overwritten.length}</div>}
          {result.needsConfirmation.length > 0 && (
            <div>
              Sin cuenta (marcá &quot;dar de alta&quot; y reintentá): {result.needsConfirmation.join(', ')}
            </div>
          )}
          {result.rejected.length > 0 && (
            <div>
              Rechazados: {result.rejected.map((r) => `${r.username} (${r.reason})`).join(', ')}
            </div>
          )}
        </div>
      )}
    </form>
  )
}
