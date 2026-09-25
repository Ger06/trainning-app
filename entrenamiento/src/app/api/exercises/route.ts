import { InvalidTrainingInputError } from '@/domain/training/errors'
import { createExercise, currentTrainer, listExercises } from '@/infra/container'
import { readJsonRecord } from '@/lib/http/read-json'
import { jsonResponse } from '@/lib/http/problem'
import { trainingErrorResponse } from '@/lib/http/training-error-response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET → catálogo del entrenador (RF-1, RF-2). */
export async function GET(request: Request) {
  const guard = await currentTrainer(request)
  if (!guard.ok) return trainingErrorResponse(guard.error)
  return jsonResponse(200, await listExercises(guard.value.trainerId))
}

/** POST → alta de ejercicio (RF-1, RF-4, RF-6). */
export async function POST(request: Request) {
  const guard = await currentTrainer(request)
  if (!guard.ok) return trainingErrorResponse(guard.error)

  const body = await readJsonRecord(request)
  if (!body) return trainingErrorResponse(new InvalidTrainingInputError([]))

  const result = await createExercise({
    trainerId: guard.value.trainerId,
    name: body.name,
    description: body.description,
  })
  if (!result.ok) return trainingErrorResponse(result.error)
  return jsonResponse(201, result.value)
}
