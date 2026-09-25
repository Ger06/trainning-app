'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'

interface ExerciseOption {
  id: string
  name: string
}

interface ExRow {
  exerciseId: string
  sets: string
  reps: string
  timeSec: string
  restBetweenSetsSec: string
  restAfterExerciseSec: string
  note: string
}

interface BlockRow {
  exercises: ExRow[]
  rounds: string
  restBetweenRoundsSec: string
  restAfterBlockSec: string
}

interface Issue {
  field: string
  code: string
}

interface Props {
  /** Sin valor → alta (POST). Con valor → edición (PATCH). */
  initial?: {
    id: string
    name: string
    note?: string
    blocks: {
      exercises: {
        exerciseId: string
        sets: number
        reps?: number
        timeSec?: number
        restBetweenSetsSec: number
        restAfterExerciseSec: number
        note?: string
      }[]
      rounds: number
      restBetweenRoundsSec: number
      restAfterBlockSec?: number
    }[]
  }
}

const numOrUndef = (v: string): number | undefined => (v.trim() === '' ? undefined : Number(v))

const emptyEx = (): ExRow => ({
  exerciseId: '',
  sets: '3',
  reps: '10',
  timeSec: '',
  restBetweenSetsSec: '60',
  restAfterExerciseSec: '0',
  note: '',
})
const emptyBlock = (): BlockRow => ({
  exercises: [emptyEx()],
  rounds: '1',
  restBetweenRoundsSec: '0',
  restAfterBlockSec: '',
})

function fromInitial(p: Props['initial']): { name: string; note: string; blocks: BlockRow[] } {
  if (!p) return { name: '', note: '', blocks: [emptyBlock()] }
  return {
    name: p.name,
    note: p.note ?? '',
    blocks: p.blocks.map((b) => ({
      rounds: String(b.rounds),
      restBetweenRoundsSec: String(b.restBetweenRoundsSec),
      restAfterBlockSec: b.restAfterBlockSec === undefined ? '' : String(b.restAfterBlockSec),
      exercises: b.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        sets: String(e.sets),
        reps: e.reps === undefined ? '' : String(e.reps),
        timeSec: e.timeSec === undefined ? '' : String(e.timeSec),
        restBetweenSetsSec: String(e.restBetweenSetsSec),
        restAfterExerciseSec: String(e.restAfterExerciseSec),
        note: e.note ?? '',
      })),
    })),
  }
}

/**
 * T36 · Constructor de rutinas. Solo recoge la entrada y delega en
 * `POST`/`PATCH /api/routines`; no valida reglas de negocio (RF-3, el servidor
 * es la autoridad). Permite ≥ 1 bloque, ≥ 1 ejercicio por bloque, reordenar y
 * los cuatro descansos (RF-10..RF-14, RF-13b).
 */
