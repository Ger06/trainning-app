import { InvalidTrainingInputError } from '@/domain/training/errors'
import { currentTrainer, deleteRoutine, updateRoutine } from '@/infra/container'
import { readJsonRecord } from '@/lib/http/read-json'
import { jsonResponse } from '@/lib/http/problem'
import { trainingErrorResponse } from '@/lib/http/training-error-response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Ctx {
  params: Promise<{ id: string }>
}

/** PATCH → sustituye una rutina propia; no toca asignaciones (RF-1, RF-2, RF-17). */
export async function PATCH(request: Request, ctx: Ctx) {
  const guard = await currentTrainer(request)
  if (!guard.ok) return trainingErrorResponse(guard.error)

  const body = await readJsonRecord(request)
  if (!body) return trainingErrorResponse(new InvalidTrainingInputError([]))

  const { id } = await ctx.params
  const result = await updateRoutine({
    trainerId: guard.value.trainerId,
    id,
    name: body.name,
    note: body.note,
    blocks: body.blocks,
  })
  if (!result.ok) return trainingErrorResponse(result.error)
  return jsonResponse(200, result.value)
}

/** DELETE → baja de una rutina propia; no toca asignaciones (RF-1, RF-2, RF-17). */
export async function DELETE(request: Request, ctx: Ctx) {
  const guard = await currentTrainer(request)
  if (!guard.ok) return trainingErrorResponse(guard.error)

  const { id } = await ctx.params
  const result = await deleteRoutine({ trainerId: guard.value.trainerId, id })
  if (!result.ok) return trainingErrorResponse(result.error)
  return jsonResponse(200, { ok: true })
}
