import { InvalidTrainingInputError } from '@/domain/training/errors'
import { currentTrainer, deleteExercise, updateExercise } from '@/infra/container'
import { readJsonRecord } from '@/lib/http/read-json'
import { jsonResponse } from '@/lib/http/problem'
import { trainingErrorResponse } from '@/lib/http/training-error-response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Ctx {
  params: Promise<{ id: string }>
}

/** PATCH → edita nombre/descripción de un ejercicio propio (RF-1, RF-2, RF-7). */
export async function PATCH(request: Request, ctx: Ctx) {
  const guard = await currentTrainer(request)
  if (!guard.ok) return trainingErrorResponse(guard.error)

  const body = await readJsonRecord(request)
  if (!body) return trainingErrorResponse(new InvalidTrainingInputError([]))

  const { id } = await ctx.params
  const result = await updateExercise({
    trainerId: guard.value.trainerId,
    id,
    name: body.name,
    description: body.description,
  })
  if (!result.ok) return trainingErrorResponse(result.error)
  return jsonResponse(200, result.value)
}

/** DELETE → baja de un ejercicio propio; falla si alguna rutina lo usa (RF-1, RF-2, RF-8). */
export async function DELETE(request: Request, ctx: Ctx) {
  const guard = await currentTrainer(request)
  if (!guard.ok) return trainingErrorResponse(guard.error)

  const { id } = await ctx.params
  const result = await deleteExercise({ trainerId: guard.value.trainerId, id })
  if (!result.ok) return trainingErrorResponse(result.error)
  return jsonResponse(200, { ok: true })
}