export function RoutineBuilder({ initial }: Props) {
  const router = useRouter()
  const seed = fromInitial(initial)
  const [name, setName] = useState(seed.name)
  const [note, setNote] = useState(seed.note)
  const [blocks, setBlocks] = useState<BlockRow[]>(seed.blocks)
  const [options, setOptions] = useState<ExerciseOption[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetch('/api/exercises')
      .then((r) => (r.ok ? r.json() : []))
      .then(setOptions)
      .catch(() => setOptions([]))
  }, [])

  const patchBlock = (bi: number, patch: Partial<BlockRow>) =>
    setBlocks((bs) => bs.map((b, i) => (i === bi ? { ...b, ...patch } : b)))
  const patchEx = (bi: number, ei: number, patch: Partial<ExRow>) =>
    setBlocks((bs) =>
      bs.map((b, i) =>
        i === bi
          ? { ...b, exercises: b.exercises.map((e, j) => (j === ei ? { ...e, ...patch } : e)) }
          : b,
      ),
    )
  const move = <T,>(arr: T[], from: number, to: number): T[] => {
    if (to < 0 || to >= arr.length) return arr
    const copy = [...arr]
    const [x] = copy.splice(from, 1)
    copy.splice(to, 0, x)
    return copy
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIssues([])
    setBusy(true)
    const payload = {
      name,
      note: note || undefined,
      blocks: blocks.map((b) => ({
        rounds: numOrUndef(b.rounds),
        restBetweenRoundsSec: numOrUndef(b.restBetweenRoundsSec),
        restAfterBlockSec: numOrUndef(b.restAfterBlockSec),
        exercises: b.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          sets: numOrUndef(e.sets),
          reps: numOrUndef(e.reps),
          timeSec: numOrUndef(e.timeSec),
          restBetweenSetsSec: numOrUndef(e.restBetweenSetsSec),
          restAfterExerciseSec: numOrUndef(e.restAfterExerciseSec),
          note: e.note || undefined,
        })),
      })),
    }
    try {
      const res = await fetch(initial ? `/api/routines/${initial.id}` : '/api/routines', {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        router.push('/routines')
        router.refresh()
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
          <label htmlFor="rt-name">Nombre de la rutina</label>
          <input id="rt-name" value={name} minLength={2} onChange={(e) => setName(e.target.value)} required />
        </div>
      </div>
      <div className="field field--grow">
        <label htmlFor="rt-note">Nota (opcional)</label>
        <textarea id="rt-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {blocks.map((b, bi) => (
        <div key={bi} className="block-card">
          <div className="block-card__head">
            <span className="block-card__tag">Bloque {bi + 1}</span>
            <div className="trainer-nav__spacer" />
            <button type="button" className="btn btn--tiny" onClick={() => setBlocks((bs) => move(bs, bi, bi - 1))}>
              ↑
            </button>
            <button type="button" className="btn btn--tiny" onClick={() => setBlocks((bs) => move(bs, bi, bi + 1))}>
              ↓
            </button>
            <button
              type="button"
              className="btn btn--tiny btn--danger"
              onClick={() => setBlocks((bs) => bs.filter((_, i) => i !== bi))}
              disabled={blocks.length === 1}
            >
              Quitar bloque
            </button>
          </div>

          <div className="cluster">
            <div className="field field--num">
              <label>Rondas</label>
              <input value={b.rounds} inputMode="numeric" onChange={(e) => patchBlock(bi, { rounds: e.target.value })} />
            </div>
            <div className="field field--num">
              <label>Descanso entre rondas (s)</label>
              <input
                value={b.restBetweenRoundsSec}
                inputMode="numeric"
                onChange={(e) => patchBlock(bi, { restBetweenRoundsSec: e.target.value })}
              />
            </div>
            <div className="field field--num">
              <label>Descanso tras el bloque (s)</label>
              <input
                value={b.restAfterBlockSec}
                inputMode="numeric"
                onChange={(e) => patchBlock(bi, { restAfterBlockSec: e.target.value })}
              />
            </div>
          </div>

          {b.exercises.map((e, ei) => (
            <div key={ei} className="ex-row">
              <div className="cluster">
                <div className="field field--grow">
                  <label>Ejercicio</label>
                  <select value={e.exerciseId} onChange={(ev) => patchEx(bi, ei, { exerciseId: ev.target.value })}>
                    <option value="">— elegí —</option>
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" className="btn btn--tiny" onClick={() => patchBlock(bi, { exercises: move(b.exercises, ei, ei - 1) })}>
                  ↑
                </button>
                <button type="button" className="btn btn--tiny" onClick={() => patchBlock(bi, { exercises: move(b.exercises, ei, ei + 1) })}>
                  ↓
                </button>
                <button
                  type="button"
                  className="btn btn--tiny btn--danger"
                  onClick={() => patchBlock(bi, { exercises: b.exercises.filter((_, j) => j !== ei) })}
                  disabled={b.exercises.length === 1}
                >
                  Quitar
                </button>
              </div>
              <div className="cluster">
                <div className="field field--num">
                  <label>Series</label>
                  <input value={e.sets} inputMode="numeric" onChange={(ev) => patchEx(bi, ei, { sets: ev.target.value })} />
                </div>
                <div className="field field--num">
                  <label>Repeticiones</label>
                  <input value={e.reps} inputMode="numeric" onChange={(ev) => patchEx(bi, ei, { reps: ev.target.value })} />
                </div>
                <div className="field field--num">
                  <label>Tiempo (s)</label>
                  <input value={e.timeSec} inputMode="numeric" onChange={(ev) => patchEx(bi, ei, { timeSec: ev.target.value })} />
                </div>
                <div className="field field--num">
                  <label>Descanso entre series (s)</label>
                  <input
                    value={e.restBetweenSetsSec}
                    inputMode="numeric"
                    onChange={(ev) => patchEx(bi, ei, { restBetweenSetsSec: ev.target.value })}
                  />
                </div>
                <div className="field field--num">
                  <label>Descanso tras el ejercicio (s)</label>
                  <input
                    value={e.restAfterExerciseSec}
                    inputMode="numeric"
                    onChange={(ev) => patchEx(bi, ei, { restAfterExerciseSec: ev.target.value })}
                  />
                </div>
                <div className="field field--grow">
                  <label>Nota (opcional)</label>
                  <input value={e.note} onChange={(ev) => patchEx(bi, ei, { note: ev.target.value })} />
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="btn btn--tiny"
            onClick={() => patchBlock(bi, { exercises: [...b.exercises, emptyEx()] })}
          >
            + Ejercicio
          </button>
        </div>
      ))}

      <button type="button" className="btn" onClick={() => setBlocks((bs) => [...bs, emptyBlock()])}>
        + Bloque
      </button>

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

      <button type="submit" className="btn btn--primary" disabled={busy}>
        {busy ? 'Guardando…' : initial ? 'Guardar rutina' : 'Crear rutina'}
      </button>
    </form>
  )
}
