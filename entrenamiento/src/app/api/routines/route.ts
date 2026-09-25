import { InvalidTrainingInputError } from '@/domain/training/errors'
import { createRoutine, currentTrainer, listRoutines } from '@/infra/container'
import { readJsonRecord } from '@/lib/http/read-json'
import { jsonResponse } from '@/lib/http/problem'
import { trainingErrorResponse } from '@/lib/http/training-error-response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET → rutinas del entrenador (RF-1, RF-2). */
export async function GET(request: Request) {
  const guard = await currentTrainer(request)
  if (!guard.ok) return trainingErrorResponse(guard.error)
  return jsonResponse(200, await listRoutines(guard.value.trainerId))
}

/** POST → alta de rutina (RF-1, RF-10..RF-16). */
export async function POST(request: Request) {
  const guard = await currentTrainer(request)
  if (!guard.ok) return trainingErrorResponse(guard.error)

  const body = await readJsonRecord(request)
  if (!body) return trainingErrorResponse(new InvalidTrainingInputError([]))

  const result = await createRoutine({
    trainerId: guard.value.trainerId,
    name: body.name,
    note: body.note,
    blocks: body.blocks,
  })
  if (!result.ok) return trainingErrorResponse(result.error)
  return jsonResponse(201, result.value)
}
