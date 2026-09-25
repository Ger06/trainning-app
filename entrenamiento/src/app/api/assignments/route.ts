import { InvalidTrainingInputError } from '@/domain/training/errors'
import { assignRoutine, currentTrainer, listAssignments } from '@/infra/container'
import { readJsonRecord } from '@/lib/http/read-json'
import { jsonResponse } from '@/lib/http/problem'
import { trainingErrorResponse } from '@/lib/http/training-error-response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET ?studentId=&week= → asignaciones del alumno (vista del mesociclo) (RF-1, RF-2, RF-18). */
export async function GET(request: Request) {
  const guard = await currentTrainer(request)
  if (!guard.ok) return trainingErrorResponse(guard.error)

  const url = new URL(request.url)
  const studentId = url.searchParams.get('studentId')
  if (!studentId) {
    return trainingErrorResponse(
      new InvalidTrainingInputError([{ field: 'studentId', code: 'required' }]),
    )
  }
  const weekParam = url.searchParams.get('week')
  const week = weekParam === null ? undefined : Number(weekParam)

  return jsonResponse(
    200,
    await listAssignments({ trainerId: guard.value.trainerId, studentId, week }),
  )
}

/**
 * POST → asigna una rutina a `recipients` × `slots` (RF-1, RF-18..RF-26).
 * Devuelve el resultado parcial `{ created, overwritten, needsConfirmation, rejected }`.
 */
export async function POST(request: Request) {
  const guard = await currentTrainer(request)
  if (!guard.ok) return trainingErrorResponse(guard.error)

  const body = await readJsonRecord(request)
  if (!body) return trainingErrorResponse(new InvalidTrainingInputError([]))

  const result = await assignRoutine({
    trainerId: guard.value.trainerId,
    routineId: typeof body.routineId === 'string' ? body.routineId : '',
    recipients: body.recipients,
    slots: body.slots,
  })
  if (!result.ok) return trainingErrorResponse(result.error)
  return jsonResponse(200, result.value)
}
